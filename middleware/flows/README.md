# Node-RED Flows

## Prerequisites

```bash
# Install Node-RED globally
npm install -g --unsafe-perm node-red

# Install required nodes
cd ~/.node-red
npm install node-red-contrib-gamepad     # PS4 / gamepad input (Phase 1)
npm install node-red-node-serialport     # Arduino serial input (Phase 2 wired)
npm install node-red-contrib-mqtt-broker # MQTT broker (Phase 2 wireless, if running locally)
```

## Importing a flow

1. Start Node-RED: `node-red`
2. Open [http://localhost:1880](http://localhost:1880)
3. Click the hamburger menu (top right) → **Import**
4. Click **select a file to import** and choose the flow JSON
5. Click **Import**, then **Deploy**

## Available flows

| File | Phase | Transport | Status |
|------|-------|-----------|--------|
| `ps4_baseline.json` | 1 | PS4 gamepad (USB/Bluetooth) | Ready |
| `esp32_joystick.json` | 2 | ESP32 → MQTT | Future |
| `arduino_serial.json` | 2 | Arduino → USB serial | Future |

## WebSocket endpoint

All flows broadcast to:

```
ws://localhost:1880/ws/hmi
```

Replace `localhost` with the machine's LAN IP for multi-device demo setups.

## Verifying the pipeline

Open a browser console and run:

```javascript
const ws = new WebSocket('ws://localhost:1880/ws/hmi');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

You should see the canonical JSON format with axes updating as you move the sticks.

## PS4 controller notes

- Connect via USB or Bluetooth before starting Node-RED
- The gamepad node defaults to controller index `0` — if multiple controllers are connected, adjust the index in the node config
- Left/right stick Y axes are inverted by the profile map node (PS4 hardware quirk)
- The 50ms inject node drives the lerp decay when sticks are released — do not delete it
