import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';

import FrameCanvas from './FrameCanvas';

function resolveAllowedParentOrigins() {
  const configured = String(
    process.env.NEXT_PUBLIC_ALLOWED_PARENT_ORIGINS ||
      process.env.NEXT_PUBLIC_CORE_ALLOWED_ORIGINS ||
      ''
  )
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const isProd = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
  const localDefaults = isProd ? [] : ['http://127.0.0.1:3000', 'http://localhost:3000'];
  return new Set([...configured, ...localDefaults]);
}

const ALLOWED_PARENT_ORIGINS = resolveAllowedParentOrigins();

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

function resolveCoreOriginFromQuery(fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const fallbackUrl = String(fallback || '').trim() || window.location.origin;
  try {
    const params = new URLSearchParams(window.location.search);
    const coreOrigin = String(params.get('coreOrigin') || '').trim();
    if (coreOrigin) return new URL(coreOrigin).origin;
  } catch {
    // ignore
  }
  return fallbackUrl;
}

function resolveBootstrapParentOrigin(coreOrigin: string) {
  const fromCore = String(coreOrigin || '').trim();
  if (fromCore && ALLOWED_PARENT_ORIGINS.has(fromCore)) return fromCore;
  if (typeof document !== 'undefined') {
    const referrer = String(document.referrer || '').trim();
    if (referrer) {
      try {
        const refOrigin = new URL(referrer).origin;
        if (ALLOWED_PARENT_ORIGINS.has(refOrigin)) return refOrigin;
      } catch {
        // ignore
      }
    }
  }
  return '';
}

type PlayHandshake = {
  token: string;
  sessionId: string;
  slug: string;
};

type Dir = 'left' | 'right' | 'none';

export default function EmbeddedPlay() {
  const router = useRouter();
  const sessionId = String(router.query?.sessionId ?? '').trim();

  const [isEmbedded, setIsEmbedded] = useState(false);
  const [handshake, setHandshake] = useState<PlayHandshake | null>(null);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'connecting' | 'connected' | 'error'>(
    'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<any | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const wsKeyRef = useRef(0);
  const lastDirRef = useRef<Dir>('none');
  const pressedRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const onExitRef = useRef<() => void>(() => {});
  const closingRef = useRef(false);
  const trustedParentOriginRef = useRef('');
  const readyNonceRef = useRef('');

  const apiBase = useMemo(() => resolveApiBase(), []);
  const wsBase = useMemo(() => resolveWsBaseFromApi(apiBase), [apiBase]);
  const coreOrigin = useMemo(
    () =>
      resolveCoreOriginFromQuery(
        (process.env.NEXT_PUBLIC_CORE_LANDING_URL as string) ||
          (typeof window !== 'undefined' ? window.location.origin : '')
      ),
    []
  );

  useEffect(() => {
    trustedParentOriginRef.current = resolveBootstrapParentOrigin(coreOrigin);
    readyNonceRef.current = `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  }, [coreOrigin]);

  useEffect(() => {
    setIsEmbedded(typeof window !== 'undefined' && window.top !== window.self);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    if (typeof window === 'undefined') return;
    if (window.top === window.self) return;

    const targetOrigin = trustedParentOriginRef.current;
    if (!targetOrigin) return;
    const msg = { t: 'play_ready', sessionId, nonce: readyNonceRef.current };
    try {
      window.parent?.postMessage(msg, targetOrigin);
      setTimeout(() => window.parent?.postMessage(msg, targetOrigin), 250);
      setTimeout(() => window.parent?.postMessage(msg, targetOrigin), 750);
    } catch {
      // ignore
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    setStatus('waiting');

    function onMessage(evt: MessageEvent) {
      const trusted = trustedParentOriginRef.current;
      if (trusted) {
        if (evt.origin !== trusted) return;
      } else {
        if (!ALLOWED_PARENT_ORIGINS.has(evt.origin)) return;
        trustedParentOriginRef.current = evt.origin;
      }
      const data = evt.data;
      if (!data || typeof data !== 'object') return;
      const token = String((data as any).token ?? '').trim();
      const slug = String((data as any).slug ?? '').trim();
      const msgSessionId = String((data as any).sessionId ?? '').trim();
      const msgNonce = String((data as any).nonce ?? '').trim();
      const mode = String((data as any).mode ?? '').trim();
      if (mode && mode !== 'play') return;
      if (!msgNonce || msgNonce !== readyNonceRef.current) return;
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

  const computeDir = () => {
    const pressed = pressedRef.current;
    if (pressed.left && !pressed.right) return 'left';
    if (pressed.right && !pressed.left) return 'right';
    return 'none';
  };

  const sendDir = (ws: WebSocket, dir: Dir) => {
    if (ws.readyState !== ws.OPEN) return;
    if (dir === lastDirRef.current) return;
    lastDirRef.current = dir;
    try {
      ws.send(JSON.stringify({ t: 'input', dir }));
    } catch {
      // ignore
    }
  };

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

    const url = `${wsBase}/ws/${encodeURIComponent(handshake.slug)}/play?sessionId=${encodeURIComponent(
      handshake.sessionId
    )}&token=${encodeURIComponent(handshake.token)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    lastDirRef.current = 'none';
    pressedRef.current = { left: false, right: false };

    ws.onopen = () => {
      if (wsKey !== wsKeyRef.current) return;
      setStatus('connected');
      setError(null);
      sendDir(ws, 'none');
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
      if (wsKey !== wsKeyRef.current) return;
      if (closingRef.current) return;
      setStatus('error');
      const reason = String(evt?.reason || '').trim();
      if (reason === 'GAME_OVER' || reason === 'EXIT') {
        // Let core close the iframe and keep UI clean.
        onExitRef.current();
        return;
      }
      setError(reason ? `Disconnected: ${reason}` : 'Disconnected.');
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') pressedRef.current.left = true;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') pressedRef.current.right = true;
      const dir = computeDir();
      sendDir(ws, dir);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') pressedRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') pressedRef.current.right = false;
      const dir = computeDir();
      sendDir(ws, dir);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      closingRef.current = true;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      try {
        ws.close();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handshake, wsBase]);

  const elapsed = Number(frame?.tMs ?? 0);
  const scoreCurrent = Number(frame?.score?.current ?? 0);
  const scoreHigh = Number(frame?.score?.high ?? 0);
  const phase = String(frame?.phase ?? '');

  const onExit = () => {
    const ws = wsRef.current;
    try {
      if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify({ t: 'cmd', cmd: 'exit' }));
    } catch {
      // ignore
    }
    try {
      const targetOrigin = trustedParentOriginRef.current || resolveBootstrapParentOrigin(coreOrigin);
      if (typeof window !== 'undefined' && window.parent && isEmbedded && targetOrigin) {
        window.parent.postMessage(
          { source: 'moltstation-runtime', event: 'runtime_exit', payload: { reason: 'exit' } },
          targetOrigin
        );
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    if (!isEmbedded) return;
    function onMessage(evt: MessageEvent) {
      const trusted = trustedParentOriginRef.current;
      if (trusted) {
        if (evt.origin !== trusted) return;
      } else {
        if (!ALLOWED_PARENT_ORIGINS.has(evt.origin)) return;
        trustedParentOriginRef.current = evt.origin;
      }
      const data = evt.data;
      if (!data || typeof data !== 'object') return;
      if (String((data as any).t ?? '') !== 'core_cmd') return;
      if (String((data as any).cmd ?? '') !== 'exit') return;
      const msgSessionId = String((data as any).sessionId ?? '').trim();
      if (msgSessionId && msgSessionId !== sessionId) return;
      onExitRef.current();
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isEmbedded, sessionId]);

  if (!sessionId) {
    return (
      <main style={{ padding: 24, fontFamily: 'monospace', color: '#d7f7ff', background: '#05060a' }}>
        <h1>ShellRunners</h1>
        <p>Missing session id. Open from MoltStation Core.</p>
      </main>
    );
  }

  if (!isEmbedded) {
    return (
      <main style={{ padding: 24, fontFamily: 'monospace', color: '#d7f7ff', background: '#05060a' }}>
        <h1>ShellRunners</h1>
        <p>Play token required. Open from MoltStation Core.</p>
      </main>
    );
  }

  return (
    <main
      style={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: '#05060a',
        color: '#d7f7ff',
        fontFamily: 'monospace',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'stretch',
      }}
    >
      <section
        style={{
          flex: 1,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <strong>ShellRunners</strong>
          <span style={{ opacity: 0.8, fontSize: 12 }}>session: {sessionId}</span>
        </header>

        <div
          style={{
            border: '1px solid rgba(215,247,255,0.25)',
            borderRadius: 12,
            padding: 14,
            background: 'rgba(10,12,18,0.65)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 12px 30px rgba(0,0,0,0.55)',
          }}
        >
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={{ opacity: 0.75, fontSize: 12 }}>Status</div>
              <div style={{ fontSize: 16 }}>{status === 'connected' ? phase || 'connected' : status}</div>
            </div>
            <div>
              <div style={{ opacity: 0.75, fontSize: 12 }}>Elapsed</div>
              <div style={{ fontSize: 16 }}>{formatElapsed(elapsed)}</div>
            </div>
            <div>
              <div style={{ opacity: 0.75, fontSize: 12 }}>Score</div>
              <div style={{ fontSize: 16 }}>
                {scoreCurrent} (high {scoreHigh})
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
              <div style={{ opacity: 0.7, fontSize: 12, alignSelf: 'center' }}>
                Controls: A/D or Left/Right
              </div>
              <button
                type='button'
                onClick={onExit}
                style={{
                  borderRadius: 10,
                  padding: '10px 12px',
                  border: '1px solid rgba(215,247,255,0.25)',
                  background: 'rgba(5,6,10,0.35)',
                  color: '#d7f7ff',
                  cursor: 'pointer',
                }}
              >
                Exit Game
              </button>
            </div>
          </div>
          {error ? <p style={{ marginTop: 10, color: '#ffb38a' }}>{error}</p> : null}
        </div>

        <div
          style={{
            flex: 1,
            display: 'grid',
            placeItems: 'center',
            border: '1px solid rgba(215,247,255,0.14)',
            borderRadius: 14,
            background: 'rgba(10,12,18,0.35)',
            overflow: 'hidden',
            minHeight: 240,
            position: 'relative',
          }}
        >
          <FrameCanvas frame={frame} />

          <div style={{ position: 'absolute', left: 18, bottom: 18, display: 'flex', gap: 10 }}>
            <button
              type='button'
              onMouseDown={() => {
                const ws = wsRef.current;
                pressedRef.current.left = true;
                if (ws) sendDir(ws, computeDir());
              }}
              onMouseUp={() => {
                const ws = wsRef.current;
                pressedRef.current.left = false;
                if (ws) sendDir(ws, computeDir());
              }}
              onMouseLeave={() => {
                const ws = wsRef.current;
                pressedRef.current.left = false;
                if (ws) sendDir(ws, computeDir());
              }}
              style={{
                borderRadius: 10,
                padding: '10px 12px',
                border: '1px solid rgba(215,247,255,0.18)',
                background: 'rgba(5,6,10,0.35)',
                color: '#d7f7ff',
                cursor: 'pointer',
              }}
            >
              Left
            </button>
            <button
              type='button'
              onMouseDown={() => {
                const ws = wsRef.current;
                pressedRef.current.right = true;
                if (ws) sendDir(ws, computeDir());
              }}
              onMouseUp={() => {
                const ws = wsRef.current;
                pressedRef.current.right = false;
                if (ws) sendDir(ws, computeDir());
              }}
              onMouseLeave={() => {
                const ws = wsRef.current;
                pressedRef.current.right = false;
                if (ws) sendDir(ws, computeDir());
              }}
              style={{
                borderRadius: 10,
                padding: '10px 12px',
                border: '1px solid rgba(215,247,255,0.18)',
                background: 'rgba(5,6,10,0.35)',
                color: '#d7f7ff',
                cursor: 'pointer',
              }}
            >
              Right
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
