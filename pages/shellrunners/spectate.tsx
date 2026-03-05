import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';

import FrameCanvas from '../../components/runtime/FrameCanvas';

function resolveAllowedParentOrigins() {
  const configured = String(
    process.env.NEXT_PUBLIC_ALLOWED_PARENT_ORIGINS ||
      process.env.NEXT_PUBLIC_CORE_ALLOWED_ORIGINS ||
      ''
  )
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const localDefaults = ['http://127.0.0.1:3000', 'http://localhost:3000'];
  return new Set([...configured, ...localDefaults]);
}

const ALLOWED_PARENT_ORIGINS = resolveAllowedParentOrigins();
const TOKEN_RECOVERY_REASONS = new Set([
  'TOKEN_REPLAYED',
  'TOKEN_EXPIRED',
  'TOKEN_NOT_FOUND',
  'INVALID_TOKEN',
]);

function resolveWsBaseFromApi(apiBase: string) {
  const raw = String(apiBase || '').trim();
  if (!raw) return null;
  if (raw.startsWith('https://')) return raw.replace(/^https:\/\//, 'wss://');
  if (raw.startsWith('http://')) return raw.replace(/^http:\/\//, 'ws://');
  return null;
}

function resolveApiBase() {
  const explicit = String(process.env.NEXT_PUBLIC_MOLTBOT_API_URL || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  if (typeof window === 'undefined') return '';
  const host = String(window.location.hostname || '').toLowerCase();
  const protocol = String(window.location.protocol || 'https:');
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:4100';
  if (host.startsWith('game.')) return `${protocol}//api.${host.slice(5)}`;
  return '';
}

function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
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

  const apiBase = useMemo(() => resolveApiBase(), []);
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
      setHandshake((prev) => {
        if (
          prev &&
          prev.token === token &&
          prev.slug === slug &&
          prev.sessionId === msgSessionId
        ) {
          return prev;
        }
        return { token, slug, sessionId: msgSessionId };
      });
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
      const reason = String(evt?.reason || '').trim();
      if (TOKEN_RECOVERY_REASONS.has(reason)) {
        setStatus('connecting');
        setError('Refreshing spectate token...');
        try {
          window.parent?.postMessage(
            {
              source: 'moltstation-runtime',
              event: 'spectate_token_needed',
              payload: { reason, sessionId, slug: handshake.slug },
            },
            '*'
          );
        } catch {
          // ignore
        }
        return;
      }
      if (status !== 'error') {
        setStatus('error');
      }
      setError(reason ? `Disconnected: ${reason}` : 'Disconnected.');
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
  const entityCount = Array.isArray(frame?.entities) ? frame.entities.length : 0;
  const livesCurrent = Math.max(0, Number((frame as any)?.lives ?? 0));
  const livesMax = Math.max(1, Number((frame as any)?.livesMax ?? 3));
  const livesHearts = Array.from({ length: livesMax }, (_, idx) =>
    idx < livesCurrent ? '\u2764\ufe0f' : '\ud83e\udd0d'
  ).join(' ');
  const hungerCurrent = Math.max(0, Number((frame as any)?.hunger ?? 0));
  const hungerMax = Math.max(1, Number((frame as any)?.hungerMax ?? 220));
  const hungerRatio = clamp01(hungerCurrent / hungerMax);
  const renderStatus = Array.isArray(frame?.entities) && frame.entities.length > 0 ? 'ready' : 'waiting';

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
            <strong>ShellRunners</strong>
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
                <div style={{ opacity: 0.75, fontSize: 12 }}>Renderer: {renderStatus}</div>
                <div>Elapsed: {formatElapsed(elapsed)}</div>
                <div>
                  Score: {scoreCurrent} (high {scoreHigh})
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Lives:</span>
                  <span
                    aria-label={`Lives ${livesCurrent} of ${livesMax}`}
                    style={{ letterSpacing: 1, fontSize: 16, lineHeight: 1 }}>
                    {livesHearts}
                  </span>
                </div>
                <div>
                  Hunger: {Math.floor(hungerCurrent)}/{hungerMax}
                </div>
                <div
                  style={{
                    height: 7,
                    borderRadius: 999,
                    overflow: 'hidden',
                    border: '1px solid rgba(215,247,255,0.22)',
                    background: 'rgba(2,7,16,0.72)',
                  }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.round(hungerRatio * 100)}%`,
                      background:
                        hungerRatio >= 0.9
                          ? 'linear-gradient(90deg, rgba(255,92,92,0.95), rgba(255,140,89,0.95))'
                          : 'linear-gradient(90deg, rgba(71,221,255,0.92), rgba(255,154,61,0.9))',
                    }}
                  />
                </div>
                <div>Entities: {entityCount}</div>
                <div>
                  Spectators: {spectators ? `${spectators.current}/${spectators.max}` : '...'}
                </div>
              </div>
              {error ? (
                <div style={{ marginTop: 10, fontSize: 12, color: '#ffb38a' }}>{error}</div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>Live playback rendering active.</div>
              )}
            </>
          ) : (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.78 }}>
              Score {scoreCurrent} | L{livesCurrent} | {formatElapsed(elapsed)}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
