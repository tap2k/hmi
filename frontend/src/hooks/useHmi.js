import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = 'ws://localhost:3009/ws/hmi';

const DEFAULT_STATE = {
  timestamp: null,
  device: null,
  axes: { left_x: 0, left_y: 0, right_x: 0, right_y: 0 },
  buttons: { deadman: false, mode_toggle: false, reset: false },
  lights: { ALL: false, PROFILE: false, BEAM: false, ROADING: false, BEACON: false, PARKING: false },
  meta: { raw_connected: false, profile: null },
};

export function useHmi() {
  const [data, setData] = useState(DEFAULT_STATE);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (e) => {
        try {
          setData(JSON.parse(e.data));
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setData(DEFAULT_STATE);
        setTimeout(connect, 1000);
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => wsRef.current?.close();
  }, []);

  // Send a message upstream to the middleware (e.g., LED status for Arduino).
  // Silently no-ops if the socket isn't open.
  const send = useCallback((message) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, []);

  return { data, connected, send };
}
