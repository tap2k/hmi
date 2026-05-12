import { useState, useEffect, useRef } from 'react';
import './WheelLoader.css';
import { useHmi } from '../hooks/useHmi';
import {
  KEY_BEHAVIORS,
  KEY_ORDER,
  WORK_LIGHTS,
  PARKING_LAMPS,
  INITIAL_PROFILE,
} from './keypadBehaviors';
import DashboardView from '../components/DashboardView';
import LoaderView, { INITIAL_FIXTURES } from '../components/LoaderView';
import KeypadView from '../components/KeypadView';
import ProfilePanel from '../components/ProfilePanel';

// Numpad 2/3/5/6/8/9 mirrors the 2×3 keypad layout spatially.
const NUMPAD_TO_KEY = {
  Numpad8: 'ALL',    Numpad9: 'PROFILE',
  Numpad5: 'BEAM',   Numpad6: 'ROADING',
  Numpad2: 'BEACON', Numpad3: 'PARKING',
};

const KEY_LABELS = {
  ALL:     'K1 — ALL LIGHTS',
  PROFILE: 'K2 — PROFILE',
  BEAM:    'K3 — LOW / HIGH BEAM',
  ROADING: 'K4 — ROADING LIGHTS',
  BEACON:  'K5 — BEACON',
  PARKING: 'K6 — PARKING / MARKER',
};

// ── Profile persistence ────────────────────────────────────────────────────
const PROFILES_STORAGE_KEY = 'hmi.profiles.v1';

const DEFAULT_PROFILES = [
  {
    id: 'loading',
    name: 'Loading',
    // All 6 work lights on — forward-facing floods for a loading operation.
    fixtures: Object.fromEntries(WORK_LIGHTS.map(id => [id, true])),
  },
];

function loadProfiles() {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PROFILES;
    return parsed;
  } catch {
    return DEFAULT_PROFILES;
  }
}

export default function Console() {
  // Single virtual screen, two views.
  const [view, setView] = useState('dashboard');         // 'dashboard' | 'lights'

  // Lighting state lives on the parent so the lights stay on while the
  // operator is looking at the dashboard, and the keypad LEDs reflect it.
  const [fixtures, setFixtures] = useState(INITIAL_FIXTURES);
  const [headlight, setHeadlight] = useState('off');
  const [savedProfile, setSavedProfile] = useState(INITIAL_PROFILE);
  const [status, setStatus] = useState('');
  const [toast, setToast] = useState('');
  const toastTimerRef = useRef(null);

  // ── Profile state ────────────────────────────────────────────────────────
  // Profiles store work-light state only; activating one merges into fixtures.
  // editingProfile holds the draft while the user is in the profile edit view.
  // The "active" profile is derived from fixtures — the dot turns off
  // automatically as soon as the user diverges from the saved configuration.
  const [profiles, setProfiles] = useState(loadProfiles);
  const [editingProfile, setEditingProfile] = useState(null);

  useEffect(() => {
    try { localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles)); }
    catch { /* storage may be disabled; safe to ignore */ }
  }, [profiles]);

  // Auto-clear status banner after 2.5s.
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 1800);
  };
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  // ── Direct fixture toggles (clicks on the loader SVG, live mode) ─────────
  // Manual work-light toggles auto-save into the legacy savedProfile snapshot
  // (still used by the PROFILE keypad key behavior).
  const liveToggleFixture = (id) => {
    const next = !fixtures[id];
    setFixtures(f => ({ ...f, [id]: next }));
    if (WORK_LIGHTS.includes(id)) {
      setSavedProfile(p => ({ ...p, [id]: next }));
    }
  };

  // Edit-mode toggle — only mutates the editing draft's work-light fixtures.
  // Clicks on non-work-light fixtures are ignored (they're not part of profiles).
  const draftToggleFixture = (id) => {
    if (!WORK_LIGHTS.includes(id)) return;
    setEditingProfile(e => e && ({
      ...e,
      fixtures: { ...e.fixtures, [id]: !e.fixtures[id] },
    }));
  };

  const cycleHeadlight = () => {
    // Disable headlight cycling in edit mode — headlight isn't part of profiles.
    if (editingProfile) return;
    setHeadlight(h => (h === 'off' ? 'low' : h === 'low' ? 'high' : 'off'));
  };

  // ── Derived state bundle for keypad LEDs + behavior table ────────────────
  const allWorkOn = WORK_LIGHTS.every(id => fixtures[id]);
  const allParkOn = PARKING_LAMPS.every(id => fixtures[id]);
  const allOn = allWorkOn && allParkOn && headlight !== 'off';
  const roadingOn = allParkOn && headlight !== 'off';
  const profileMatches =
    WORK_LIGHTS.every(id => fixtures[id] === savedProfile[id]) &&
    WORK_LIGHTS.some(id => savedProfile[id]);

  const keypadState = {
    fixtures, headlight, savedProfile,
    allWorkOn, allParkOn, allOn, roadingOn, profileMatches,
  };

  const ledStates = Object.fromEntries(
    Object.entries(KEY_BEHAVIORS).map(([key, b]) => [key, b.ledOn(keypadState)])
  );

  // Derived: the active profile is whichever one's work-light fixtures match
  // the current live state exactly. Returns null on divergence.
  const activeProfileId = (
    profiles.find(p =>
      WORK_LIGHTS.every(id => !!fixtures[id] === !!p.fixtures[id])
    )?.id ?? null
  );

  // ── Profile actions ──────────────────────────────────────────────────────
  const activateProfile = (profile) => {
    // Merge work-light state from the profile onto live fixtures; leave
    // non-work-light fixtures (headlight, parking, beacon, turn) alone.
    setFixtures(f => ({ ...f, ...profile.fixtures }));
    setSavedProfile(profile.fixtures);
  };

  const startEdit = (profile) => {
    setEditingProfile({
      id: profile.id,
      name: profile.name,
      fixtures: { ...profile.fixtures },
      isNew: false,
    });
  };

  const startAdd = () => {
    const blank = Object.fromEntries(WORK_LIGHTS.map(id => [id, false]));
    setEditingProfile({
      id: `profile-${Date.now()}`,
      name: 'New Profile',
      fixtures: blank,
      isNew: true,
    });
  };

  const saveEdit = () => {
    if (!editingProfile) return;
    const saved = {
      id: editingProfile.id,
      name: editingProfile.name.trim() || 'Untitled',
      fixtures: editingProfile.fixtures,
    };
    setProfiles(ps => {
      if (editingProfile.isNew) return [...ps, saved];
      return ps.map(p => (p.id === saved.id ? saved : p));
    });
    setEditingProfile(null);
  };

  const cancelEdit = () => setEditingProfile(null);

  const deleteEdit = () => {
    if (!editingProfile || editingProfile.isNew) return;
    const id = editingProfile.id;
    setProfiles(ps => ps.filter(p => p.id !== id));
    setEditingProfile(null);
  };

  const onEditNameChange = (name) => {
    setEditingProfile(e => e && ({ ...e, name }));
  };

  // ── Keypad press dispatcher: view determines behavior ────────────────────
  // Dashboard view → acknowledgement toast (no lighting side effects).
  // Lights view → existing behavior table (suppressed while editing a profile).
  const handleKeyPress = (key) => {
    if (view === 'dashboard') {
      showToast(`${KEY_LABELS[key] || key} pressed`);
      return;
    }
    if (editingProfile) return;
    const behavior = KEY_BEHAVIORS[key];
    if (!behavior) return;
    const delta = behavior.press(keypadState);
    if (delta.fixtures  !== undefined) setFixtures(delta.fixtures);
    if (delta.headlight !== undefined) setHeadlight(delta.headlight);
    if (delta.status    !== undefined) setStatus(delta.status);
  };

  // Listeners need the freshest dispatcher (it closes over current view + state).
  const handleKeyPressRef = useRef(handleKeyPress);
  handleKeyPressRef.current = handleKeyPress;

  // Keyboard: numpad 2/3/5/6/8/9
  useEffect(() => {
    const onKeyDown = (e) => {
      const key = NUMPAD_TO_KEY[e.code];
      if (!key) return;
      e.preventDefault();
      handleKeyPressRef.current(key);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // PS4 controller + hardware keypad: rising-edge detection on lights.<KEY>
  const { data: hmi, send } = useHmi();
  const prevLightsRef = useRef({});
  useEffect(() => {
    const lights = hmi.lights || {};
    const prev = prevLightsRef.current;
    for (const key of Object.keys(lights)) {
      if (lights[key] && !prev[key]) {
        handleKeyPressRef.current(key);
      }
    }
    prevLightsRef.current = lights;
  }, [hmi.lights]);

  // Mirror LED state down to the Arduino hardware keypad.
  const ledBits = KEY_ORDER.map(k => ledStates[k] ? '1' : '0').join('');
  useEffect(() => {
    send({ type: 'leds', bits: ledBits });
  }, [ledBits, send]);

  // ── What the loader renders ──────────────────────────────────────────────
  // In edit mode, work-light fixtures show the draft (live preview of the
  // profile being edited); other fixtures still show live machine state.
  const loaderFixtures = editingProfile
    ? { ...fixtures, ...editingProfile.fixtures }
    : fixtures;
  const loaderToggleFixture = editingProfile ? draftToggleFixture : liveToggleFixture;

  const screenWrapStyle = view === 'lights' ? styles.screenWrapLights : styles.screenWrap;

  return (
    <div style={styles.page}>
      <div style={styles.bannerSlot}>
        {status && <div style={styles.banner}>{status}</div>}
      </div>

      <div style={styles.layout}>
        <div style={screenWrapStyle}>
          {view === 'dashboard' ? (
            <DashboardView
              onLightsClick={() => setView('lights')}
              style={styles.screenSvg}
            />
          ) : (
            <>
              <LoaderView
                fixtures={loaderFixtures}
                headlight={headlight}
                toggleFixture={loaderToggleFixture}
                cycleHeadlight={cycleHeadlight}
                onHomeClick={() => { setEditingProfile(null); setView('dashboard'); }}
                style={styles.loaderSvg}
              />
              <ProfilePanel
                profiles={profiles}
                activeProfileId={activeProfileId}
                editingProfile={editingProfile}
                onActivate={activateProfile}
                onEdit={startEdit}
                onAdd={startAdd}
                onSave={saveEdit}
                onCancel={cancelEdit}
                onDelete={deleteEdit}
                onEditNameChange={onEditNameChange}
              />
            </>
          )}
          {view === 'dashboard' && toast && (
            <div style={styles.toast}>{toast}</div>
          )}
        </div>

        <KeypadView
          ledStates={ledStates}
          onPress={handleKeyPress}
          style={styles.keypad}
        />
      </div>
    </div>
  );
}

const screenWrapBase = {
  position: 'relative',
  display: 'flex',
  width: '100%',
  borderRadius: 8,
  overflow: 'hidden',
  boxShadow: '0 0 0 2px #1a1a1a, 0 12px 32px rgba(0,0,0,0.45)',
};

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  bannerSlot: {
    minHeight: 30,
    display: 'flex',
    alignItems: 'center',
  },
  banner: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 12,
    letterSpacing: '0.12em',
    color: '#c8dce8',
    backgroundColor: '#0f1e2a',
    border: '1px solid #2a7aaa',
    borderRadius: 4,
    padding: '6px 18px',
  },
  layout: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 1200,
  },
  screenWrap: {
    ...screenWrapBase,
    maxWidth: 920,
  },
  screenWrapLights: {
    ...screenWrapBase,
    maxWidth: 1140,                          // 920 (SVG) + 220 (panel)
  },
  screenSvg: {
    display: 'block',
    width: '100%',
    height: 'auto',
  },
  loaderSvg: {
    display: 'block',
    flex: '1 1 auto',
    minWidth: 0,
    width: '100%',
    height: 'auto',
  },
  toast: {
    position: 'absolute',
    bottom: '7%',
    left: '50%',
    transform: 'translateX(-50%)',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 12,
    letterSpacing: '0.12em',
    color: '#ffffff',
    backgroundColor: 'rgba(10, 10, 10, 0.88)',
    border: '1px solid rgba(255, 139, 61, 0.7)',
    borderRadius: 5,
    padding: '7px 16px',
    pointerEvents: 'none',
    boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
  },
  keypad: {
    flex: '0 0 auto',
    width: 312,
    height: 290,
    display: 'block',
  },
};
