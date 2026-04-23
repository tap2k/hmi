// Keypad behavior table — one entry per function key.
//
// Each entry declares:
//   • ledColor — which CSS LED class the key renders with
//   • ledOn(state) — derived bool: is this function's LED currently lit?
//   • press(state) — return a partial state delta { fixtures?, headlight?, status? }
//
// To change what a key does, edit the relevant entry. The switch/state-setter
// plumbing in WheelLoader.jsx does not need to change.
//
// State shape passed in:
//   { fixtures, headlight, savedProfile, allOn, allParkOn, roadingOn, profileMatches }

export const WORK_LIGHTS   = ['light-1', 'light-2', 'light-4', 'light-5', 'light-6', 'light-7'];
export const PARKING_LAMPS = ['light-FP', 'light-RP'];
export const INITIAL_PROFILE = Object.fromEntries(WORK_LIGHTS.map(id => [id, false]));

const setMany = (fixtures, ids, value) => {
  const next = { ...fixtures };
  ids.forEach(id => { next[id] = value; });
  return next;
};

export const KEY_BEHAVIORS = {
  ALL: {
    ledColor: 'white',
    ledOn: (s) => s.allOn,
    press: (s) => {
      const on = !s.allOn;
      return {
        fixtures: setMany(s.fixtures, [...WORK_LIGHTS, ...PARKING_LAMPS], on),
        headlight: on ? 'low' : 'off',
        status: on ? 'All Lights turned on.' : 'All Lights turned off.',
      };
    },
  },

  PROFILE: {
    ledColor: 'cyan',
    ledOn: (s) => s.profileMatches,
    press: (s) => {
      const anyWorkOn = WORK_LIGHTS.some(id => s.fixtures[id]);
      if (anyWorkOn) {
        return {
          fixtures: setMany(s.fixtures, WORK_LIGHTS, false),
          status: 'Lighting Profile turned off.',
        };
      }
      const profileEmpty = !WORK_LIGHTS.some(id => s.savedProfile[id]);
      if (profileEmpty) {
        return { status: 'Profile is empty — toggle lights manually to save one.' };
      }
      return {
        fixtures: { ...s.fixtures, ...s.savedProfile },
        status: 'Lighting Profile turned on.',
      };
    },
  },

  BEAM: {
    ledColor: 'white',
    ledOn: (s) => s.headlight === 'high',
    press: (s) => {
      if (s.headlight === 'off') {
        return { status: 'High Beam requires headlights to be on.' };
      }
      const next = s.headlight === 'low' ? 'high' : 'low';
      return {
        headlight: next,
        status: next === 'high' ? 'High Beam turned on.' : 'High Beam turned off.',
      };
    },
  },

  ROADING: {
    ledColor: 'white',
    ledOn: (s) => s.roadingOn,
    press: (s) => {
      // Roading OFF is unconditional — clears parking + headlights regardless of origin.
      if (s.roadingOn) {
        return {
          fixtures: setMany(s.fixtures, PARKING_LAMPS, false),
          headlight: 'off',
          status: 'Roading Lights turned off.',
        };
      }
      return {
        fixtures: setMany(s.fixtures, PARKING_LAMPS, true),
        headlight: 'low',
        status: 'Roading Lights turned on.',
      };
    },
  },

  BEACON: {
    ledColor: 'red',
    ledOn: (s) => s.fixtures['light-3'],
    press: (s) => {
      const next = !s.fixtures['light-3'];
      return {
        fixtures: { ...s.fixtures, 'light-3': next },
        status: next ? 'Beacon turned on.' : 'Beacon turned off.',
      };
    },
  },

  PARKING: {
    ledColor: 'amber',
    ledOn: (s) => s.allParkOn,
    press: (s) => {
      const next = !s.allParkOn;
      return {
        fixtures: setMany(s.fixtures, PARKING_LAMPS, next),
        status: next ? 'Parking Lights turned on.' : 'Parking Lights turned off.',
      };
    },
  },
};

export const KEY_ORDER = ['ALL', 'PROFILE', 'BEAM', 'ROADING', 'BEACON', 'PARKING'];
