/*
 * keypad.ino — 6-button lighting keypad for the HMI demo
 *
 * Target: Arduino UNO R3 (or R4)
 * Output: newline-delimited JSON on USB serial at 115200 baud
 *
 * Each button is read with INPUT_PULLUP — wire one leg to the digital pin,
 * the other (diagonal) leg to GND. No external resistors needed.
 *
 * Sample line (pressed ALL only):
 *   {"ALL":1,"PROFILE":0,"BEAM":0,"ROADING":0,"BEACON":0,"PARKING":0}
 *
 * The middleware (middleware/server.js) auto-detects the serial port,
 * parses each JSON line, and forwards state into the canonical lights block.
 * Rising-edge detection happens frontend-side, so sending raw held state
 * continuously is correct — do NOT edge-detect here.
 */

const int NUM_KEYS = 6;

// Digital pins — feel free to re-wire; update these to match.
const int PINS[NUM_KEYS]     = {  2,     3,        5,      6,        8,       9       };
const char* KEYS[NUM_KEYS]   = { "ALL", "PROFILE", "BEAM", "ROADING", "BEACON", "PARKING" };

const unsigned long DEBOUNCE_MS      = 15;    // per-pin settling window
const unsigned long HEARTBEAT_MS     = 250;   // emit at least this often so middleware
                                              // sees us even with nothing pressed
const unsigned long LOOP_DELAY_MS    = 5;

bool lastReported[NUM_KEYS];
bool stableState[NUM_KEYS];
bool candidateState[NUM_KEYS];
unsigned long candidateSince[NUM_KEYS];
unsigned long lastEmit = 0;

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < NUM_KEYS; i++) {
    pinMode(PINS[i], INPUT_PULLUP);
    stableState[i]    = false;
    candidateState[i] = false;
    lastReported[i]   = false;
    candidateSince[i] = 0;
  }
}

void emitState() {
  Serial.print('{');
  for (int i = 0; i < NUM_KEYS; i++) {
    Serial.print('"'); Serial.print(KEYS[i]); Serial.print("\":");
    Serial.print(stableState[i] ? '1' : '0');
    if (i < NUM_KEYS - 1) Serial.print(',');
    lastReported[i] = stableState[i];
  }
  Serial.println('}');
}

void loop() {
  unsigned long now = millis();
  bool stateChanged = false;

  for (int i = 0; i < NUM_KEYS; i++) {
    // INPUT_PULLUP: LOW = pressed, HIGH = released. Invert to get "pressed" bool.
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
