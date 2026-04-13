export function AxisBar({ label, value }) {
  const pct = Math.abs(value) * 50;
  const isNeg = value < 0;

  return (
    <div style={styles.row}>
      <div style={styles.label}>{label}</div>
      <div style={styles.track}>
        <div style={styles.half}>
          {isNeg && <div style={{ ...styles.bar, ...styles.barNeg, width: `${pct}%` }} />}
        </div>
        <div style={styles.center} />
        <div style={styles.half}>
          {!isNeg && <div style={{ ...styles.bar, ...styles.barPos, width: `${pct}%` }} />}
        </div>
      </div>
      <div style={styles.value}>{value.toFixed(3)}</div>
    </div>
  );
}

const styles = {
  row: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' },
  label: { width: '60px', fontSize: '13px', fontFamily: 'monospace', color: '#aaa', textAlign: 'right' },
  track: { flex: 1, display: 'flex', alignItems: 'center', height: '20px', backgroundColor: '#1a1a1a', borderRadius: '4px', overflow: 'hidden' },
  half: { flex: 1, height: '100%', display: 'flex', alignItems: 'center' },
  center: { width: '2px', height: '100%', backgroundColor: '#444', flexShrink: 0 },
  bar: { height: '14px', borderRadius: '2px', transition: 'width 0.05s linear' },
  barNeg: { backgroundColor: '#f97316', marginLeft: 'auto' },
  barPos: { backgroundColor: '#22c55e' },
  value: { width: '56px', fontSize: '12px', fontFamily: 'monospace', color: '#fff', textAlign: 'right' },
};
