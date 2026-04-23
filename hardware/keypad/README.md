# Hardware Lighting Keypad — Build Guide

A 6-button breadboard keypad that drives the wheel loader lighting demo over USB.
Mirrors the on-screen 2×3 keypad (ALL / PROFILE / BEAM / ROADING / BEACON / PARKING).

**No soldering needed.** All components plug into a solderless breadboard.
Total build time: ~30 minutes (most of it wiring).

---

## 1. What you'll use (from the Arduino starter kit)

| Qty | Part |
|----:|------|
| 1 | Arduino UNO R3 |
| 1 | USB-A to USB-B cable (the one that came with the board) |
| 1 | Breadboard |
| 6 | Pushbuttons (tact switches) |
| ~14 | Jumper wires (any color) |

**Not needed:** external resistors (we use the Arduino's internal pull-ups), the 9V battery (the USB cable powers the board), the LCD/LEDs/motors/sensors (save those for later phases).

---

## 2. Understand the pushbutton

A tactile pushbutton has 4 legs in a rectangular pattern. Two pairs are **always connected** internally; pressing the button shorts across to the other pair.

```
       (front)                         (pressed)
      ┌─── 2 ───┐                    ┌─── 2 ───┐
      │         │      becomes       │    ▼    │
      1 ─────── 3                    1 ───▼─── 3
      │         │                    │    ▼    │
      └─── 4 ───┘                    └─── 4 ───┘

   1-2 always joined,              1-3 and 2-4 join while held.
   3-4 always joined.
```

The safe rule: **use diagonally opposite legs.** One leg → digital pin, its diagonal → GND. If you pick legs that are always connected, the button will read "permanently pressed." If that happens, rotate the button 90° and re-wire.

When you push a button into the breadboard, **straddle the center gutter** so two legs land on each side of the gap.

---

## 3. Wire the breadboard

The sketch is pre-configured for these pins:

| Button | Digital Pin | Label on on-screen keypad |
|--------|-------------|---------------------------|
| ALL     | D2 | Numpad 8 |
| PROFILE | D3 | Numpad 9 |
| BEAM    | D5 | Numpad 5 |
| ROADING | D6 | Numpad 6 |
| BEACON  | D8 | Numpad 2 |
| PARKING | D9 | Numpad 3 |

### Layout (3 rows × 2 cols, matches the screen)

```
                           ARDUINO UNO R3
                          ╔════════════════╗
                          ║                ║
                          ║   USB-B        ║ ──────► computer
                          ║                ║
                          ║  [ ] [ ] [ ] [ ]
                          ║   D2  D3  ...  D9
                          ║                ║
                          ║  [GND]         ║
                          ╚═════╤══════════╝
                                │
                                │  (one wire to breadboard ground rail)
                                ▼

BREADBOARD — top-down view (straddling center gutter):

        col A         col B
      ╭───────╮     ╭───────╮
 row1 │  ALL  │     │PROFILE│       → D2 / D3
      ╰───┬───╯     ╰───┬───╯
          │             │
          ▼             ▼
      (leg→GND)     (leg→GND)

      ╭───────╮     ╭───────╮
 row2 │  BEAM │     │ROADING│       → D5 / D6
      ╰───┬───╯     ╰───┬───╯
          ▼             ▼

      ╭───────╮     ╭───────╮
 row3 │BEACON │     │PARKING│       → D8 / D9
      ╰───┬───╯     ╰───┬───╯
          ▼             ▼
```

### Wiring checklist

Work through these in order. Each ✓ is ~30 seconds.

- [ ] Push all 6 buttons into the breadboard, each straddling the center gutter, arranged in a 3×2 grid with comfortable spacing between them.
- [ ] Run a jumper from Arduino **GND** to one of the long ground rails on the breadboard.
- [ ] For each button: jumper **one leg** to the assigned Arduino digital pin (D2/D3/D5/D6/D8/D9).
- [ ] For each button: jumper the **diagonally opposite leg** of the same button to the ground rail.
- [ ] Visual check: no jumpers crossing gutters horizontally except the button bodies themselves; no two pins shorted together.

You should end up with 6 pin-wires + 6 GND-wires + 1 rail-to-Arduino GND = **13 jumpers total**.

---

## 4. Install the Arduino IDE & drivers

1. Download the IDE from <https://www.arduino.cc/en/software> (the desktop version, 2.x).
2. Launch it. It ships with drivers for the official UNO R3 — no extra install needed on macOS or Windows 11.
3. Plug the Arduino into your computer with the USB cable. The IDE's bottom-right corner should show **"Arduino Uno on /dev/tty.usbmodemXXXX"** (mac) or **"COMn"** (Windows). If it says "No board selected," pick Tools → Board → Arduino Uno, and Tools → Port → the usbmodem/COM entry.

---

## 5. Upload the sketch

1. In the Arduino IDE: **File → Open** → select [`hardware/keypad/keypad.ino`](keypad.ino) from this repo.
2. Click the **→ (Upload)** button (or Sketch → Upload). You'll see the onboard TX/RX LEDs flicker; the IDE's bottom pane will show "Done uploading" after ~10 seconds.
3. Open **Tools → Serial Monitor**, set baud rate to **115200** (bottom-right dropdown).
4. You should see a line every ~250ms like:
   ```
   {"ALL":0,"PROFILE":0,"BEAM":0,"ROADING":0,"BEACON":0,"PARKING":0}
   ```
5. Press and hold any button. The corresponding field should flip to `1` while held, back to `0` on release. If two buttons seem to toggle together, they're wired to the same pin — check your jumpers.

**Close the Serial Monitor before starting the middleware** — only one process can hold the serial port at a time.

---

## 6. Run the middleware

```bash
cd middleware
npm start
```

You should see:

```
[hmi-middleware] WebSocket server running at ws://localhost:3009/ws/hmi
[hmi-middleware] Arduino keypad connected on /dev/tty.usbmodemXXXX
```

If the Arduino line doesn't appear, see Troubleshooting below.

**Override the auto-detected port** (rarely needed) by setting `ARDUINO_PORT`:

```bash
ARDUINO_PORT=/dev/tty.usbmodem1101 npm start
```

---

## 7. Run the frontend & test

```bash
cd frontend
npm run dev
```

Open <http://localhost:5173/>. Press a physical button — within ~50ms the status banner should fire (e.g. *"Roading Lights turned on."*) and the loader fixtures should update. The same action works from the PS4 controller and the numpad; they all converge on the same logic.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|--------|--------------|-----|
| Button reads permanently `1` in Serial Monitor | Legs on the same internally-connected pair | Rotate the button 90° |
| Two buttons toggle together | Wired to the same pin, or shorted on the breadboard | Check each pin jumper lands on the correct row |
| Nothing at all on Serial Monitor | Wrong baud rate, or sketch didn't upload | Verify 115200 baud; re-upload the sketch |
| Serial Monitor works but middleware says no Arduino | Serial Monitor is holding the port | Close the Serial Monitor, then re-start the middleware |
| `Arduino keypad connected` briefly then disconnects | Another process grabbed the port | Close other IDEs / monitor tools pointing at the same device |
| Frontend status banner fires twice per press | Debounce too short | Edit `DEBOUNCE_MS` in the sketch (default 15ms) — try 25ms |
| Arduino found but JSON never arrives | Upload succeeded to the wrong board variant | In Tools → Board, confirm "Arduino Uno" is selected |

---

## 9. Extending this later (optional, not needed for the demo)

- **Local status LEDs** — one per button using the red/green/yellow LEDs in the kit. Easiest form: flash while held (no upstream comm needed). Wire each LED to an unused digital pin with a 220Ω resistor in series.
- **LCD status banner** — the 16×2 LCD in the kit can echo the latest banner ("Roading Lights turned on."). Would require bidirectional serial so the middleware pushes state back to the Arduino.
- **Enclosure** — once the layout is locked in, move the buttons from the breadboard to a protoboard or custom PCB. That's when soldering enters the picture.
- **Wireless** — requires an R4 WiFi (or adding an ESP32). Publish to MQTT or directly open a WebSocket to the middleware. Frontend behavior is unchanged.
