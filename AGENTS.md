# HMI Prototyping Toolkit — CLAUDE.md

## Working Conventions (Claude, read first)

**Do not use the auto-memory system on this project.** No writes to `~/.claude/projects/.../memory/`,
no `MEMORY.md`, no memory files of any kind. All durable project context — user
preferences, architectural decisions, constraints, non-obvious rules — lives in this
CLAUDE.md. If something would otherwise be saved as a project/feedback/user/reference
memory, add it to this file in the appropriate section instead. If no section fits,
add a short note here under Working Conventions.

---

## Project Overview

This is a hardware-agnostic HMI prototyping toolkit built for Caterpillar. The system
allows an operator to control a browser-based machine visualization using a physical
input device. The middleware sits between the input device and the frontend, transforming
raw hardware signals into clean, normalized control data.

**Primary demo (Phase 1):** a wheel loader lighting control page at `/` — 12 interactive
SVG light fixtures driven by a 6-key function keypad with PDF-spec semantics (ALL /
PROFILE / LOW·HIGH BEAM / ROADING / BEACON / PARKING). Three converging input paths:
direct SVG click, keyboard numpad, and PS4 controller buttons. See the **Lighting
Demo** section below for details.

**Secondary demo:** a backhoe visualizer at `/backhoe` — proves the pipeline works for
analog axes (swing, boom, stick, bucket driven by the PS4 sticks).

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

**Phase 1 — Wheel Loader Lighting Demo (primary) + PS4 Controller Baseline**

The wheel loader lighting page is the primary Caterpillar-facing demo for Phase 1. It
exercises the full data pipeline — hardware input → middleware transform → WebSocket →
browser — using a PS4 controller as the initial input device. The backhoe view runs
alongside as the analog-axis baseline. Both prove the stack works with zero hardware
risk before introducing the ESP32 or industrial joystick.

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
│   ├── data/                        ← design artifacts (gitignored) — standalone SVGs
│   │   ├── wheel-loader-lights.svg  ← source of truth for the loader graphic
│   │   └── keypad-lights.svg        ← source of truth for the 6-key keypad
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                  ← routes: / wheel-loader, /backhoe, /debug
│       ├── hooks/
│       │   └── useHmi.js            ← WebSocket hook, auto-reconnect
│       ├── components/
│       │   └── AxisBar.jsx          ← reusable axis bar for debug view
│       └── pages/
│           ├── WheelLoader.jsx      ← primary demo: 12 fixtures + 6-key keypad
│           ├── WheelLoader.css      ← co-located styles (light states, keypad LEDs)
│           ├── Debug.jsx            ← raw data debug view (axes + buttons)
│           └── Backhoe.jsx          ← split-view backhoe visualizer
└── hardware/                        ← Device firmware
    └── keypad/                      ← 6-button Arduino UNO R3 lighting keypad
        ├── keypad.ino               ← sketch: reads 6 buttons, emits JSON over USB serial
        └── README.md                ← detailed build / wiring / troubleshooting guide
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
  "lights": {
    "ALL":     false,
    "PROFILE": false,
    "BEAM":    false,
    "ROADING": false,
    "BEACON":  false,
    "PARKING": false
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

### Lights conventions

- All light keys are booleans representing **raw held state** — true while the physical
  button is down, false when released
- The frontend does **rising-edge detection** — a held button fires the function action
  once, not continuously. The middleware stays stateless about press events.
- The 6 keys map to **function-level commands** (what the operator wants), NOT
  individual light fixtures. See the **Lighting Demo** section for the full
  function-to-fixture mapping and constraint rules.
- `mode_toggle` and `lights.ALL` share the same physical byte (△). They are different
  views of the same press — consumers read whichever block they care about.

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

## Lighting Demo (Phase 1 Primary)

The wheel loader lighting page at `/` is the primary Caterpillar-facing demo. It
demonstrates the full pipeline against a realistic operator-facing task (lighting control)
instead of abstract axis movement.

### Fixtures (12 total)

Rendered as interactive SVG elements on the loader graphic. Click any fixture directly
to toggle it.

| ID           | Type      | Location                                    |
|--------------|-----------|---------------------------------------------|
| L1 L2 L4 L5  | work      | cab roof, forward-facing                    |
| L3           | beacon    | red rotating beacon, cab roof center        |
| L6           | work      | side, engine hood face                      |
| L7           | yellow    | boom arm, near bucket pivot                 |
| HL           | headlight | cab front; 3-state intensity (off/low/high) |
| FP / RP      | parking   | front + rear marker lamps (amber)           |
| TL / TR      | turn      | dashboard chevrons at top of viewBox (amber)|

### 6-key function keypad

Each key commands a *lighting function*, not an individual fixture. Keypad LEDs are
**derived from current fixture state** — single source of truth is fixtures.

| Key         | Function      | Command behavior                                         |
|-------------|---------------|----------------------------------------------------------|
| K1 ALL      | All Lights    | All work + parking + headlights on/off                   |
| K2 PROFILE  | Profile       | Any work on → all work off. All work off → restore saved |
| K3 BEAM     | Low/High Beam | Toggle low ↔ high (only if headlights already on)        |
| K4 ROADING  | Roading       | Parking + headlights bundle; **OFF is unconditional**    |
| K5 BEACON   | Beacon        | Toggle L3                                                |
| K6 PARKING  | Parking       | Toggle FP + RP together                                  |

### Constraints (enforced frontend-side)

- **High beam requires headlights** — pressing BEAM with headlights off fires a
  status-banner warning, no state change
- **Roading OFF is unconditional** — clears parking + headlights regardless of how
  they were turned on (can be turned on by ALL, ROADING, PARKING, or direct click)
- **Profile auto-save** — manual work-light toggles update the saved profile snapshot;
  other fixtures (headlight, beacon, parking, turn signals) are not part of the profile

### Input paths — all three converge on the same `pressKey()` handler

**Direct SVG click** — loader fixture calls `toggleFixture(id)` (bypasses function layer,
direct fixture mutation). Keypad key calls `pressKey(KEY)` (goes through function layer).

**Keyboard numpad** — spatially mirrors the 2×3 keypad:

```
Numpad 8 9  →  ALL      PROFILE
Numpad 5 6  →  BEAM     ROADING
Numpad 2 3  →  BEACON   PARKING
```

**PS4 controller** (read by middleware, broadcast in `lights` block, edge-detected
in frontend):

| PS4 Button    | Function |
|---------------|----------|
| △ Triangle    | ALL      |
| ○ Circle      | PROFILE  |
| □ Square      | BEAM     |
| ✕ Cross       | ROADING  |
| L1            | BEACON   |
| R1            | PARKING  |

△ still populates `buttons.mode_toggle` for the backhoe view — same physical byte
read, different semantic block.

**Hardware keypad (Arduino)** — a breadboard-built 6-button keypad mirrors the
on-screen layout via USB serial. Middleware auto-detects the port on tick 1, reads
newline-delimited JSON, and OR-merges its state with the PS4 light-buttons before
broadcast. Frontend behavior is identical regardless of which input path fired the
press. See [hardware/keypad/README.md](hardware/keypad/README.md) for the build guide.

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

**CAN Bus (read-only, on-machine input):**

CAN (Controller Area Network) is the internal communication bus on CAT machines — every
sensor, joystick, and controller talks over it using the J1939 protocol. Instead of
wiring a separate input device, we can tap into the machine's existing CAN bus and read
the operator's real control inputs.

1. Connect a CAN-to-USB adapter (PCAN-USB, CANable, or similar) to the machine's CAN bus
2. Obtain a DBC file from CAT defining the relevant signal IDs (joystick axes, button states)
3. Bridge layer parses raw CAN frames → extracts signals using DBC definitions → normalizes
   to the same -1.0 to 1.0 axis format
4. Feed normalized values into the existing transform pipeline
5. The frontend requires **zero changes**

Scope: **read-only / input only** for now. Writing commands back to CAN requires functional
safety certification (ISO 13849) and partnership with CAT's safety engineering team — this
is not in scope for Phase 2.

Hardware options (CAN adapters):
- **PCAN-USB** (Peak Systems) — industry standard, ~$250
- **CANable** — open-source USB adapter, ~$25
- **CSS Electronics CANedge** — logs + streams, native J1939 support

Open questions:
- [ ] Can CAT provide a DBC file or signal list for the target machine's joystick channels?
- [ ] Read-only tap — confirm physical access point on the CAN bus (OBD-II port, diagnostic connector, or direct wiring)
- [ ] Is bidirectional CAN write on their future roadmap? (would require safety certification)

The transform pipeline, WebSocket format, and all safety rules remain identical.

---

## Getting Started

Two commands, two terminals:

```bash
# Terminal 1 — middleware (WebSocket server on :3009).
# Auto-detects PS4 via HID and Arduino keypad via USB serial.
# Runs cleanly even with no hardware plugged in.
cd middleware && npm start

# Terminal 2 — frontend (Vite dev server on :5173)
cd frontend && npm run dev
```

Open <http://localhost:5173/> — the wheel loader lighting page loads by default.
Click any fixture to toggle, press numpad `2 3 5 6 8 9` for the keypad, or use
a PS4 controller / hardware keypad if connected.

**Routes:**
- `/` — wheel loader lighting (primary demo)
- `/backhoe` — axis-driven backhoe visualizer
- `/debug` — raw WebSocket payload inspector

**Alternative middleware path — Node-RED:** [middleware/flows/README.md](middleware/flows/README.md)
has the Node-RED setup (import `ps4_baseline.json`, install `node-red-contrib-gamepad`).
Node-RED is expected to become the primary ingestion path when CAN bus support lands
(see Phase 2 below).

**Hardware keypad** (optional, 6 buttons on a breadboard): [hardware/keypad/README.md](hardware/keypad/README.md)

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

## Phase 3: Figma-to-Frontend Keypad Flows

Convert customer-provided Figma keypad/display designs into interactive React pages
wired to the live data pipeline.

**Workflow:**
1. Receive Figma file or viewer link from customer
2. Use Figma as visual spec — extract layout, component hierarchy, states (active/error/disabled)
3. Build React components from scratch (not auto-export — cleaner for interactive controls)
4. Wire each keypad button/display element to the WebSocket data contract
5. Add as a new page/view alongside existing Backhoe and Debug views

**What Figma gives us:** layout, spacing, colors, typography, state visuals
**What we build:** interaction logic, data binding, state management, hardware mapping

**Extending the data contract:**
- Keypad buttons map to existing or new fields in the canonical message format
- Display elements bind to axis values, button states, or custom telemetry
- New fields added without breaking existing views

**Prerequisites:**
- Customer shares Figma file with edit or dev-mode access
- Flow logic documented (state machines, sequences) beyond just the visual spec
- Confirm whether keypad is physical hardware or touchscreen UI

---

## Phase 4: Bidirectional Output Control

Add command channel so the frontend can drive physical actuators (fans, relays, motors,
lights) through the same middleware and hardware layer.

**Architecture:**

```
Frontend (UI controls) → WebSocket → Middleware → ESP32/Arduino → Actuator (fan, relay, etc.)
```

**Command message format (client → server):**

```json
{
  "command": "set_output",
  "outputs": {
    "fan_speed": 0.75,
    "fan_power": true
  }
}
```

**Implementation:**
1. Add `ws.onmessage` handler in middleware to receive and validate commands
2. Forward validated commands to hardware over MQTT (`hmi/commands/outputs`) or serial
3. Add output UI controls (toggles, sliders) to frontend
4. ESP32/Arduino firmware listens for commands and drives PWM/relay pins
5. Existing input pipeline unchanged — bidirectional runs on the same WebSocket connection

**Safety (low-stakes actuators only — no heavy equipment writes without functional safety review):**
- Validate command values in middleware before forwarding
- Zero all outputs on WebSocket disconnect
- Rate-limit command frequency

---

## Phase 5: 3D Visualization

Upgrade the frontend to a 3D visualization using Three.js.

**If Caterpillar can provide CAD assets:**
- Convert STEP/SOLIDWORKS → GLTF using Blender or CAD conversion tooling
- Ensure the model has the correct joint hierarchy (boom, stick, bucket as separate meshes with pivot points)
- Load GLTF in Three.js, drive joint rotations directly from the same WebSocket axis data
- The middleware and data format require zero changes

**If no CAD assets are available:**
- Build procedural geometry in Three.js using Box/Cylinder primitives
- Same joint hierarchy, same axis mapping — just geometric primitives instead of a real model
- Reads as "engineering simulation" aesthetic, appropriate for a prototyping toolkit

The axis mapping and WebSocket contract carry forward unchanged into this phase.
