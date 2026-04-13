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
const { transformAxis } = require('./config/transform.js');

const WS_PORT = 3009;
const WS_PATH = '/ws/hmi';
const TICK_MS = 50;

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

const BTN_TRI_MASK = 0x80; // triangle  — mode_toggle
const BTN_OPT_MASK = 0x20; // options   — reset
const BTN_R2_MASK  = 0x08; // R2        — deadman

// ─── Normalize 0–255 ADC value to -1.0 to 1.0 ────────────────────────────────
function normalizeAxis(raw) {
  return (raw - 128) / 128;
}

// ─── State ────────────────────────────────────────────────────────────────────
let prevAxes = { left_x: 0, left_y: 0, right_x: 0, right_y: 0 };
let rawState = {
  axes:    { left_x: 0, left_y: 0, right_x: 0, right_y: 0 },
  buttons: { deadman: false, mode_toggle: false, reset: false },
  connected: false
};

// ─── WebSocket server ─────────────────────────────────────────────────────────
const wss = new WebSocketServer({ port: WS_PORT, path: WS_PATH });

wss.on('listening', () => {
  console.log(`[hmi-middleware] WebSocket server running at ws://localhost:${WS_PORT}${WS_PATH}`);
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
    });

    device.on('error', (err) => {
      console.warn('[hmi-middleware] Controller disconnected:', err.message);
      rawState.connected = false;
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

// ─── Transform + broadcast tick ───────────────────────────────────────────────
setInterval(() => {
  // Try to reconnect if disconnected
  if (!device) connectPS4();

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
    meta: {
      raw_connected: rawState.connected,
      profile: 'ps4'
    }
  });
}, TICK_MS);

// Initial connection attempt
connectPS4();
