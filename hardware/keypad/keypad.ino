/*
 * keypad.ino — 6-button lighting keypad with 6 status LEDs
 *
 * Target: Arduino UNO R3 (or R4)
 * Baud:   115200
 *
 * Inputs:  6 buttons on D6/D7/D8/D9/D10/D11 (INPUT_PULLUP, wired to GND).
 * Outputs: 6 status LEDs on A5..A0 (used as digital outputs), each in series
 *          with a 220Ω resistor to GND. LED column is reversed so the
 *          left-most LED on the breadboard (A5) is ALL and the right-most (A0)
 *          is PARKING.
 *
 * Protocol (USB serial, newline-terminated):
 *   Arduino  →  host : {"ALL":1,"PROFILE":0,"BEAM":0,"ROADING":0,"BEACON":1,"PARKING":0}
 *                      (raw held state — host does rising-edge detection)
 *   host    →  Arduino: L:100010
 *                      (mirror of current function-LED state in KEY_ORDER —
 *                       ALL, PROFILE, BEAM, ROADING, BEACON, PARKING)
 *
 * Key order is fixed: [ALL, PROFILE, BEAM, ROADING, BEACON, PARKING].
 * Must stay in lockstep with KEY_ORDER in frontend/src/pages/keypadBehaviors.js.
 */

const int NUM_KEYS = 6;

const int PINS[NUM_KEYS]    = {  6,     7,        8,      9,        10,      11      };
const int LED_PINS[NUM_KEYS] = { A5,    A4,       A3,     A2,       A1,      A0      };
const char* KEYS[NUM_KEYS]  = { "ALL", "PROFILE", "BEAM", "ROADING", "BEACON", "PARKING" };

const unsigned long DEBOUNCE_MS   = 80;
const unsigned long HEARTBEAT_MS  = 250;
const unsigned long LOOP_DELAY_MS = 5;

bool stableState[NUM_KEYS];
bool candidateState[NUM_KEYS];
unsigned long candidateSince[NUM_KEYS];
unsigned long lastEmit = 0;

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < NUM_KEYS; i++) {
    pinMode(PINS[i], INPUT_PULLUP);
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
    stableState[i]    = false;
    candidateState[i] = false;
    candidateSince[i] = 0;
  }
}

void emitState() {
  Serial.print('{');
  for (int i = 0; i < NUM_KEYS; i++) {
    Serial.print('"'); Serial.print(KEYS[i]); Serial.print("\":");
    Serial.print(stableState[i] ? '1' : '0');
    if (i < NUM_KEYS - 1) Serial.print(',');
  }
  Serial.println('}');
}

// Parse an inbound "L:xxxxxx" line and drive the LED pins accordingly.
void handleIncoming() {
  if (!Serial.available()) return;
  String line = Serial.readStringUntil('\n');
  if (line.startsWith("L:") && line.length() >= 2 + NUM_KEYS) {
    for (int i = 0; i < NUM_KEYS; i++) {
      digitalWrite(LED_PINS[i], line.charAt(2 + i) == '1' ? HIGH : LOW);
    }
  }
}

void loop() {
  handleIncoming();

  unsigned long now = millis();
  bool stateChanged = false;

  for (int i = 0; i < NUM_KEYS; i++) {
    // INPUT_PULLUP: LOW = pressed, HIGH = released.
    bool reading = (digitalRead(PINS[i]) == LOW);

    if (reading != candidateState[i]) {
      candidateState[i] = reading;
      candidateSince[i] = now;
    } else if (reading != stableState[i] && (now - candidateSince[i]) >= DEBOUNCE_MS) {
      stableState[i] = reading;
      stateChanged   = true;
    }
  }

  if (stateChanged || (now - lastEmit) >= HEARTBEAT_MS) {
    emitState();
    lastEmit = now;
  }

  delay(LOOP_DELAY_MS);
}
