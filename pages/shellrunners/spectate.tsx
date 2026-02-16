import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';

import FrameCanvas from '../../components/runtime/FrameCanvas';

const ALLOWED_PARENT_ORIGINS = new Set([
  'https://moltstation.games',
  'https://www.moltstation.games',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
]);

function resolveWsBaseFromApi(apiBase: string) {
  const raw = String(apiBase || '').trim();
  if (!raw) return null;
  if (raw.startsWith('https://')) return raw.replace(/^https:\/\//, 'wss://');
  if (raw.startsWith('http://')) return raw.replace(/^http:\/\//, 'ws://');
  return null;
}

function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

type SpectateHandshake = {
  token: string;
  sessionId: string;
  slug: string;
};

export default function ShellRunnersSpectatePage() {
  const router = useRouter();
  const sessionId = String(router.query?.sessionId ?? '').trim();

  const [isEmbedded, setIsEmbedded] = useState(false);
  const [handshake, setHandshake] = useState<SpectateHandshake | null>(null);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'connecting' | 'connected' | 'error'>(
    'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<any | null>(null);
  const [hudMinimized, setHudMinimized] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const wsKeyRef = useRef(0);
  const closingRef = useRef(false);

  const apiBase =
    (process.env.NEXT_PUBLIC_MOLTBOT_API_URL as string) || 'http://localhost:4100';
  const wsBase = useMemo(() => resolveWsBaseFromApi(apiBase), [apiBase]);

  useEffect(() => {
    // Client-only: detect iframe usage.
    setIsEmbedded(typeof window !== 'undefined' && window.top !== window.self);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    if (typeof window === 'undefined') return;
    if (window.top === window.self) return;

    // Tell the parent we're ready to receive the token. This avoids timing issues
    // where the parent posts the token before our listener is attached.
    const msg = { t: 'spectate_ready', sessionId };
    try {
      window.parent?.postMessage(msg, '*');
      setTimeout(() => window.parent?.postMessage(msg, '*'), 250);
      setTimeout(() => window.parent?.postMessage(msg, '*'), 750);
    } catch {
      // ignore
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    setStatus('waiting');

    function onMessage(evt: MessageEvent) {
      if (!ALLOWED_PARENT_ORIGINS.has(evt.origin)) return;
      const data = evt.data;
      if (!data || typeof data !== 'object') return;
      const token = String((data as any).token ?? '').trim();
      const slug = String((data as any).slug ?? '').trim();
      const msgSessionId = String((data as any).sessionId ?? '').trim();
      if (!token || !slug || !msgSessionId) return;
      if (msgSessionId !== sessionId) return;

      setHandshake({ token, slug, sessionId: msgSessionId });
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [sessionId]);

  useEffect(() => {
    if (!handshake) return;
    if (!wsBase) {
      setStatus('error');
      setError('WS base URL not configured.');
      return;
    }

    setStatus('connecting');
    setError(null);

    wsKeyRef.current += 1;
    const wsKey = wsKeyRef.current;
    closingRef.current = false;

    const url = `${wsBase}/ws/${encodeURIComponent(handshake.slug)}/spectate?sessionId=${encodeURIComponent(
      handshake.sessionId
    )}&token=${encodeURIComponent(handshake.token)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsKey !== wsKeyRef.current) return;
      setStatus('connected');
      setError(null);
    };
    ws.onmessage = (evt) => {
      if (wsKey !== wsKeyRef.current) return;
      try {
        const msg = JSON.parse(String(evt.data ?? ''));
        if (msg?.t === 'frame') setFrame(msg.frame ?? null);
      } catch {
        // ignore
      }
    };
    ws.onerror = () => {
      if (wsKey !== wsKeyRef.current) return;
      setStatus('error');
      setError('WebSocket error.');
    };
    ws.onclose = (evt) => {
      // In dev with React strict mode, effects mount/unmount twice; ignore stale sockets.
      if (wsKey !== wsKeyRef.current) return;
      if (closingRef.current) return;
      if (status !== 'error') {
        setStatus('error');
      }
      setError(evt?.reason ? `Disconnected: ${evt.reason}` : 'Disconnected.');
    };

    return () => {
      closingRef.current = true;
      try {
        ws.close();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handshake, wsBase]);

  if (!sessionId) {
    return (
      <main style={{ padding: 24, fontFamily: 'monospace', color: '#d7f7ff', background: '#05060a' }}>
        <h1>ShellRunners Spectate</h1>
        <p>Session id required. Open from MoltStation Core.</p>
      </main>
    );
  }

  if (!isEmbedded) {
    return (
      <main style={{ padding: 24, fontFamily: 'monospace', color: '#d7f7ff', background: '#05060a' }}>
        <h1>ShellRunners Spectate</h1>
        <p>Spectate token required. Open from MoltStation Core.</p>
      </main>
    );
  }

  const scoreCurrent = Number(frame?.score?.current ?? 0);
  const scoreHigh = Number(frame?.score?.high ?? 0);
  const elapsed = Number(frame?.tMs ?? 0);
  const spectators = frame?.spectators ?? null;
  const phase = String(frame?.phase ?? '');

  return (
    <main
      style={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: '#05060a',
        color: '#d7f7ff',
        fontFamily: 'monospace',
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        <FrameCanvas frame={frame} />
      </div>

      <div
        style={{
          position: 'absolute',
          right: 14,
          top: 14,
          display: 'grid',
          gap: 10,
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            border: '1px solid rgba(215,247,255,0.22)',
            borderRadius: 12,
            padding: 12,
            background: 'rgba(10,12,18,0.55)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 12px 28px rgba(0,0,0,0.55)',
            minWidth: 280,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <strong>ShellRunners Live</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ opacity: 0.75, fontSize: 12 }}>
                {status === 'connected' ? phase || 'live' : status}
              </span>
              <button
                type='button'
                onClick={() => setHudMinimized((v) => !v)}
                style={{
                  border: '1px solid rgba(215,247,255,0.22)',
                  borderRadius: 8,
                  background: 'rgba(10,12,18,0.55)',
                  color: '#d7f7ff',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: 12,
                  lineHeight: 1.1,
                }}
                title={hudMinimized ? 'Expand panel' : 'Minimize panel'}>
                {hudMinimized ? 'Expand' : 'Minimize'}
              </button>
            </div>
          </div>
          {!hudMinimized ? (
            <>
              <div style={{ marginTop: 10, display: 'grid', gap: 6, fontSize: 12, opacity: 0.92 }}>
                <div style={{ opacity: 0.75, fontSize: 12 }}>session: {sessionId}</div>
                <div>Elapsed: {formatElapsed(elapsed)}</div>
                <div>
                  Score: {scoreCurrent} (high {scoreHigh})
                </div>
                <div>
                  Spectators: {spectators ? `${spectators.current}/${spectators.max}` : '...'}
                </div>
              </div>
              {error ? (
                <div style={{ marginTop: 10, fontSize: 12, color: '#ffb38a' }}>{error}</div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                  {Array.isArray(frame?.entities) && frame.entities.length > 0
                    ? 'Live playback rendering active.'
                    : 'Stats-only session (no frame entities yet).'}
                </div>
              )}
            </>
          ) : (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.78 }}>
              Score {scoreCurrent} | {formatElapsed(elapsed)}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
