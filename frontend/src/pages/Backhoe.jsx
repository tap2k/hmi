import { useHmi } from '../hooks/useHmi';

// --- geometry helpers -----------------------------------------------------------

/** Convert axis value [-1, 1] to degrees within a symmetric range. */
function axisToDeg(value, range) {
  return value * range;
}

/**
 * Compute the tip point of a segment starting at (x, y) at angle `deg`
 * (measured from straight-up / -Y axis, positive = clockwise) with `len` length.
 */
function tipAt(x, y, deg, len) {
  const rad = (deg * Math.PI) / 180;
  return {
    x: x + Math.sin(rad) * len,
    y: y - Math.cos(rad) * len,
  };
}

// --- Top-down view --------------------------------------------------------------

function TopDownView({ swingDeg, active }) {
  // SVG coordinate center
  const cx = 160;
  const cy = 180;

  // undercarriage (static) — two track bars + body
  const trackW = 30;
  const trackH = 100;
  const bodyW = 70;
  const bodyH = 80;

  return (
    <svg
      viewBox="0 0 320 360"
      style={{ width: '100%', height: '100%' }}
    >
      {/* --- static undercarriage --- */}
      {/* left track */}
      <rect x={cx - bodyW / 2 - trackW - 4} y={cy - trackH / 2} width={trackW} height={trackH} rx="6" fill="#2a2a2a" stroke="#444" strokeWidth="1.5" />
      {/* track detail lines */}
      {Array.from({ length: 6 }).map((_, i) => (
        <rect
          key={i}
          x={cx - bodyW / 2 - trackW - 4 + 3}
          y={cy - trackH / 2 + 8 + i * 14}
          width={trackW - 6}
          height={6}
          rx="1"
          fill="#383838"
          stroke="#555"
          strokeWidth="0.5"
        />
      ))}
      {/* right track */}
      <rect x={cx + bodyW / 2 + 4} y={cy - trackH / 2} width={trackW} height={trackH} rx="6" fill="#2a2a2a" stroke="#444" strokeWidth="1.5" />
      {Array.from({ length: 6 }).map((_, i) => (
        <rect
          key={i}
          x={cx + bodyW / 2 + 4 + 3}
          y={cy - trackH / 2 + 8 + i * 14}
          width={trackW - 6}
          height={6}
          rx="1"
          fill="#383838"
          stroke="#555"
          strokeWidth="0.5"
        />
      ))}
      {/* undercarriage body */}
      <rect x={cx - bodyW / 2} y={cy - bodyH / 2} width={bodyW} height={bodyH} rx="3" fill="#1e1e1e" stroke="#444" strokeWidth="1.5" />
      {/* swing bearing circle */}
      <circle cx={cx} cy={cy} r={24} fill="none" stroke="#333" strokeWidth="1" strokeDasharray="4 3" />
      <circle cx={cx} cy={cy} r={3} fill="#555" />

      {/* --- rotating upper structure --- */}
      <g
        transform={`rotate(${swingDeg}, ${cx}, ${cy})`}
        opacity={active ? 1 : 0.45}
      >
        {/* cab body */}
        <rect x={cx - 22} y={cy - 38} width={44} height={42} rx="4" fill="#2d2d2d" stroke="#facc15" strokeWidth="1.5" />
        {/* cab roof detail */}
        <rect x={cx - 16} y={cy - 35} width={32} height={8} rx="2" fill="#3a3a3a" stroke="#555" strokeWidth="0.5" />
        {/* cab window */}
        <rect x={cx - 10} y={cy - 25} width={20} height={10} rx="1" fill="#0d1f2d" stroke="#336" strokeWidth="0.5" />

        {/* boom base — extends forward (up in SVG = boom direction) */}
        <rect x={cx - 5} y={cy - 90} width={10} height={55} rx="2" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />

        {/* boom tip indicator */}
        <circle cx={cx} cy={cy - 90} r={4} fill="#facc15" stroke="#ca8a04" strokeWidth="1" />

        {/* pivot indicator at cab */}
        <circle cx={cx} cy={cy - 35} r={3} fill="#555" stroke="#888" strokeWidth="0.5" />

        {/* forward direction tick */}
        <line x1={cx} y1={cy - 100} x2={cx} y2={cy - 95} stroke="#facc15" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* label */}
      <text x={cx} y={340} textAnchor="middle" fontSize="10" fill="#444" fontFamily="monospace">
        TOP-DOWN · SWING {swingDeg.toFixed(1)}°
      </text>
    </svg>
  );
}

// --- Side-profile view ----------------------------------------------------------

function SideProfileView({ boomDeg, stickDeg, bucketDeg, active }) {
  // Dimensions
  const boomLen  = 110;
  const boomW    = 14;
  const stickLen = 80;
  const stickW   = 10;
  const bucketLen = 36;
  const bucketW  = 8;

  // Pivot origin: top-right corner of cab (where boom mounts)
  const pivX = 230;
  const pivY = 219;

  // Compute absolute boom tip for stick pivot
  const boomTip = tipAt(pivX, pivY, boomDeg, boomLen);

  // Absolute stick angle = boomDeg + stickDeg (chained)
  const absoluteStickAngle = boomDeg + stickDeg;
  const stickTip = tipAt(boomTip.x, boomTip.y, absoluteStickAngle, stickLen);

  // Absolute bucket angle = absoluteStickAngle + bucketDeg (chained)
  const absoluteBucketAngle = absoluteStickAngle + bucketDeg;

  // Bucket polygon — a curved scoop shape relative to stickTip
  const bucketPoints = buildBucketPolygon(
    stickTip.x, stickTip.y,
    absoluteBucketAngle,
    bucketLen,
    bucketW
  );

  return (
    <svg
      viewBox="0 0 480 360"
      style={{ width: '100%', height: '100%' }}
    >
      {/* ground line */}
      <line x1={0} y1={290} x2={480} y2={290} stroke="#333" strokeWidth="1.5" />

      {/* undercarriage — centered at x=240 */}
      <rect x={100} y={265} width={260} height={24} rx="4" fill="#2a2a2a" stroke="#444" strokeWidth="1.5" />
      {/* track detail */}
      {Array.from({ length: 9 }).map((_, i) => (
        <rect key={i} x={108 + i * 26} y={268} width={16} height={14} rx="2" fill="#383838" stroke="#555" strokeWidth="0.5" />
      ))}
      {/* drive sprockets */}
      <circle cx={110} cy={277} r={9} fill="#2a2a2a" stroke="#555" strokeWidth="1.5" />
      <circle cx={350} cy={277} r={9} fill="#2a2a2a" stroke="#555" strokeWidth="1.5" />

      {/* cab body — right edge at pivX=230, top at pivY=219, bottom at y=265 */}
      <rect x={146} y={225} width={84} height={40} rx="4" fill="#2d2d2d" stroke="#facc15" strokeWidth="1.5" />
      {/* cab window */}
      <rect x={170} y={229} width={36} height={18} rx="2" fill="#0d1f2d" stroke="#336" strokeWidth="1" />
      {/* cab roof */}
      <rect x={151} y={219} width={79} height={6} rx="2" fill="#3a3a3a" stroke="#555" strokeWidth="0.5" />

      {/* arm assembly — drawn as computed geometry */}
      <g opacity={active ? 1 : 0.45}>
        {/* boom */}
        <line
          x1={pivX} y1={pivY}
          x2={boomTip.x} y2={boomTip.y}
          stroke="#facc15" strokeWidth={boomW}
          strokeLinecap="round"
        />
        {/* boom outline */}
        <line
          x1={pivX} y1={pivY}
          x2={boomTip.x} y2={boomTip.y}
          stroke="#ca8a04" strokeWidth={boomW + 2}
          strokeLinecap="round"
          opacity="0.3"
        />

        {/* stick */}
        <line
          x1={boomTip.x} y1={boomTip.y}
          x2={stickTip.x} y2={stickTip.y}
          stroke="#d4d4d4" strokeWidth={stickW}
          strokeLinecap="round"
        />
        <line
          x1={boomTip.x} y1={boomTip.y}
          x2={stickTip.x} y2={stickTip.y}
          stroke="#888" strokeWidth={stickW + 2}
          strokeLinecap="round"
          opacity="0.3"
        />

        {/* bucket */}
        <polygon
          points={bucketPoints}
          fill="#888" stroke="#aaa" strokeWidth="1.5" strokeLinejoin="round"
        />

        {/* pivot circles */}
        <circle cx={pivX} cy={pivY} r={5} fill="#555" stroke="#888" strokeWidth="1" />
        <circle cx={boomTip.x} cy={boomTip.y} r={4} fill="#555" stroke="#888" strokeWidth="1" />
        <circle cx={stickTip.x} cy={stickTip.y} r={3} fill="#555" stroke="#888" strokeWidth="1" />
      </g>

      {/* label */}
      <text x={240} y={340} textAnchor="middle" fontSize="10" fill="#444" fontFamily="monospace">
        SIDE PROFILE · BOOM {boomDeg.toFixed(1)}° STICK {stickDeg.toFixed(1)}°
      </text>
    </svg>
  );
}

/**
 * Build a bucket polygon (scoop shape) pivoting at (px, py) along `angleDeg`,
 * extending `len` in that direction with `halfW` half-width.
 */
function buildBucketPolygon(px, py, angleDeg, len, halfW) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad - Math.PI / 2);
  const sin = Math.sin(rad - Math.PI / 2);
  const fw = { x: Math.sin(rad), y: -Math.cos(rad) };
  const rw = { x: cos, y: sin };

  // 5-point scoop: open at the "mouth", curved at tip
  const p0 = { x: px - rw.x * halfW, y: py - rw.y * halfW };
  const p1 = { x: px + rw.x * halfW, y: py + rw.y * halfW };
  const p2 = { x: p1.x + fw.x * len, y: p1.y + fw.y * len };
  const p3 = { x: p2.x - rw.x * (halfW * 2.2), y: p2.y - rw.y * (halfW * 2.2) };
  const p4 = { x: p0.x + fw.x * (len * 0.7), y: p0.y + fw.y * (len * 0.7) };

  return [p0, p1, p2, p3, p4].map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

// --- Status bar -----------------------------------------------------------------

function StatusDot({ active, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: active ? '#22c55e' : '#444' }} />
      <span style={{ fontSize: 11, color: '#666', fontFamily: 'monospace' }}>{label}</span>
    </div>
  );
}

// --- Main page ------------------------------------------------------------------

export default function Backhoe() {
  const { data, connected } = useHmi();
  const { axes, buttons, meta } = data;

  const active = buttons.deadman;

  // Spatial mapping (intuitive for gamepad demo)
  // Left stick: X → swing left/right, Y → boom up/down
  // Right stick: Y → stick in/out, X → bucket curl/dump
  const swingDeg  = axisToDeg(axes.left_x,  90);   // ±90°
  const boomDeg   = axisToDeg(axes.left_y,  30);    // ±30° from 45° neutral
  const stickDeg  = axisToDeg(axes.right_y, 60);    // ±60°
  const bucketDeg = axisToDeg(axes.right_x, 60);    // ±60° curl

  // Boom neutral is 45° up-and-forward; left_y positive = lower
  const boomAngle  = -45 + boomDeg;

  return (
    <div style={styles.page}>
      {/* header bar */}
      <div style={styles.header}>
        <span style={styles.title}>BACKHOE VISUALIZER</span>
        <div style={styles.statusRow}>
          <StatusDot active={connected}        label="WS" />
          <StatusDot active={meta.raw_connected} label="CTRL" />
          <StatusDot active={buttons.deadman}  label="DEADMAN" />
          {!active && (
            <span style={styles.inactiveWarning}>DEADMAN OFF — axes zeroed by middleware</span>
          )}
        </div>
      </div>

      {/* split view */}
      <div style={styles.split}>
        {/* left: top-down */}
        <div style={styles.panel}>
          <div style={styles.panelLabel}>TOP-DOWN VIEW</div>
          <div style={styles.panelLabel2}>left_x → swing</div>
          <div style={styles.svgWrap}>
            <TopDownView swingDeg={swingDeg} active={active} />
          </div>
        </div>

        {/* divider */}
        <div style={styles.divider} />

        {/* right: side profile */}
        <div style={styles.panel}>
          <div style={styles.panelLabel}>SIDE PROFILE</div>
          <div style={styles.panelLabel2}>left_y / right_y / right_x → boom / stick / bucket</div>
          <div style={styles.svgWrap}>
            <SideProfileView
              boomDeg={boomAngle}
              stickDeg={stickDeg}
              bucketDeg={bucketDeg}
              active={active}
            />
          </div>
        </div>
      </div>

      {/* axis readout strip */}
      <div style={styles.readout}>
        {[
          { label: 'swing',  val: axes.left_x,  deg: swingDeg },
          { label: 'boom',   val: axes.left_y,  deg: boomAngle },
          { label: 'stick',  val: axes.right_y, deg: stickDeg },
          { label: 'bucket', val: axes.right_x, deg: bucketDeg },
        ].map(({ label, val, deg }) => (
          <div key={label} style={styles.readoutItem}>
            <div style={styles.readoutLabel}>{label}</div>
            <div style={styles.readoutVal}>{val.toFixed(3)}</div>
            <div style={styles.readoutDeg}>{deg.toFixed(1)}°</div>
          </div>
        ))}
        <div style={{ ...styles.readoutItem, marginLeft: 'auto' }}>
          <div style={styles.readoutLabel}>profile</div>
          <div style={styles.readoutVal}>{meta.profile ?? '—'}</div>
        </div>
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
    fontFamily: 'monospace',
    color: '#fff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 24px',
    borderBottom: '1px solid #1e1e1e',
    backgroundColor: '#111',
    flexShrink: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: '0.12em',
    color: '#facc15',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  inactiveWarning: {
    fontSize: 10,
    color: '#f97316',
    letterSpacing: '0.05em',
    padding: '2px 8px',
    border: '1px solid #7c2d12',
    borderRadius: 4,
    backgroundColor: '#1c0a00',
  },
  split: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  panel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    minWidth: 0,
  },
  panelLabel: {
    fontSize: 10,
    color: '#555',
    letterSpacing: '0.12em',
    marginBottom: 2,
  },
  panelLabel2: {
    fontSize: 10,
    color: '#333',
    letterSpacing: '0.08em',
    marginBottom: 8,
  },
  svgWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d0d0d',
    border: '1px solid #1e1e1e',
    borderRadius: 8,
    overflow: 'hidden',
    minHeight: 320,
  },
  divider: {
    width: 1,
    backgroundColor: '#1e1e1e',
    margin: '16px 0',
    flexShrink: 0,
  },
  readout: {
    display: 'flex',
    gap: 0,
    borderTop: '1px solid #1e1e1e',
    backgroundColor: '#0d0d0d',
    flexShrink: 0,
  },
  readoutItem: {
    padding: '10px 24px',
    borderRight: '1px solid #1a1a1a',
    minWidth: 100,
  },
  readoutLabel: {
    fontSize: 9,
    color: '#444',
    letterSpacing: '0.1em',
    marginBottom: 2,
  },
  readoutVal: {
    fontSize: 13,
    color: '#facc15',
  },
  readoutDeg: {
    fontSize: 10,
    color: '#555',
    marginTop: 1,
  },
};
