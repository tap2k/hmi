/**
 * server.js — HMI Middleware (Phase 1: PS4 Baseline)
 *
 * Reads PS4 controller via HID, applies the transform pipeline,
 * and broadcasts normalized JSON over WebSocket.
 *
 * Usage: npm start
 * WebSocket endpoint: ws://localhost:3000/ws/hmi
 */

const HID = require('node-hid');
const { WebSocketServer } = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { transformAxis } = require('./config/transform.js');

const WS_PORT = 3009;
const WS_PATH = '/ws/hmi';
const TICK_MS = 50;

const ARDUINO_PATH = process.env.ARDUINO_PORT || null;  // optional override
const ARDUINO_BAUD = 115200;
const EMPTY_LIGHTS = { ALL: false, PROFILE: false, BEAM: false, ROADING: false, BEACON: false, PARKING: false };

// Sony PS4 DualShock 4
const PS4_VENDOR_ID  = 1356;
const PS4_PRODUCT_ID = 2508;

// ─── HID byte offsets (confirmed empirically via USB on macOS) ────────────────
//
// Axes — 8-bit unsigned (0–255), center at 128
//   byte 1 — left stick X   (0=full left,  255=full right)  → bucket
//   byte 2 — left stick Y   (0=full up,    255=full down)   → boom   (invert)
//   byte 3 — right stick X  (0=full left,  255=full right)  → swing
//   byte 4 — right stick Y  (0=full up,    255=full down)   → stick  (invert)
//
// byte 5 — face buttons + dpad
//   0x08 = dpad neutral (resting value)
//   0x00 = dpad up
//   0x02 = dpad right
//   0x04 = dpad down
//   0x06 = dpad left
//   0x80 = triangle
//   0x48 = circle
//   0x28 = cross (X)
//   0x18 = square
//
// byte 6 — shoulder + misc buttons
//   0x01 = L1
//   0x02 = R1
//   0x04 = L2
//   0x08 = R2
//   0x10 = share
//   0x20 = options
//   0x40 = left stick press (L3)
//   0x80 = right stick press (R3)
//
const AXIS_LEFT_X  = 1;
const AXIS_LEFT_Y  = 2;
const AXIS_RIGHT_X = 3;
const AXIS_RIGHT_Y = 4;

const BTN_BYTE_FACE     = 5;
const BTN_BYTE_SHOULDER = 6;

const BTN_TRI_MASK = 0x80; // triangle  — mode_toggle  AND lights.ALL
const BTN_CIR_MASK = 0x40; // circle    — lights.PROFILE
const BTN_CRO_MASK = 0x20; // cross     — lights.ROADING
const BTN_SQU_MASK = 0x10; // square    — lights.BEAM
const BTN_OPT_MASK = 0x20; // options   — reset
const BTN_R2_MASK  = 0x08; // R2        — deadman
const BTN_L1_MASK  = 0x01; // L1        — lights.BEACON
const BTN_R1_MASK  = 0x02; // R1        — lights.PARKING

// ─── Normalize 0–255 ADC value to -1.0 to 1.0 ────────────────────────────────
function normalizeAxis(raw) {
  return (raw - 128) / 128;
}

// ─── State ────────────────────────────────────────────────────────────────────
let prevAxes = { left_x: 0, left_y: 0, right_x: 0, right_y: 0 };
let rawState = {
  axes:    { left_x: 0, left_y: 0, right_x: 0, right_y: 0 },
  buttons: { deadman: false, mode_toggle: false, reset: false },
  lights:  { ...EMPTY_LIGHTS },
  connected: false
};

// Two independent light-input sources. Merged (OR'd) into rawState.lights at broadcast.
let ps4Lights     = { ...EMPTY_LIGHTS };
let arduinoLights = { ...EMPTY_LIGHTS };

// Last LED-command string received from the frontend (e.g. "L:100010\n").
// Cached so we can replay it to the Arduino as soon as it (re)connects.
let lastLedCommand = null;

// ─── WebSocket server ─────────────────────────────────────────────────────────
const wss = new WebSocketServer({ port: WS_PORT, path: WS_PATH });

wss.on('listening', () => {
  console.log(`[hmi-middleware] WebSocket server running at ws://localhost:${WS_PORT}${WS_PATH}`);
});

// Inbound messages from the frontend. Currently just LED mirror commands for
// the Arduino hardware keypad: { type: 'leds', bits: '100010' }.
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'leds' && typeof msg.bits === 'string' && /^[01]{6}$/.test(msg.bits)) {
        lastLedCommand = `L:${msg.bits}\n`;
        if (arduinoPort && arduinoPort.writable) {
          arduinoPort.write(lastLedCommand, (err) => {
            if (err) console.warn('[hmi-middleware] LED write failed:', err.message);
          });
        }
      }
    } catch {
      // ignore malformed
    }
  });
});

function broadcast(data) {
  const json = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(json);
  }
}

// ─── PS4 HID reader ───────────────────────────────────────────────────────────
let device = null;

function connectPS4() {
  try {
    device = new HID.HID(PS4_VENDOR_ID, PS4_PRODUCT_ID);
    rawState.connected = true;
    console.log('[hmi-middleware] PS4 controller connected');

    device.on('data', (buf) => {
      const leftX  =  normalizeAxis(buf[AXIS_LEFT_X]);
      const leftY  = -normalizeAxis(buf[AXIS_LEFT_Y]);   // invert
      const rightX =  normalizeAxis(buf[AXIS_RIGHT_X]);
      const rightY = -normalizeAxis(buf[AXIS_RIGHT_Y]);  // invert

      rawState.axes = {
        left_x:  leftX,
        left_y:  leftY,
        right_x: rightX,
        right_y: rightY
      };

      rawState.buttons = {
        deadman:     !!(buf[BTN_BYTE_SHOULDER] & BTN_R2_MASK),
        mode_toggle: !!(buf[BTN_BYTE_FACE] & BTN_TRI_MASK),
        reset:       !!(buf[BTN_BYTE_SHOULDER] & BTN_OPT_MASK)
      };

      // Lighting keypad — raw held state from PS4. Merged with Arduino at broadcast.
      ps4Lights = {
        ALL:     !!(buf[BTN_BYTE_FACE]     & BTN_TRI_MASK),
        PROFILE: !!(buf[BTN_BYTE_FACE]     & BTN_CIR_MASK),
        BEAM:    !!(buf[BTN_BYTE_FACE]     & BTN_SQU_MASK),
        ROADING: !!(buf[BTN_BYTE_FACE]     & BTN_CRO_MASK),
        BEACON:  !!(buf[BTN_BYTE_SHOULDER] & BTN_L1_MASK),
        PARKING: !!(buf[BTN_BYTE_SHOULDER] & BTN_R1_MASK),
      };
    });

    device.on('error', (err) => {
      console.warn('[hmi-middleware] Controller disconnected:', err.message);
      rawState.connected = false;
      ps4Lights = { ...EMPTY_LIGHTS };
      device = null;
    });

  } catch (err) {
    if (rawState.connected) {
      console.warn('[hmi-middleware] PS4 not found, waiting...');
    }
    rawState.connected = false;
    device = null;
  }
}

// ─── Arduino serial reader (6-button lighting keypad) ────────────────────────
let arduinoPort = null;

async function connectArduino() {
  if (arduinoPort) return;
  try {
    let path = ARDUINO_PATH;
    if (!path) {
      // Auto-detect: look for the first port that looks like an Arduino/USB-serial
      const ports = await SerialPort.list();
      const candidate = ports.find(p =>
        /usbmodem|usbserial|wchusbserial/i.test(p.path) ||
        /arduino/i.test(p.manufacturer || '')
      );
      if (!candidate) return;
      path = candidate.path;
    }

    const port = new SerialPort({ path, baudRate: ARDUINO_BAUD }, (err) => {
      if (err) {
        arduinoPort = null;
        arduinoLights = { ...EMPTY_LIGHTS };
      }
    });
    const reader = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    port.on('open',  () => {
      console.log(`[hmi-middleware] Arduino keypad connected on ${path}`);
      // Replay last-known LED state so hardware syncs with the frontend immediately.
      if (lastLedCommand) port.write(lastLedCommand);
    });
    port.on('error', (err) => {
      console.warn('[hmi-middleware] Arduino error:', err.message);
      arduinoPort = null;
      arduinoLights = { ...EMPTY_LIGHTS };
    });
    port.on('close', () => {
      console.warn('[hmi-middleware] Arduino disconnected');
      arduinoPort = null;
      arduinoLights = { ...EMPTY_LIGHTS };
    });

    reader.on('data', (line) => {
      try {
        const parsed = JSON.parse(line);
        arduinoLights = {
          ALL:     !!parsed.ALL,
          PROFILE: !!parsed.PROFILE,
          BEAM:    !!parsed.BEAM,
          ROADING: !!parsed.ROADING,
          BEACON:  !!parsed.BEACON,
          PARKING: !!parsed.PARKING,
        };
      } catch {
        // ignore malformed lines
      }
    });

    arduinoPort = port;
  } catch {
    // port doesn't exist yet — will retry next tick
  }
}

// ─── Transform + broadcast tick ───────────────────────────────────────────────
setInterval(() => {
  // Try to reconnect if disconnected
  if (!device) connectPS4();
  if (!arduinoPort) connectArduino();

  // Merge lights from all sources (PS4 OR Arduino keypad)
  rawState.lights = {
    ALL:     ps4Lights.ALL     || arduinoLights.ALL,
    PROFILE: ps4Lights.PROFILE || arduinoLights.PROFILE,
    BEAM:    ps4Lights.BEAM    || arduinoLights.BEAM,
    ROADING: ps4Lights.ROADING || arduinoLights.ROADING,
    BEACON:  ps4Lights.BEACON  || arduinoLights.BEACON,
    PARKING: ps4Lights.PARKING || arduinoLights.PARKING,
  };

  const raw = rawState.axes;

  const smoothed = {
    left_x:  transformAxis(raw.left_x,  prevAxes.left_x),
    left_y:  transformAxis(raw.left_y,  prevAxes.left_y),
    right_x: transformAxis(raw.right_x, prevAxes.right_x),
    right_y: transformAxis(raw.right_y, prevAxes.right_y)
  };

  prevAxes = smoothed;

  // Safety: deadman forces all axes to 0
  const deadman = rawState.buttons.deadman;
  const safeAxes = deadman ? smoothed : { left_x: 0, left_y: 0, right_x: 0, right_y: 0 };

  broadcast({
    timestamp: Date.now(),
    device: 'ps4',
    axes: safeAxes,
    buttons: rawState.buttons,
    lights: rawState.lights,
    meta: {
      raw_connected: rawState.connected,
      profile: 'ps4'
    }
  });
}, TICK_MS);

// Initial connection attempts
connectPS4();
connectArduino();
