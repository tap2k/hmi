export default function DashboardView({ onLightsClick, style }) {
  return (
    <svg
      id="dashboard"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 920 400"
      style={style}
    >
      {/* Background */}
      <rect width="920" height="400" fill="#5a5a5a"/>

      {/* ───── TOP BAR ───── */}
      <rect x="0" y="0" width="920" height="58" fill="#c8c8c8"/>
      <line x1="0" y1="58" x2="920" y2="58" stroke="#9a9a9a" strokeWidth="1"/>

      {/* D — drive indicator */}
      <rect x="12" y="8" width="44" height="42" fill="#1a1a1a"/>
      <text x="34" y="42" textAnchor="middle" fill="#fff" fontSize="28" fontWeight="700" fontFamily="Helvetica,Arial,sans-serif">D</text>

      {/* Speed */}
      <text x="72" y="42" fill="#1a1a1a" fontSize="26" fontWeight="700" fontFamily="Helvetica,Arial,sans-serif">45km/h</text>

      {/* Inline RPM */}
      <g transform="translate(220, 12)" pointerEvents="none">
        <path d="M 0 24 A 16 16 0 0 1 32 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5"/>
        <line x1="16" y1="24" x2="26" y2="14" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round"/>
        <text x="16" y="36" textAnchor="middle" fill="#1a1a1a" fontSize="7" fontFamily="Helvetica,Arial,sans-serif">n/min</text>
      </g>
      <text x="262" y="42" fill="#1a1a1a" fontSize="26" fontWeight="700" fontFamily="Helvetica,Arial,sans-serif">2500</text>

      {/* Divider */}
      <line x1="380" y1="6" x2="380" y2="52" stroke="#a4a4a4" strokeWidth="1.5"/>

      {/* Operator icon */}
      <g transform="translate(394, 8)" pointerEvents="none">
        <circle cx="14" cy="14" r="6.5" fill="#1a1a1a"/>
        <path d="M 0 40 Q 14 24, 28 40 L 28 42 L 0 42 Z" fill="#1a1a1a"/>
      </g>
      <text x="432" y="42" fill="#1a1a1a" fontSize="24" fontWeight="700" fontFamily="Helvetica,Arial,sans-serif">Opr 1</text>

      {/* ───── LIGHTS BUTTON (interactive) ───── */}
      <g id="dash-lights-btn" onClick={onLightsClick} style={{ cursor: 'pointer' }}>
        <rect className="dash-lights-bg" x="744" y="8" width="68" height="42" rx="6" fill="#dcdcdc" stroke="#8a8a8a" strokeWidth="1"/>
        <g transform="translate(754, 16)" pointerEvents="none">
          <path d="M 4 4 L 22 4 Q 30 14, 22 24 L 4 24 Z" fill="#1a1a1a"/>
          <line x1="26" y1="8"  x2="34" y2="6"  stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"/>
          <line x1="28" y1="14" x2="36" y2="14" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"/>
          <line x1="26" y1="20" x2="34" y2="22" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"/>
        </g>
      </g>

      {/* Time */}
      <text x="900" y="42" textAnchor="end" fill="#1a1a1a" fontSize="24" fontWeight="700" fontFamily="Helvetica,Arial,sans-serif">12:24</text>

      {/* ───── MAIN AREA ───── */}

      {/* Top-left gauge: oil temp */}
      <g transform="translate(180, 195)">
        <path d="M -60 0 A 60 60 0 0 1 60 0" fill="none" stroke="#1a1a1a" strokeWidth="20"/>
        <line x1="0" y1="-72" x2="0" y2="-54" stroke="#ff8b3d" strokeWidth="8"/>
      </g>
      <g transform="translate(180, 238)" pointerEvents="none">
        <path d="M -18 4 Q -16 -6, -6 -6 L 10 -6 L 10 -10 L 16 -10 L 16 -4 L 22 -2 L 22 4 Z" fill="#1a1a1a"/>
        <path d="M -22 8 L 22 8" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M -2 -10 Q -4 -14, 0 -16" fill="none" stroke="#1a1a1a" strokeWidth="2"/>
      </g>

      {/* Top-middle gauge: RPM (large) */}
      <g transform="translate(460, 280)">
        <path d="M -135 0 A 135 135 0 0 1 135 0" fill="none" stroke="#1a1a1a" strokeWidth="38"/>
        <line x1="-24" y1="-154" x2="-24" y2="-118" stroke="#ff8b3d" strokeWidth="12"/>
      </g>
      {/* RPM readout inside the bowl */}
      <g transform="translate(460, 268)" pointerEvents="none">
        <g transform="translate(-62, -12)">
          <path d="M 0 24 A 18 18 0 0 1 36 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5"/>
          <line x1="18" y1="24" x2="29" y2="13" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round"/>
          <text x="18" y="38" textAnchor="middle" fill="#1a1a1a" fontSize="8" fontFamily="Helvetica,Arial,sans-serif">n/min</text>
        </g>
        <text x="-12" y="10" textAnchor="start" fill="#1a1a1a" fontSize="32" fontWeight="700" fontFamily="Helvetica,Arial,sans-serif">2500</text>
      </g>

      {/* Top-right gauge: charging system */}
      <g transform="translate(740, 195)">
        <path d="M -60 0 A 60 60 0 0 1 60 0" fill="none" stroke="#1a1a1a" strokeWidth="20"/>
        <line x1="0" y1="-72" x2="0" y2="-54" stroke="#ff8b3d" strokeWidth="8"/>
      </g>
      {/* Engine + lightning glyph */}
      <g transform="translate(740, 238)" pointerEvents="none">
        <rect x="-14" y="-2" width="22" height="14" rx="2" fill="#1a1a1a"/>
        <rect x="-18" y="2"  width="6"  height="6" fill="#1a1a1a"/>
        <rect x="-10" y="-8" width="4"  height="6" fill="#1a1a1a"/>
        <rect x="-2"  y="-8" width="4"  height="6" fill="#1a1a1a"/>
        <rect x="6"   y="-8" width="4"  height="6" fill="#1a1a1a"/>
        <path d="M 14 -6 L 6 6 L 12 6 L 8 16 L 20 2 L 13 2 Z" fill="#1a1a1a"/>
      </g>

      {/* Bottom-left fuel bars (two vertical) */}
      <g transform="translate(78, 250)" pointerEvents="none">
        <rect x="0"  y="0" width="18" height="110" fill="#1a1a1a"/>
        <line x1="-4" y1="68" x2="22" y2="68" stroke="#ff8b3d" strokeWidth="7"/>
        <rect x="30" y="0" width="18" height="110" fill="#1a1a1a"/>
        <line x1="26" y1="84" x2="52" y2="84" stroke="#ff8b3d" strokeWidth="7"/>
      </g>
      {/* Fuel pump icon */}
      <g transform="translate(108, 376)" pointerEvents="none">
        <rect x="-12" y="-14" width="16" height="18" fill="#1a1a1a"/>
        <rect x="-10" y="-12" width="12" height="6" fill="#5a5a5a"/>
        <path d="M 4 -10 L 10 -10 L 10 -2 L 14 -2 L 14 4" fill="none" stroke="#1a1a1a" strokeWidth="2.5"/>
        <rect x="-13" y="4" width="19" height="3" fill="#1a1a1a"/>
      </g>

      {/* Bottom-right gauge: battery */}
      <g transform="translate(640, 320)">
        <path d="M -58 0 A 58 58 0 0 1 58 0" fill="none" stroke="#1a1a1a" strokeWidth="20"/>
        <line x1="0" y1="-70" x2="0" y2="-52" stroke="#ff8b3d" strokeWidth="8"/>
      </g>
      {/* Battery glyph */}
      <g transform="translate(640, 360)" pointerEvents="none">
        <rect x="-22" y="-2" width="44" height="14" rx="1" fill="#1a1a1a"/>
        <rect x="-26" y="2"  width="4"  height="6" fill="#1a1a1a"/>
        <rect x="22"  y="2"  width="4"  height="6" fill="#1a1a1a"/>
        <text x="-11" y="9" textAnchor="middle" fill="#c8c8c8" fontSize="11" fontWeight="700" fontFamily="Helvetica,Arial,sans-serif">+</text>
        <text x="11"  y="9" textAnchor="middle" fill="#c8c8c8" fontSize="11" fontWeight="700" fontFamily="Helvetica,Arial,sans-serif">−</text>
      </g>

      {/* Page indicator dots */}
      <g transform="translate(420, 388)" pointerEvents="none">
        <circle cx="-18" cy="0" r="4" fill="#1a1a1a"/>
        <circle cx="0"   cy="0" r="4" fill="#1a1a1a"/>
        <circle cx="18"  cy="0" r="4" fill="#1a1a1a"/>
      </g>

      {/* Menu button (decorative — hamburger in circle) */}
      <g transform="translate(866, 358)" pointerEvents="none">
        <circle cx="0" cy="0" r="30" fill="#c8c8c8" stroke="#8a8a8a" strokeWidth="1"/>
        <line x1="-13" y1="-9" x2="13" y2="-9" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round"/>
        <line x1="-13" y1="0"  x2="13" y2="0"  stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round"/>
        <line x1="-13" y1="9"  x2="13" y2="9"  stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round"/>
      </g>

      <style>{`
        #dash-lights-btn:hover .dash-lights-bg { fill: #f0f3f8; stroke: #2a7aaa; }
        #dash-lights-btn:active .dash-lights-bg { fill: #b8b8b8; }
      `}</style>
    </svg>
  );
}
