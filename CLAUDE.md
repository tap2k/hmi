# HMI Prototyping Toolkit — CLAUDE.md

## Project Overview

This is a hardware-agnostic HMI prototyping toolkit built for Caterpillar. The system
allows an operator to control a browser-based machine visualization (initially a backhoe
simulator) using a physical input device. The middleware sits between the input device and
the frontend, transforming raw hardware signals into clean, normalized control data.

The full stack has three layers, each in its own directory:

```
[hardware]          →  [middleware]            →  [frontend]
 PS4 controller         Node.js / Node-RED         React / Vite app
 (dev baseline)         WebSocket broadcast         WebSocket consumer
 ESP32 + joystick (wireless/MQTT)
 Arduino + joystick (wired/serial)
 (production targets)
```

The middleware is the stable contract between hardware and UI. Neither layer knows about
the other — they only know about the normalized data format this layer produces.

---

## Current Phase

**Phase 1 — PS4 Controller Baseline**

We are using a PS4 controller as the initial input device. The goal is to prove the
full data pipeline — input → transform → WebSocket → browser — with zero hardware risk
before introducing the ESP32 and industrial joystick.

---

## Structure

```
/
├── CLAUDE.md                        ← this file (root of the HMI project)
├── middleware/                      ← this layer (Node.js server, transform pipeline)
│   ├── package.json
│   ├── server.js                    ← Phase 1 entry point: npm start
│   ├── flows/
│   │   ├── ps4_baseline.json        ← Node-RED flow: PS4 → WebSocket (reference)
│   │   ├── esp32_joystick.json      ← Node-RED flow: ESP32 MQTT → WebSocket (future)
│   │   ├── arduino_serial.json      ← Node-RED flow: Arduino serial → WebSocket (future)
│   │   └── README.md                ← Node-RED import instructions
│   ├── profiles/
│   │   ├── ps4.json                 ← axis/button mapping for PS4
│   │   ├── esp32_joystick.json      ← axis mapping for ESP32 (MQTT)
│   │   └── arduino_serial.json      ← axis mapping for wired Arduino (serial)
│   └── config/
│       └── transform.js             ← deadzone, lerp, clamp, full pipeline
├── frontend/                        ← React/Vite visualization app (hmi-frontend)
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                  ← top-level: view toggle (debug / backhoe)
│       ├── hooks/
│       │   └── useHmi.js            ← WebSocket hook, auto-reconnect
│       ├── components/
│       │   └── AxisBar.jsx          ← reusable axis bar for debug view
│       └── pages/
│           ├── Debug.jsx            ← raw data debug view (axes + buttons)
│           └── Backhoe.jsx          ← split-view backhoe visualizer
└── hardware/                        ← Device firmware (hmi-hardware, Phase 2)
```

---

## Related Repositories

| Directory | Purpose |
|-----------|---------|
| `hardware/` | Device firmware (ESP32, Arduino) — Phase 2 only |
| `middleware/` | Transform pipeline, WebSocket broadcast |
| `frontend/` | React/Vite visualization app — WebSocket consumer, machine rendering |

These repos are intentionally decoupled. The only shared contract is the canonical
WebSocket message format defined below.

---

## Canonical Data Format

Every input device, regardless of type, must produce this normalized JSON structure on the
WebSocket. The frontend depends only on this format — it never knows what hardware produced it.

```json
{
  "timestamp": 1718000000000,
  "device": "ps4",
  "axes": {
    "left_x":  0.0,
    "left_y":  0.0,
    "right_x": 0.0,
    "right_y": 0.0
  },
  "buttons": {
    "deadman": false,
    "mode_toggle": false,
    "reset": false
  },
  "meta": {
    "raw_connected": true,
    "profile": "ps4"
  }
}
```

### Axis conventions

- All axes are normalized floats in the range **-1.0 to 1.0**
- **0.0** is center / neutral
- Positive values: left_x RIGHT, left_y DOWN, right_x RIGHT, right_y DOWN
- The frontend is responsible for mapping axis names to machine-specific functions (e.g. left_y → boom for a backhoe)
- Dead zone is applied before normalization — values within the dead zone are clamped to 0.0
- Smoothing (lerp) is applied after normalization

### Button conventions

- All buttons are booleans
- `deadman` — operator must hold this for any movement to register (safety requirement)
- `mode_toggle` — switches between control modes if implemented
- `reset` — returns visualization to neutral pose

---

## Transform Functions

These are the core signal processing functions. They are implemented in Node-RED function
nodes but documented here as canonical reference. Any hardware profile must pass data
through these in order.

### 1. Dead Zone

Prevents jitter at center. Any raw value within the dead zone threshold is returned as 0.

```javascript
function applyDeadzone(value, threshold = 0.08) {
  if (Math.abs(value) < threshold) return 0.0;
  return value;
}
```

### 2. Rescale after dead zone

After dead zone, rescale the remaining range back to full -1.0 to 1.0 so the usable
range isn't compressed.

```javascript
function rescaleAfterDeadzone(value, threshold = 0.08) {
  if (value === 0) return 0;
  const sign = value > 0 ? 1 : -1;
  return sign * (Math.abs(value) - threshold) / (1 - threshold);
}
```

### 3. Linear Interpolation (Lerp)

Simulates hydraulic lag. Instead of snapping to the new value, the output moves toward
it gradually each tick. `alpha` controls responsiveness — lower = more lag.

```javascript
function lerp(current, target, alpha = 0.15) {
  return current + (target - current) * alpha;
}
```

Recommended alpha values:
- `0.08–0.12` — heavy hydraulic feel (excavator boom)
- `0.15–0.20` — moderate (standard backhoe)
- `0.25–0.35` — light / responsive (testing/debug)

### 4. Clamp

Ensure output never exceeds bounds, regardless of input.

```javascript
function clamp(value, min = -1.0, max = 1.0) {
  return Math.max(min, Math.min(max, value));
}
```

### Full transform pipeline (apply in this order)

```javascript
function transformAxis(rawValue, prevOutput, config = {}) {
  const { deadzoneThreshold = 0.08, lerpAlpha = 0.15 } = config;
  const deadzoned = applyDeadzone(rawValue, deadzoneThreshold);
  const rescaled  = rescaleAfterDeadzone(deadzoned, deadzoneThreshold);
  const smoothed  = lerp(prevOutput, rescaled, lerpAlpha);
  return clamp(smoothed);
}
```

---

## Device Profiles

A device profile maps raw hardware axes/buttons to the canonical format. Swapping hardware
means swapping the profile — the transform pipeline and WebSocket output are unchanged.

### PS4 Profile (Baseline)

PS4 axes via HID (empirically confirmed byte offsets, USB on macOS):

| Canonical Name | PS4 HID               | Notes                        |
|----------------|-----------------------|------------------------------|
| left_x         | byte 1 (left stick X) |                              |
| left_y         | byte 2 (left stick Y) | Inverted — negate raw value  |
| right_x        | byte 3 (right stick X)|                              |
| right_y        | byte 4 (right stick Y)| Inverted — negate raw value  |
| deadman        | byte 6 & 0x08 (R2)    |                              |
| mode_toggle    | byte 5 & 0x80 (△)     |                              |
| reset          | byte 6 & 0x20 (Options)|                             |

Left stick Y and Right stick Y are inverted on PS4 hardware (push forward = negative).
Negate these before passing to the transform pipeline.

### ESP32 + Industrial Joystick Profile (Wireless / MQTT)

ESP32 publishes raw ADC values (0–4095) over MQTT. Profile must:
1. Map MQTT topic fields to canonical axis names
2. Normalize ADC range: `normalizedValue = (rawADC - 2048) / 2048`
3. Pass normalized value into the same transform pipeline

MQTT topic structure (to be confirmed with hardware):
```
hmi/joystick/axes    → { "x": 2048, "y": 1200, "z": 3100, "rz": 2050 }
hmi/joystick/buttons → { "deadman": 1, "mode_toggle": 0, "reset": 0 }
```

### Arduino + Industrial Joystick Profile (Wired / Serial)

Arduino sends newline-delimited JSON over USB serial. Node-RED reads it using
`node-red-node-serialport`. Profile must:
1. Parse the serial JSON payload
2. Normalize ADC range: `normalizedValue = (rawADC - 2048) / 2048`
3. Pass normalized value into the same transform pipeline

Expected serial output format (Arduino sketch should produce this):
```
{"x":2048,"y":1200,"z":3100,"rz":2050,"deadman":1,"mode_toggle":0,"reset":0}
```

No broker or network required — simpler for bench and demo setups.

---

## Node-RED Setup

### Installation

```bash
npm install -g --unsafe-perm node-red
node-red
# Access at http://localhost:1880
```

### Required nodes

Install from Node-RED palette manager or npm:

```bash
# PS4 / gamepad input
npm install node-red-contrib-gamepad

# WebSocket output is built into Node-RED — no extra install needed

# For ESP32 MQTT (Phase 2 — wireless)
npm install node-red-contrib-mqtt-broker   # if running broker locally
# or use external broker (Mosquitto, HiveMQ)

# For Arduino serial (Phase 2 — wired)
npm install node-red-node-serialport
```

### WebSocket configuration

The WebSocket output node should be configured as a **server** (not client) on:

```
ws://localhost:1880/ws/hmi
```

The frontend connects to this endpoint. In production/demo, replace `localhost` with
the machine's LAN IP so Caterpillar stakeholders can connect from other devices on
the same network.

### Flow: PS4 Baseline

Import `middleware/flows/ps4_baseline.json` into Node-RED.

Flow structure:
```
[gamepad in] → [profile map] → [transform function] → [state merge] → [websocket out]
                                                              ↑
                                                    [previous state store]
```

The `state merge` node holds the previous smoothed values for lerp continuity across ticks.
Use a flow-level context variable (`flow.prevAxes`) to persist state between messages.

Tick rate: the gamepad node fires on change. For lerp to work correctly at low movement
speeds, add an **inject node** on a 50ms interval that triggers a "coast to zero" update
even when the gamepad is idle. This ensures axes decay to 0 smoothly when the stick is
released rather than snapping.

---

## WebSocket Broadcast Behavior

- Broadcast on every tick (50ms interval minimum) even if values haven't changed
- This keeps the frontend animation loop alive and prevents stale-state issues
- Include `timestamp` in every message so the frontend can detect dropped packets
- If the input device disconnects, broadcast a zeroed-out message with `raw_connected: false`
  so the frontend can display a "No Controller" state safely

---

## Safety Rules (encode in Node-RED, not frontend)

These must be enforced in the middleware, not left to the frontend to handle:

1. **Deadman switch**: if `buttons.deadman === false`, all axis outputs must be forced to 0.0
   regardless of stick position. Do not pass this responsibility to the frontend.

2. **Max rate of change**: optionally clamp the maximum delta per tick to prevent
   sudden jumps. Suggested max delta: `0.05` per 50ms tick.

3. **Zero on disconnect**: if the gamepad node reports disconnection, immediately broadcast
   all axes as 0.0 and `raw_connected: false`.

---

## Phase 2: Hardware Swap

**ESP32 (wireless/MQTT):**
1. Install Mosquitto or another MQTT broker locally (or point to an existing broker)
2. Flash the ESP32 with firmware that publishes to MQTT topics above
3. Import `middleware/flows/esp32_joystick.json` into Node-RED
4. Update the WebSocket output endpoint if needed (same port, same path)
5. The frontend requires **zero changes**

**Arduino (wired/serial):**
1. Flash the Arduino with firmware that writes JSON lines to serial
2. Install `node-red-node-serialport` (`npm install node-red-node-serialport` in `~/.node-red`)
3. Import `middleware/flows/arduino_serial.json` into Node-RED and configure the serial node with the correct COM/tty port
4. Update the WebSocket output endpoint if needed (same port, same path)
5. The frontend requires **zero changes**

The transform pipeline, WebSocket format, and all safety rules remain identical.

---

## Getting Started (Day 1)

```bash
# 1. Install Node-RED
npm install -g --unsafe-perm node-red

# 2. Install gamepad node
cd ~/.node-red
npm install node-red-contrib-gamepad

# 3. Start Node-RED
node-red

# 4. Open browser
open http://localhost:1880

# 5. Plug in PS4 controller (USB or Bluetooth)

# 6. In Node-RED palette, drag in:
#    - gamepad input node
#    - function node (transform pipeline)
#    - websocket output node (server mode, path: /ws/hmi)
#    - debug node (to verify output)

# 7. Wire them together and deploy

# 8. Open browser console on your Vite dev server and connect:
#    const ws = new WebSocket('ws://localhost:1880/ws/hmi');
#    ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

Confirm you see the canonical JSON format in the console with axes moving as you
move the sticks. That's the pipeline proven end-to-end.

---

## Open Questions / To Confirm

- [ ] ESP32 MQTT topic structure — confirm with hardware vendor or Caterpillar team
- [ ] Dead zone threshold for industrial joystick (may differ significantly from PS4)
- [ ] Lerp alpha for target "hydraulic feel" — to be tuned during Week 2
- [ ] Whether CAT has an existing MQTT broker on their network
- [ ] LAN IP address scheme at demo site (for WebSocket endpoint configuration)
- [ ] Deadman switch — confirm which physical control maps to this in final hardware
- [ ] Does Caterpillar have CAD assets (STEP/SOLIDWORKS) for the backhoe? — needed for Phase 3 3D visualization

---

## Phase 3: 3D Visualization

Once Phase 2 hardware is proven, upgrade the frontend to a 3D visualization using Three.js.

**If Caterpillar can provide CAD assets:**
- Convert STEP/SOLIDWORKS → GLTF using Blender or CAD conversion tooling
- Ensure the model has the correct joint hierarchy (boom, stick, bucket as separate meshes with pivot points)
- Load GLTF in Three.js, drive joint rotations directly from the same WebSocket axis data
- The middleware and data format require zero changes

**If no CAD assets are available:**
- Build procedural geometry in Three.js using Box/Cylinder primitives
- Same joint hierarchy, same axis mapping — just geometric primitives instead of a real model
- Reads as "engineering simulation" aesthetic, appropriate for a prototyping toolkit

The axis mapping and WebSocket contract established in Phase 1/2 carry forward unchanged into Phase 3.
