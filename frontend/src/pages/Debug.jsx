import { useHmi } from '../hooks/useHmi';
import { AxisBar } from '../components/AxisBar';

export default function Debug() {
  const { data, connected } = useHmi();
  const { axes, buttons, meta } = data;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.title}>HMI Debug</span>
          <div style={styles.statusRow}>
            <StatusDot active={connected} label="WebSocket" />
            <StatusDot active={meta.raw_connected} label="Controller" />
            <StatusDot active={buttons.deadman} label="Deadman" />
          </div>
        </div>

        <section style={styles.section}>
          <div style={styles.sectionLabel}>AXES</div>
          <AxisBar label="left_x"  value={axes.left_x} />
          <AxisBar label="left_y"  value={axes.left_y} />
          <AxisBar label="right_x" value={axes.right_x} />
          <AxisBar label="right_y" value={axes.right_y} />
        </section>

        <section style={styles.section}>
          <div style={styles.sectionLabel}>BUTTONS</div>
          <div style={styles.buttonRow}>
            <ButtonPill label="deadman"     active={buttons.deadman} />
            <ButtonPill label="mode_toggle" active={buttons.mode_toggle} />
            <ButtonPill label="reset"       active={buttons.reset} />
          </div>
        </section>

        <div style={styles.meta}>
          {data.timestamp
            ? `${meta.profile} · ${new Date(data.timestamp).toISOString().slice(11, 23)}`
            : 'waiting for data...'}
        </div>
      </div>
    </div>
  );
}

function StatusDot({ active, label }) {
  return (
    <div style={styles.dotRow}>
      <div style={{ ...styles.dot, backgroundColor: active ? '#22c55e' : '#444' }} />
      <span style={styles.dotLabel}>{label}</span>
    </div>
  );
}

function ButtonPill({ label, active }) {
  return (
    <div style={{
      ...styles.pill,
      backgroundColor: active ? '#22c55e22' : '#1a1a1a',
      borderColor: active ? '#22c55e' : '#333',
      color: active ? '#22c55e' : '#555',
    }}>
      {label}
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' },
  card: { width: '480px', backgroundColor: '#111', borderRadius: '12px', border: '1px solid #222', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '16px', fontWeight: 'bold', color: '#fff', letterSpacing: '0.05em' },
  statusRow: { display: 'flex', gap: '12px' },
  dotRow: { display: 'flex', alignItems: 'center', gap: '5px' },
  dot: { width: '8px', height: '8px', borderRadius: '50%' },
  dotLabel: { fontSize: '11px', color: '#666' },
  section: { marginBottom: '20px' },
  sectionLabel: { fontSize: '10px', color: '#444', letterSpacing: '0.1em', marginBottom: '10px' },
  buttonRow: { display: 'flex', gap: '8px' },
  pill: { fontSize: '11px', padding: '4px 10px', borderRadius: '20px', border: '1px solid', transition: 'all 0.1s' },
  meta: { fontSize: '10px', color: '#333', textAlign: 'right', marginTop: '8px' },
};
