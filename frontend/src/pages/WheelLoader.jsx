import { useState, useEffect, useRef } from 'react';
import './WheelLoader.css';
import { useHmi } from '../hooks/useHmi';

// Numpad 2/3/5/6/8/9 mirrors the 2×3 keypad layout spatially:
//   Numpad 8 9 → ALL      PROFILE
//   Numpad 5 6 → BEAM     ROADING
//   Numpad 2 3 → BEACON   PARKING
const NUMPAD_TO_KEY = {
  Numpad8: 'ALL',    Numpad9: 'PROFILE',
  Numpad5: 'BEAM',   Numpad6: 'ROADING',
  Numpad2: 'BEACON', Numpad3: 'PARKING',
};

const FIXTURE_TYPE = {
  'light-1': 'work', 'light-2': 'work', 'light-4': 'work', 'light-5': 'work', 'light-6': 'work',
  'light-3': 'beacon',
  'light-7': 'yellow',
  'light-FP': 'parking',
  'light-RP': 'parking',
  'turn-L': 'turn',
  'turn-R': 'turn',
};

const FIXTURE_IDS = Object.keys(FIXTURE_TYPE);
const INITIAL_FIXTURES = Object.fromEntries(FIXTURE_IDS.map(id => [id, false]));

// Work-light subset (what the PROFILE key controls and auto-saves)
const WORK_LIGHTS = ['light-1', 'light-2', 'light-4', 'light-5', 'light-6', 'light-7'];
const PARKING_LAMPS = ['light-FP', 'light-RP'];
const INITIAL_PROFILE = Object.fromEntries(WORK_LIGHTS.map(id => [id, false]));

export default function WheelLoader() {
  const [fixtures, setFixtures] = useState(INITIAL_FIXTURES);
  const [headlight, setHeadlight] = useState('off');            // 'off' | 'low' | 'high'
  const [savedProfile, setSavedProfile] = useState(INITIAL_PROFILE);
  const [status, setStatus] = useState('');

  // Auto-clear status banner after 2.5s
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 2500);
    return () => clearTimeout(t);
  }, [status]);

  // ── Direct fixture manipulation (loader SVG clicks) ──────────────────────
  // Manual work-light toggles auto-save into the profile snapshot.
  const toggleFixture = (id) => {
    const next = !fixtures[id];
    setFixtures(f => ({ ...f, [id]: next }));
    if (WORK_LIGHTS.includes(id)) {
      setSavedProfile(p => ({ ...p, [id]: next }));
    }
  };

  const cycleHeadlight = () => {
    setHeadlight(h => (h === 'off' ? 'low' : h === 'low' ? 'high' : 'off'));
  };

  // ── Derived state (keypad LEDs reflect current fixture state) ────────────
  const allWorkOn = WORK_LIGHTS.every(id => fixtures[id]);
  const allParkOn = PARKING_LAMPS.every(id => fixtures[id]);
  const allOn = allWorkOn && allParkOn && headlight !== 'off';
  const roadingOn = allParkOn && headlight !== 'off';
  const profileMatches =
    WORK_LIGHTS.every(id => fixtures[id] === savedProfile[id]) &&
    WORK_LIGHTS.some(id => savedProfile[id]);

  const ledStates = {
    ALL:     allOn,
    PROFILE: profileMatches,
    BEAM:    headlight === 'high',
    ROADING: roadingOn,
    BEACON:  fixtures['light-3'],
    PARKING: allParkOn,
  };

  // ── Keypad press handlers ─────────────────────────────────────────────────
  const pressKey = (key) => {
    switch (key) {
      case 'ALL': {
        if (allOn) {
          setFixtures(f => {
            const n = { ...f };
            [...WORK_LIGHTS, ...PARKING_LAMPS].forEach(id => (n[id] = false));
            return n;
          });
          setHeadlight('off');
          setStatus('All Lights turned off.');
        } else {
          setFixtures(f => {
            const n = { ...f };
            [...WORK_LIGHTS, ...PARKING_LAMPS].forEach(id => (n[id] = true));
            return n;
          });
          setHeadlight('low');
          setStatus('All Lights turned on.');
        }
        break;
      }
      case 'PROFILE': {
        const anyWorkOn = WORK_LIGHTS.some(id => fixtures[id]);
        if (anyWorkOn) {
          // Per PDF: "All Work Lights Off" action
          setFixtures(f => {
            const n = { ...f };
            WORK_LIGHTS.forEach(id => (n[id] = false));
            return n;
          });
          setStatus('Lighting Profile turned off.');
        } else {
          const profileEmpty = !WORK_LIGHTS.some(id => savedProfile[id]);
          if (profileEmpty) {
            setStatus('Profile is empty — toggle lights manually to save one.');
          } else {
            setFixtures(f => ({ ...f, ...savedProfile }));
            setStatus('Lighting Profile turned on.');
          }
        }
        break;
      }
      case 'BEAM': {
        if (headlight === 'off') {
          setStatus('High Beam requires headlights to be on.');
          return;
        }
        const next = headlight === 'low' ? 'high' : 'low';
        setHeadlight(next);
        setStatus(next === 'high' ? 'High Beam turned on.' : 'High Beam turned off.');
        break;
      }
      case 'ROADING': {
        if (roadingOn) {
          // Roading OFF is unconditional — clears parking + headlights regardless of origin
          setFixtures(f => ({ ...f, 'light-FP': false, 'light-RP': false }));
          setHeadlight('off');
          setStatus('Roading Lights turned off.');
        } else {
          setFixtures(f => ({ ...f, 'light-FP': true, 'light-RP': true }));
          setHeadlight('low');
          setStatus('Roading Lights turned on.');
        }
        break;
      }
      case 'BEACON': {
        const next = !fixtures['light-3'];
        setFixtures(f => ({ ...f, 'light-3': next }));
        setStatus(next ? 'Beacon turned on.' : 'Beacon turned off.');
        break;
      }
      case 'PARKING': {
        if (allParkOn) {
          setFixtures(f => ({ ...f, 'light-FP': false, 'light-RP': false }));
          setStatus('Parking Lights turned off.');
        } else {
          setFixtures(f => ({ ...f, 'light-FP': true, 'light-RP': true }));
          setStatus('Parking Lights turned on.');
        }
        break;
      }
      default:
        break;
    }
  };

  // ── Keyboard: numpad 2/3/5/6/8/9 ──────────────────────────────────────────
  // Use a ref so the keydown listener always calls the latest pressKey
  // (which closes over current state) without re-registering each render.
  const pressKeyRef = useRef(pressKey);
  pressKeyRef.current = pressKey;

  useEffect(() => {
    const onKeyDown = (e) => {
      const key = NUMPAD_TO_KEY[e.code];
      if (!key) return;
      e.preventDefault();
      pressKeyRef.current(key);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ── PS4 controller: rising-edge detection on lights.<KEY> ─────────────────
  // Middleware sends raw held state (true while button is down). We fire
  // pressKey only on the false→true transition so a held button = one action.
  const { data: hmi } = useHmi();
  const prevLightsRef = useRef({});

  useEffect(() => {
    const lights = hmi.lights || {};
    const prev = prevLightsRef.current;
    for (const key of Object.keys(lights)) {
      if (lights[key] && !prev[key]) {
        pressKeyRef.current(key);
      }
    }
    prevLightsRef.current = lights;
  }, [hmi.lights]);

  // ── Class-name helpers ────────────────────────────────────────────────────
  const cls = (id) => `${fixtures[id] ? 'light-on' : 'light-off'} ${FIXTURE_TYPE[id]}`;
  const hlCls = headlight === 'off'
    ? 'light-off headlight'
    : `light-on headlight ${headlight}-beam`;
  const keyCls = (key, led) => `${ledStates[key] ? 'key-on' : 'key-off'} led-${led}`;

  return (
    <div style={styles.page}>
      <div style={styles.bannerSlot}>
        {status && <div style={styles.banner}>{status}</div>}
      </div>

      <div style={styles.layout}>
        {/* ───── LOADER ───── */}
        <svg
          id="loader"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 920 400"
          style={styles.loader}
        >
          <defs>
            <filter id="f-work"      x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="8"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="f-yellow"    x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="9"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="f-red"       x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="7"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="f-headlight" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="f-parking"   x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="6"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="f-turn"      x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="9"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>

            <radialGradient id="rg-work">     <stop offset="0%" stopColor="#fffde0" stopOpacity=".55"/><stop offset="100%" stopColor="#fffde0" stopOpacity="0"/></radialGradient>
            <radialGradient id="rg-yellow">   <stop offset="0%" stopColor="#f8d040" stopOpacity=".6"/> <stop offset="100%" stopColor="#f8d040" stopOpacity="0"/></radialGradient>
            <radialGradient id="rg-beacon">   <stop offset="0%" stopColor="#ff3030" stopOpacity=".55"/><stop offset="100%" stopColor="#ff3030" stopOpacity="0"/></radialGradient>
            <radialGradient id="rg-rear">     <stop offset="0%" stopColor="#ff2020" stopOpacity=".5"/> <stop offset="100%" stopColor="#ff2020" stopOpacity="0"/></radialGradient>
            <radialGradient id="rg-headlight"><stop offset="0%" stopColor="#fff8d0" stopOpacity=".75"/><stop offset="100%" stopColor="#fff8d0" stopOpacity="0"/></radialGradient>
            <radialGradient id="rg-parking">  <stop offset="0%" stopColor="#ff8030" stopOpacity=".7"/> <stop offset="100%" stopColor="#ff8030" stopOpacity="0"/></radialGradient>
            <radialGradient id="rg-turn">     <stop offset="0%" stopColor="#ffaa20" stopOpacity=".7"/> <stop offset="100%" stopColor="#ffaa20" stopOpacity="0"/></radialGradient>

            <pattern id="tread" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(42)">
              <rect width="16" height="16" fill="#181d24"/>
              <rect width="7"  height="16" fill="#1e232c"/>
            </pattern>

            <linearGradient id="lg-engine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#3e4655"/>
              <stop offset="100%" stopColor="#22262e"/>
            </linearGradient>
            <linearGradient id="lg-cab" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#535f72"/>
              <stop offset="60%"  stopColor="#3a4255"/>
              <stop offset="100%" stopColor="#272e3e"/>
            </linearGradient>
            <linearGradient id="lg-front" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%"   stopColor="#3c4452"/>
              <stop offset="100%" stopColor="#272d38"/>
            </linearGradient>
            <linearGradient id="lg-arm" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#3a4050"/>
              <stop offset="100%" stopColor="#252b35"/>
            </linearGradient>
            <linearGradient id="lg-bucket" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%"   stopColor="#3c4355"/>
              <stop offset="100%" stopColor="#282e3c"/>
            </linearGradient>
          </defs>

          <rect width="920" height="400" fill="#181c22"/>

          {/* ENGINE HOOD */}
          <path d="M722 148 L858 148 L866 160 L870 268 L858 278 L722 278 Z" fill="url(#lg-engine)" stroke="#3a4252" strokeWidth="1.5"/>
          <path d="M728 162 L856 162 L863 172 L863 262 L728 262 Z" fill="#2a3040" stroke="#333c4c" strokeWidth="1"/>
          <line x1="775" y1="162" x2="775" y2="262" stroke="#303848" strokeWidth="1"/>
          <line x1="818" y1="162" x2="818" y2="262" stroke="#303848" strokeWidth="1"/>
          <rect x="820" y="98" width="18" height="54" rx="5" fill="#232b38" stroke="#3a4252" strokeWidth="1.2"/>
          <ellipse cx="829" cy="98" rx="10" ry="5" fill="#1a2230" stroke="#3a4252" strokeWidth="1"/>
          <path d="M858 158 L882 164 L884 274 L858 278 Z" fill="#1c2230" stroke="#2a3242" strokeWidth="1.5"/>
          <line x1="870" y1="180" x2="870" y2="264" stroke="#252e3e" strokeWidth="1.5"/>
          <path d="M722 148 L858 148 L866 160 L722 160 Z" fill="#3c4558" stroke="#485568" strokeWidth="1"/>
          <rect x="625" y="270" width="190" height="20" rx="4" fill="#191d28" stroke="#283040" strokeWidth="1"/>

          {/* CAB */}
          <path d="M392 90 L720 90 L726 102 L730 278 L392 278 Z" fill="url(#lg-cab)" stroke="#4a5670" strokeWidth="1.5"/>
          <path d="M400 104 L582 104 L582 152 L400 152 Z" fill="#142030" stroke="#223848" strokeWidth="1.5" opacity="0.92"/>
          <line x1="490" y1="104" x2="490" y2="152" stroke="#1e3545" strokeWidth="2"/>
          <path d="M406 108 L438 108 L434 126 L406 126 Z" fill="#fff" opacity="0.045"/>
          <path d="M496 108 L528 108 L526 122 L496 122 Z" fill="#fff" opacity="0.04"/>
          <path d="M590 104 L720 104 L724 152 L590 152 Z" fill="#142028" stroke="#1e3040" strokeWidth="1.5" opacity="0.88"/>
          <line x1="656" y1="104" x2="658" y2="152" stroke="#1a2e3c" strokeWidth="1"/>
          <rect x="592" y="106" width="24" height="44" fill="#fff" opacity="0.03"/>
          <rect x="392" y="90" width="12" height="188" fill="#2e3c52" stroke="#3e4e66" strokeWidth="1"/>
          <rect x="714" y="90" width="12" height="188" fill="#2e3c52" stroke="#3e4e66" strokeWidth="1"/>
          <line x1="392" y1="160" x2="726" y2="160" stroke="#363f52" strokeWidth="2"/>
          <rect x="703" y="124" width="14" height="7" rx="3" fill="#4a5870"/>
          <rect x="388" y="82" width="340" height="12" rx="4" fill="#3a4560" stroke="#4e5f78" strokeWidth="1.5"/>
          <rect x="392" y="76" width="332" height="10" rx="3" fill="#2e3a50" stroke="#404e68" strokeWidth="1.2"/>

          {/* ARTICULATION JOINT */}
          <circle cx="392" cy="232" r="24" fill="#181d28" stroke="#3a4255" strokeWidth="2"/>
          <circle cx="392" cy="232" r="11" fill="#232b3a" stroke="#3a4255" strokeWidth="1.5"/>
          <circle cx="392" cy="232" r="4.5" fill="#1c2330"/>

          {/* FRONT FRAME */}
          <path d="M150 180 L392 180 L392 278 L150 278 Z" fill="url(#lg-front)" stroke="#3a4252" strokeWidth="1.5"/>
          <line x1="228" y1="180" x2="228" y2="278" stroke="#303848" strokeWidth="1"/>
          <line x1="308" y1="180" x2="308" y2="278" stroke="#303848" strokeWidth="1"/>
          <rect x="150" y="272" width="180" height="20" rx="4" fill="#191d28" stroke="#283040" strokeWidth="1"/>
          <rect x="130" y="204" width="22" height="74" rx="2" fill="#1c2232" stroke="#283244" strokeWidth="1"/>
          <line x1="130" y1="218" x2="152" y2="218" stroke="#283244" strokeWidth="2"/>
          <line x1="130" y1="234" x2="152" y2="234" stroke="#283244" strokeWidth="2"/>
          <line x1="130" y1="250" x2="152" y2="250" stroke="#283244" strokeWidth="2"/>
          <line x1="130" y1="266" x2="152" y2="266" stroke="#283244" strokeWidth="2"/>

          {/* LIFT ARMS */}
          <path d="M360 192 C295 188, 212 196, 132 235 L122 250 L138 260 L150 248 C224 213, 302 204, 366 206 Z" fill="url(#lg-arm)" stroke="#3a4252" strokeWidth="1.5"/>
          <path d="M360 220 C295 217, 208 226, 126 262 L118 276 L136 284 L146 272 C217 242, 298 232, 365 233 Z" fill="url(#lg-arm)" stroke="#3a4252" strokeWidth="1"/>
          <path d="M330 186 C258 197, 190 216, 132 250" stroke="#1d2535" strokeWidth="11" fill="none" strokeLinecap="round"/>
          <path d="M330 186 C258 197, 190 216, 132 250" stroke="#3b4c65" strokeWidth="7"  fill="none" strokeLinecap="round"/>
          <path d="M374 173 C300 180, 228 192, 160 224" stroke="#191f2e" strokeWidth="14" fill="none" strokeLinecap="round"/>
          <path d="M374 173 C300 180, 228 192, 160 224" stroke="#3d4f68" strokeWidth="9"  fill="none" strokeLinecap="round"/>

          {/* BUCKET */}
          <path d="M24 228 L138 218 L148 264 L140 284 L26 296 Z" fill="url(#lg-bucket)" stroke="#3a4252" strokeWidth="1.5"/>
          <path d="M24 228 L38 222 L38 284 L24 296 Z" fill="#212838" stroke="#3a4252" strokeWidth="1"/>
          <path d="M24 296 L140 284" stroke="#48566a" strokeWidth="4" strokeLinecap="round"/>
          <path d="M30 296 L26 314 L38 296" fill="#282e3e" stroke="#3a4252" strokeWidth="1"/>
          <path d="M47 294 L43 312 L55 294" fill="#282e3e" stroke="#3a4252" strokeWidth="1"/>
          <path d="M64 292 L60 310 L72 292" fill="#282e3e" stroke="#3a4252" strokeWidth="1"/>
          <path d="M81 290 L77 307 L89 290" fill="#282e3e" stroke="#3a4252" strokeWidth="1"/>
          <path d="M98 288 L94 305 L106 288" fill="#282e3e" stroke="#3a4252" strokeWidth="1"/>
          <path d="M115 286 L111 302 L123 286" fill="#282e3e" stroke="#3a4252" strokeWidth="1"/>
          <path d="M38 224 L138 218 L146 260 L38 270 Z" fill="#1c2230" opacity="0.45"/>

          {/* WHEELS */}
          <circle cx="208" cy="320" r="70"  fill="url(#tread)" stroke="#232a38" strokeWidth="2.5"/>
          <circle cx="208" cy="320" r="53"  fill="#161b22"     stroke="#2e3846" strokeWidth="2"/>
          <circle cx="208" cy="320" r="28"  fill="#1b2030"     stroke="#2e3846" strokeWidth="1.5"/>
          <circle cx="208" cy="320" r="13"  fill="#242c3a"     stroke="#38465a" strokeWidth="1"/>
          <circle cx="208" cy="291" r="5"   fill="#2e3846"/>
          <circle cx="208" cy="349" r="5"   fill="#2e3846"/>
          <circle cx="179" cy="320" r="5"   fill="#2e3846"/>
          <circle cx="237" cy="320" r="5"   fill="#2e3846"/>
          <circle cx="187" cy="299" r="3.5" fill="#283040"/>
          <circle cx="229" cy="299" r="3.5" fill="#283040"/>
          <circle cx="187" cy="341" r="3.5" fill="#283040"/>
          <circle cx="229" cy="341" r="3.5" fill="#283040"/>

          <circle cx="762" cy="318" r="74"  fill="url(#tread)" stroke="#232a38" strokeWidth="2.5"/>
          <circle cx="762" cy="318" r="56"  fill="#161b22"     stroke="#2e3846" strokeWidth="2"/>
          <circle cx="762" cy="318" r="30"  fill="#1b2030"     stroke="#2e3846" strokeWidth="1.5"/>
          <circle cx="762" cy="318" r="14"  fill="#242c3a"     stroke="#38465a" strokeWidth="1"/>
          <circle cx="762" cy="287" r="5.5" fill="#2e3846"/>
          <circle cx="762" cy="349" r="5.5" fill="#2e3846"/>
          <circle cx="731" cy="318" r="5.5" fill="#2e3846"/>
          <circle cx="793" cy="318" r="5.5" fill="#2e3846"/>
          <circle cx="740" cy="296" r="4"   fill="#283040"/>
          <circle cx="784" cy="296" r="4"   fill="#283040"/>
          <circle cx="740" cy="340" r="4"   fill="#283040"/>
          <circle cx="784" cy="340" r="4"   fill="#283040"/>

          <ellipse cx="460" cy="388" rx="410" ry="9" fill="#0b1016" opacity="0.8"/>

          {/* FIXTURES */}
          <g id="light-1" className={cls('light-1')} onClick={() => toggleFixture('light-1')}>
            <ellipse className="light-glow" cx="418" cy="68" rx="40" ry="28" fill="url(#rg-work)" opacity="1"/>
            <rect className="light-body" x="402" y="56" width="32" height="24" rx="4" fill="#eef3ff" filter="url(#f-work)"/>
            <rect className="light-lens" x="405" y="59" width="26" height="18" rx="2.5" fill="#d8e8ff" opacity="0.78"/>
            <line x1="418" y1="59" x2="418" y2="77" stroke="#b0c8f0" strokeWidth="1" opacity="0.5"/>
            <line x1="405" y1="68" x2="431" y2="68" stroke="#b0c8f0" strokeWidth="1" opacity="0.5"/>
            <rect x="410" y="78" width="10" height="6" rx="1.5" fill="#242e42"/>
          </g>

          <g id="light-2" className={cls('light-2')} onClick={() => toggleFixture('light-2')}>
            <ellipse className="light-glow" cx="468" cy="68" rx="40" ry="28" fill="url(#rg-work)" opacity="1"/>
            <rect className="light-body" x="452" y="56" width="32" height="24" rx="4" fill="#eef3ff" filter="url(#f-work)"/>
            <rect className="light-lens" x="455" y="59" width="26" height="18" rx="2.5" fill="#d8e8ff" opacity="0.78"/>
            <line x1="468" y1="59" x2="468" y2="77" stroke="#b0c8f0" strokeWidth="1" opacity="0.5"/>
            <line x1="455" y1="68" x2="481" y2="68" stroke="#b0c8f0" strokeWidth="1" opacity="0.5"/>
            <rect x="460" y="78" width="10" height="6" rx="1.5" fill="#242e42"/>
          </g>

          <g id="light-3" className={cls('light-3')} onClick={() => toggleFixture('light-3')}>
            <ellipse className="light-glow" cx="558" cy="58" rx="55" ry="36" fill="url(#rg-beacon)" opacity="1"/>
            <rect x="542" y="78" width="32" height="9" rx="3" fill="#1c2434" stroke="#3a4455" strokeWidth="1"/>
            <rect className="light-body" x="546" y="52" width="24" height="28" rx="5" fill="#e02020" filter="url(#f-red)"/>
            <line x1="546" y1="61" x2="570" y2="61" stroke="#b80e0e" strokeWidth="1.5" opacity="0.55"/>
            <line x1="546" y1="67" x2="570" y2="67" stroke="#b80e0e" strokeWidth="1.5" opacity="0.55"/>
            <line x1="546" y1="73" x2="570" y2="73" stroke="#b80e0e" strokeWidth="1.5" opacity="0.55"/>
            <ellipse cx="553" cy="57" rx="5" ry="3" fill="#ff9090" opacity="0.42"/>
          </g>

          <g id="light-4" className={cls('light-4')} onClick={() => toggleFixture('light-4')}>
            <ellipse className="light-glow" cx="644" cy="68" rx="40" ry="28" fill="url(#rg-work)" opacity="1"/>
            <rect className="light-body" x="628" y="56" width="32" height="24" rx="4" fill="#eef3ff" filter="url(#f-work)"/>
            <rect className="light-lens" x="631" y="59" width="26" height="18" rx="2.5" fill="#d8e8ff" opacity="0.78"/>
            <line x1="644" y1="59" x2="644" y2="77" stroke="#b0c8f0" strokeWidth="1" opacity="0.5"/>
            <line x1="631" y1="68" x2="657" y2="68" stroke="#b0c8f0" strokeWidth="1" opacity="0.5"/>
            <rect x="636" y="78" width="10" height="6" rx="1.5" fill="#242e42"/>
          </g>

          <g id="light-5" className={cls('light-5')} onClick={() => toggleFixture('light-5')}>
            <ellipse className="light-glow" cx="698" cy="68" rx="40" ry="28" fill="url(#rg-work)" opacity="1"/>
            <rect className="light-body" x="682" y="56" width="32" height="24" rx="4" fill="#eef3ff" filter="url(#f-work)"/>
            <rect className="light-lens" x="685" y="59" width="26" height="18" rx="2.5" fill="#d8e8ff" opacity="0.78"/>
            <line x1="698" y1="59" x2="698" y2="77" stroke="#b0c8f0" strokeWidth="1" opacity="0.5"/>
            <line x1="685" y1="68" x2="711" y2="68" stroke="#b0c8f0" strokeWidth="1" opacity="0.5"/>
            <rect x="690" y="78" width="10" height="6" rx="1.5" fill="#242e42"/>
          </g>

          <g id="light-6" className={cls('light-6')} onClick={() => toggleFixture('light-6')}>
            <ellipse className="light-glow" cx="902" cy="200" rx="36" ry="24" fill="url(#rg-work)" opacity="1"/>
            <rect className="light-body" x="882" y="190" width="28" height="22" rx="4" fill="#eef3ff" filter="url(#f-work)"/>
            <rect className="light-lens" x="885" y="193" width="22" height="16" rx="2.5" fill="#d8e8ff" opacity="0.75"/>
            <line x1="896" y1="193" x2="896" y2="209" stroke="#b0c8f0" strokeWidth="1" opacity="0.5"/>
            <line x1="885" y1="201" x2="907" y2="201" stroke="#b0c8f0" strokeWidth="1" opacity="0.5"/>
            <rect x="890" y="210" width="8" height="5" rx="1" fill="#242e42"/>
          </g>

          <g id="light-7" className={cls('light-7')} onClick={() => toggleFixture('light-7')}>
            <ellipse className="light-glow" cx="84" cy="232" rx="62" ry="44" fill="url(#rg-yellow)" opacity="1"/>
            <rect className="light-body" x="96" y="220" width="34" height="26" rx="5" fill="#f0b800" filter="url(#f-yellow)"/>
            <rect className="light-lens" x="99" y="223" width="28" height="20" rx="3" fill="#ffe060" opacity="0.68"/>
            <line x1="99" y1="230" x2="127" y2="230" stroke="#c08a08" strokeWidth="1.5" opacity="0.5"/>
            <line x1="99" y1="237" x2="127" y2="237" stroke="#c08a08" strokeWidth="1.5" opacity="0.5"/>
            <ellipse cx="106" cy="226" rx="5" ry="3" fill="#fff5b0" opacity="0.5"/>
            <rect x="108" y="244" width="11" height="7" rx="1.5" fill="#242e42"/>
          </g>

          <g id="light-HL" className={hlCls} onClick={cycleHeadlight}>
            <ellipse className="hl-glow-high" cx="290" cy="211" rx="110" ry="28" fill="url(#rg-headlight)"/>
            <ellipse className="hl-glow-low"  cx="320" cy="211" rx="75"  ry="18" fill="url(#rg-headlight)"/>
            <rect x="392" y="205" width="6" height="14" rx="1" fill="#2e3a50"/>
            <rect className="light-body" x="378" y="200" width="16" height="22" rx="3" fill="#fff8d0" filter="url(#f-headlight)"/>
            <rect className="light-lens" x="380" y="202" width="12" height="18" rx="2" fill="#ffe890" opacity="0.85"/>
            <line x1="386" y1="202" x2="386" y2="220" stroke="#c0a050" strokeWidth="0.8" opacity="0.5"/>
          </g>

          <g id="light-FP" className={cls('light-FP')} onClick={() => toggleFixture('light-FP')}>
            <ellipse className="light-glow" cx="160" cy="184" rx="22" ry="11" fill="url(#rg-parking)" opacity="1"/>
            <rect className="light-body" x="153" y="180" width="14" height="8" rx="2" fill="#ff8030" filter="url(#f-parking)"/>
            <rect className="light-lens" x="155" y="181" width="10" height="6" rx="1" fill="#ffd0a0" opacity="0.75"/>
          </g>

          <g id="light-RP" className={cls('light-RP')} onClick={() => toggleFixture('light-RP')}>
            <ellipse className="light-glow" cx="876" cy="166" rx="22" ry="11" fill="url(#rg-parking)" opacity="1"/>
            <rect className="light-body" x="869" y="162" width="14" height="8" rx="2" fill="#ff8030" filter="url(#f-parking)"/>
            <rect className="light-lens" x="871" y="163" width="10" height="6" rx="1" fill="#ffd0a0" opacity="0.75"/>
          </g>

          <g id="turn-L" className={cls('turn-L')} onClick={() => toggleFixture('turn-L')}>
            <ellipse className="turn-glow" cx="80" cy="35" rx="42" ry="24" fill="url(#rg-turn)"/>
            <polygon className="turn-arrow" points="56,35 100,18 92,35 100,52" filter="url(#f-turn)"/>
          </g>

          <g id="turn-R" className={cls('turn-R')} onClick={() => toggleFixture('turn-R')}>
            <ellipse className="turn-glow" cx="860" cy="35" rx="42" ry="24" fill="url(#rg-turn)"/>
            <polygon className="turn-arrow" points="884,35 840,18 848,35 840,52" filter="url(#f-turn)"/>
          </g>

          {/* Labels */}
          <text x="418" y="53"  fontFamily="Share Tech Mono,monospace" fontSize="8" fill="#3a5a72" textAnchor="middle">L1</text>
          <text x="468" y="53"  fontFamily="Share Tech Mono,monospace" fontSize="8" fill="#3a5a72" textAnchor="middle">L2</text>
          <text x="558" y="48"  fontFamily="Share Tech Mono,monospace" fontSize="8" fill="#3a5a72" textAnchor="middle">L3</text>
          <text x="644" y="53"  fontFamily="Share Tech Mono,monospace" fontSize="8" fill="#3a5a72" textAnchor="middle">L4</text>
          <text x="698" y="53"  fontFamily="Share Tech Mono,monospace" fontSize="8" fill="#3a5a72" textAnchor="middle">L5</text>
          <text x="896" y="188" fontFamily="Share Tech Mono,monospace" fontSize="8" fill="#3a5a72" textAnchor="middle">L6</text>
          <text x="113" y="217" fontFamily="Share Tech Mono,monospace" fontSize="8" fill="#3a5a72" textAnchor="middle">L7</text>
          <text x="385" y="197" fontFamily="Share Tech Mono,monospace" fontSize="8" fill="#3a5a72" textAnchor="middle">HL</text>
          <text x="160" y="174" fontFamily="Share Tech Mono,monospace" fontSize="8" fill="#3a5a72" textAnchor="middle">FP</text>
          <text x="876" y="156" fontFamily="Share Tech Mono,monospace" fontSize="8" fill="#3a5a72" textAnchor="middle">RP</text>
          <text x="80"  y="14"  fontFamily="Share Tech Mono,monospace" fontSize="8" fill="#3a5a72" textAnchor="middle">TL</text>
          <text x="860" y="14"  fontFamily="Share Tech Mono,monospace" fontSize="8" fill="#3a5a72" textAnchor="middle">TR</text>
        </svg>

        {/* ───── KEYPAD ───── */}
        <svg
          id="keypad"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 312 290"
          style={styles.keypad}
        >
          <rect width="312" height="290" fill="#13171d"/>

          <g id="key-ALL" className={keyCls('ALL', 'white')} onClick={() => pressKey('ALL')}>
            <rect className="key-body" x="16" y="16" width="134" height="78" rx="6" strokeWidth="1"/>
            <circle className="key-led-ring" cx="138" cy="28" r="6"/>
            <circle className="key-led" cx="138" cy="28" r="4"/>
            <text className="key-label" x="28" y="55" fontSize="14">ALL</text>
            <text className="key-label" x="28" y="73" fontSize="14">LIGHTS</text>
            <text className="key-code"  x="28" y="89" fontSize="9">K1</text>
          </g>

          <g id="key-PROFILE" className={keyCls('PROFILE', 'cyan')} onClick={() => pressKey('PROFILE')}>
            <rect className="key-body" x="162" y="16" width="134" height="78" rx="6" strokeWidth="1"/>
            <circle className="key-led-ring" cx="284" cy="28" r="6"/>
            <circle className="key-led" cx="284" cy="28" r="4"/>
            <text className="key-label" x="174" y="64" fontSize="14">PROFILE</text>
            <text className="key-code"  x="174" y="89" fontSize="9">K2</text>
          </g>

          <g id="key-BEAM" className={keyCls('BEAM', 'white')} onClick={() => pressKey('BEAM')}>
            <rect className="key-body" x="16" y="106" width="134" height="78" rx="6" strokeWidth="1"/>
            <circle className="key-led-ring" cx="138" cy="118" r="6"/>
            <circle className="key-led" cx="138" cy="118" r="4"/>
            <text className="key-label" x="28" y="145" fontSize="14">LOW / HIGH</text>
            <text className="key-label" x="28" y="163" fontSize="14">BEAM</text>
            <text className="key-code"  x="28" y="179" fontSize="9">K3</text>
          </g>

          <g id="key-ROADING" className={keyCls('ROADING', 'white')} onClick={() => pressKey('ROADING')}>
            <rect className="key-body" x="162" y="106" width="134" height="78" rx="6" strokeWidth="1"/>
            <circle className="key-led-ring" cx="284" cy="118" r="6"/>
            <circle className="key-led" cx="284" cy="118" r="4"/>
            <text className="key-label" x="174" y="145" fontSize="14">ROADING</text>
            <text className="key-label" x="174" y="163" fontSize="14">LIGHTS</text>
            <text className="key-code"  x="174" y="179" fontSize="9">K4</text>
          </g>

          <g id="key-BEACON" className={keyCls('BEACON', 'red')} onClick={() => pressKey('BEACON')}>
            <rect className="key-body" x="16" y="196" width="134" height="78" rx="6" strokeWidth="1"/>
            <circle className="key-led-ring" cx="138" cy="208" r="6"/>
            <circle className="key-led" cx="138" cy="208" r="4"/>
            <text className="key-label" x="28" y="244" fontSize="14">BEACON</text>
            <text className="key-code"  x="28" y="269" fontSize="9">K5</text>
          </g>

          <g id="key-PARKING" className={keyCls('PARKING', 'amber')} onClick={() => pressKey('PARKING')}>
            <rect className="key-body" x="162" y="196" width="134" height="78" rx="6" strokeWidth="1"/>
            <circle className="key-led-ring" cx="284" cy="208" r="6"/>
            <circle className="key-led" cx="284" cy="208" r="4"/>
            <text className="key-label" x="174" y="235" fontSize="14">PARKING /</text>
            <text className="key-label" x="174" y="253" fontSize="14">MARKER</text>
            <text className="key-code"  x="174" y="269" fontSize="9">K6</text>
          </g>
        </svg>
      </div>
    </div>
  );
}

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
    gap: 24,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 1280,
  },
  loader: {
    flex: '1 1 720px',
    maxWidth: 920,
    height: 'auto',
    display: 'block',
  },
  keypad: {
    flex: '0 0 auto',
    width: 312,
    height: 290,
    display: 'block',
  },
};
