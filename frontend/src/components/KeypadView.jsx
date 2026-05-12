import { KEY_BEHAVIORS } from '../pages/keypadBehaviors';

export default function KeypadView({ ledStates, onPress, style }) {
  const keyCls = (key) => `${ledStates[key] ? 'key-on' : 'key-off'} led-${KEY_BEHAVIORS[key].ledColor}`;

  return (
    <svg
      id="keypad"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 312 290"
      style={style}
    >
      <rect width="312" height="290" fill="#13171d"/>

      <g id="key-ALL" className={keyCls('ALL')} onClick={() => onPress('ALL')}>
        <rect className="key-body" x="16" y="16" width="134" height="78" rx="6" strokeWidth="1"/>
        <circle className="key-led-ring" cx="138" cy="28" r="6"/>
        <circle className="key-led" cx="138" cy="28" r="4"/>
        <text className="key-label" x="28" y="55" fontSize="14">ALL</text>
        <text className="key-label" x="28" y="73" fontSize="14">LIGHTS</text>
        <text className="key-code"  x="28" y="89" fontSize="9">K1</text>
      </g>

      <g id="key-PROFILE" className={keyCls('PROFILE')} onClick={() => onPress('PROFILE')}>
        <rect className="key-body" x="162" y="16" width="134" height="78" rx="6" strokeWidth="1"/>
        <circle className="key-led-ring" cx="284" cy="28" r="6"/>
        <circle className="key-led" cx="284" cy="28" r="4"/>
        <text className="key-label" x="174" y="64" fontSize="14">PROFILE</text>
        <text className="key-code"  x="174" y="89" fontSize="9">K2</text>
      </g>

      <g id="key-BEAM" className={keyCls('BEAM')} onClick={() => onPress('BEAM')}>
        <rect className="key-body" x="16" y="106" width="134" height="78" rx="6" strokeWidth="1"/>
        <circle className="key-led-ring" cx="138" cy="118" r="6"/>
        <circle className="key-led" cx="138" cy="118" r="4"/>
        <text className="key-label" x="28" y="145" fontSize="14">LOW / HIGH</text>
        <text className="key-label" x="28" y="163" fontSize="14">BEAM</text>
        <text className="key-code"  x="28" y="179" fontSize="9">K3</text>
      </g>

      <g id="key-ROADING" className={keyCls('ROADING')} onClick={() => onPress('ROADING')}>
        <rect className="key-body" x="162" y="106" width="134" height="78" rx="6" strokeWidth="1"/>
        <circle className="key-led-ring" cx="284" cy="118" r="6"/>
        <circle className="key-led" cx="284" cy="118" r="4"/>
        <text className="key-label" x="174" y="145" fontSize="14">ROADING</text>
        <text className="key-label" x="174" y="163" fontSize="14">LIGHTS</text>
        <text className="key-code"  x="174" y="179" fontSize="9">K4</text>
      </g>

      <g id="key-BEACON" className={keyCls('BEACON')} onClick={() => onPress('BEACON')}>
        <rect className="key-body" x="16" y="196" width="134" height="78" rx="6" strokeWidth="1"/>
        <circle className="key-led-ring" cx="138" cy="208" r="6"/>
        <circle className="key-led" cx="138" cy="208" r="4"/>
        <text className="key-label" x="28" y="244" fontSize="14">BEACON</text>
        <text className="key-code"  x="28" y="269" fontSize="9">K5</text>
      </g>

      <g id="key-PARKING" className={keyCls('PARKING')} onClick={() => onPress('PARKING')}>
        <rect className="key-body" x="162" y="196" width="134" height="78" rx="6" strokeWidth="1"/>
        <circle className="key-led-ring" cx="284" cy="208" r="6"/>
        <circle className="key-led" cx="284" cy="208" r="4"/>
        <text className="key-label" x="174" y="235" fontSize="14">PARKING /</text>
        <text className="key-label" x="174" y="253" fontSize="14">MARKER</text>
        <text className="key-code"  x="174" y="269" fontSize="9">K6</text>
      </g>
    </svg>
  );
}
