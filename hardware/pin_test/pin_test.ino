/*
 * pin_test.ino — minimal diagnostic for the 6-button keypad wiring.
 *
 * Reads D6..D11 with INPUT_PULLUP, prints a 6-character string every 100ms.
 * Each char = state of one pin. 0 = unpressed (HIGH), 1 = pressed (LOW).
 * No debounce, no JSON, no LEDs — just raw reads.
 *
 * Expected output at rest:    000000
 * Pressing the D6 button:     100000
 * Pressing the D11 button:    000001
 * Pressing all six:           111111
 *
 * If only one column ever flips, the wiring on the others is broken
 * (or the buttons themselves are dead). Sketch logic is not at fault.
 */

const int PINS[] = { 6, 7, 8, 9, 10, 11 };
const int N = 6;

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < N; i++) pinMode(PINS[i], INPUT_PULLUP);
}

void loop() {
  for (int i = 0; i < N; i++) {
    Serial.print(digitalRead(PINS[i]) == LOW ? '1' : '0');
  }
  Serial.println();
  delay(100);
}
