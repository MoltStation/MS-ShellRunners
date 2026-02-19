import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { SimFrame, FrameEntity } from './frameAssets';
import FrameCanvas from './FrameCanvas';

const DESIGN_W = 1920;
const DESIGN_H = 1080;
const SIDE_BANK_W = 170;
const SIDE_GRASS_FILL_W = 56;
const SIDE_GRASS_EDGE_W = 38;
const SIDE_OVERLAY_W = SIDE_BANK_W + SIDE_GRASS_FILL_W + SIDE_GRASS_EDGE_W;

function resolveAllowedParentOrigins() {
  const defaults = [
    'https://moltstation.games',
    'https://www.moltstation.games',
    'http://127.0.0.1:3000',
    'http://localhost:3000',
  ];
  const extra = String(process.env.NEXT_PUBLIC_CORE_ALLOWED_ORIGINS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return new Set([...defaults, ...extra]);
}

const ALLOWED_PARENT_ORIGINS = resolveAllowedParentOrigins();
const TOKEN_RECOVERY_REASONS = new Set([
  'TOKEN_REPLAYED',
  'TOKEN_EXPIRED',
  'TOKEN_NOT_FOUND',
  'INVALID_TOKEN',
]);
const CRITICAL_ASSET_KEYS = new Set([
  'pawn',
  'water_1',
  'left_bank_1',
  'right_bank_1',
  'fill_grass',
  'grass_1',
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
  if (typeof window === 'undefined') return 'https://api.moltstation.games';
  const host = String(window.location.hostname || '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:4100';
  return 'https://api.moltstation.games';
}

function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function resolveCoreOriginFromQuery(fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const fallbackUrl = String(fallback || '').trim() || 'https://moltstation.games';
  try {
    const params = new URLSearchParams(window.location.search);
    const coreOrigin = String(params.get('coreOrigin') || '').trim();
    if (coreOrigin) return new URL(coreOrigin).origin;
  } catch {
    // ignore
  }
  return fallbackUrl;
}

function resolvePowerUpKey(kind: string) {
  const k = String(kind || '').trim();
  if (k === 'MovementSpeedPowerUp') return 'pow_movement';
  if (k === 'InvincibilityPowerUp') return 'pow_invincibility';
  if (k === 'ScrollSpeedSlowPowerUp') return 'pow_slow';
  return '';
}

type PlayHandshake = {
  token: string;
  sessionId: string;
  slug: string;
};

type Dir = 'left' | 'right' | 'none';

export default function EmbeddedPhaserPlay() {
  const router = useRouter();
  const sessionId = String(router.query?.sessionId ?? '').trim();

  const [isEmbedded, setIsEmbedded] = useState(false);
  const [handshake, setHandshake] = useState<PlayHandshake | null>(null);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'connecting' | 'connected' | 'error'>(
    'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<SimFrame | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [renderStatus, setRenderStatus] = useState<'booting' | 'loading' | 'ready' | 'error'>(
    'booting'
  );
  const [renderError, setRenderError] = useState<string>('');
  const [hudMinimized, setHudMinimized] = useState(false);
  const criticalLoadFailedRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);
  const wsKeyRef = useRef(0);
  const closingRef = useRef(false);
  const lastDirRef = useRef<Dir>('none');
  const pressedRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const onExitRef = useRef<() => void>(() => {});

  const phaserParentRef = useRef<HTMLDivElement | null>(null);
  const phaserRef = useRef<any>(null);
  const phaserSceneRef = useRef<any>(null);
  const phaserObjectsRef = useRef<{
    pawn?: any;
    entities: Map<string, any>;
    bg?: any;
    water?: any;
    leftBank?: any;
    rightBank?: any;
    grassLeft?: any;
    grassRight?: any;
    grassEdgeLeft?: any;
    grassEdgeRight?: any;
  }>({ entities: new Map() });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSfxTickRef = useRef<number>(-1);

  const apiBase = useMemo(() => resolveApiBase(), []);
  const wsBase = useMemo(() => resolveWsBaseFromApi(apiBase), [apiBase]);
  const coreOrigin = useMemo(
    () =>
      resolveCoreOriginFromQuery(
        (process.env.NEXT_PUBLIC_CORE_LANDING_URL as string) || 'https://moltstation.games'
      ),
    []
  );

  useEffect(() => {
    setIsEmbedded(typeof window !== 'undefined' && window.top !== window.self);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    if (typeof window === 'undefined') return;
    if (window.top === window.self) return;

    const msg = { t: 'play_ready', sessionId };
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
      const mode = String((data as any).mode ?? '').trim();
      if (mode && mode !== 'play') return;
      if (!token || !slug || !msgSessionId) return;
      if (msgSessionId !== sessionId) return;
      setHandshake((prev) => {
        // Core can post the same token multiple times (load + ready retries).
        // Ignore identical handshakes so one-time WS tokens are not replayed.
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

  const postRuntimeExit = (reason: string) => {
    try {
      if (typeof window === 'undefined' || !isEmbedded || !window.parent) return false;
      window.parent.postMessage(
        {
          source: 'moltstation-runtime',
          event: 'runtime_exit',
          payload: { reason, sessionId },
        },
        coreOrigin
      );
      return true;
    } catch {
      try {
        window.parent?.postMessage(
          {
            source: 'moltstation-runtime',
            event: 'runtime_exit',
            payload: { reason, sessionId },
          },
          '*'
        );
      } catch {
        // ignore
      }
      return false;
    }
  };

  const postPlayTokenNeeded = (reason: string) => {
    try {
      if (typeof window === 'undefined' || !isEmbedded || !window.parent) return false;
      window.parent.postMessage(
        {
          source: 'moltstation-runtime',
          event: 'play_token_needed',
          payload: { reason, sessionId, slug: handshake?.slug || 'shellrunners' },
        },
        coreOrigin
      );
      return true;
    } catch {
      try {
        window.parent?.postMessage(
          {
            source: 'moltstation-runtime',
            event: 'play_token_needed',
            payload: { reason, sessionId, slug: handshake?.slug || 'shellrunners' },
          },
          '*'
        );
      } catch {
        // ignore
      }
      return false;
    }
  };

  const onExit = () => {
    const ws = wsRef.current;
    try {
      if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify({ t: 'cmd', cmd: 'exit' }));
    } catch {
      // ignore
    }
    postRuntimeExit('exit');
  };

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    if (!isEmbedded) return;
    function onMessage(evt: MessageEvent) {
      if (!ALLOWED_PARENT_ORIGINS.has(evt.origin)) return;
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

  useEffect(() => {
    if (!handshake) return;
    if (!wsBase) {
      setStatus('error');
      setError('WS base URL not configured.');
      return;
    }

    setStatus('connecting');
    setError(null);
    closingRef.current = false;

    wsKeyRef.current += 1;
    const wsKey = wsKeyRef.current;

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
        if (msg?.t === 'frame') {
          const nextFrame = (msg.frame ?? null) as any;
          setFrame(nextFrame);

          // Minimal SFX: play on events for the newest tick only.
          const tick = Number(nextFrame?.tick ?? -1);
          if (soundEnabled && Number.isFinite(tick) && tick > lastSfxTickRef.current) {
            lastSfxTickRef.current = tick;
            const events = Array.isArray(nextFrame?.events) ? nextFrame.events : [];
            for (const e of events) {
              const t = String(e?.t ?? '');
              if (t === 'collect') {
                const a = new Audio('/assets/audio/starFish.wav');
                a.volume = 0.6;
                void a.play().catch(() => {});
              } else if (t === 'powerup') {
                const a = new Audio('/assets/audio/powerup.wav');
                a.volume = 0.65;
                void a.play().catch(() => {});
              } else if (t === 'death' || t === 'game_over') {
                const a = new Audio('/assets/audio/collision.wav');
                a.volume = 0.7;
                void a.play().catch(() => {});
              }
            }
          }
        }
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
      const reason = String(evt?.reason || '').trim();
      if (reason === 'GAME_OVER' || reason === 'EXIT') {
        // Let core close the iframe.
        postRuntimeExit(reason === 'EXIT' ? 'exit' : 'game_over');
        return;
      }
      if (TOKEN_RECOVERY_REASONS.has(reason)) {
        setStatus('connecting');
        setError('Refreshing play token...');
        postPlayTokenNeeded(reason);
        return;
      }
      setStatus('error');
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

  // Audio: start only after a gesture inside the iframe.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!soundEnabled) return;
    if (!audioRef.current) {
      const audio = new Audio('/assets/audio/bgm.wav');
      audio.loop = true;
      audio.volume = 0.55;
      audioRef.current = audio;
    }
    const audio = audioRef.current;
    if (!audio) return;
    void audio.play().catch(() => {});
    return () => {
      try {
        audio.pause();
      } catch {
        // ignore
      }
    };
  }, [soundEnabled]);

  // Phaser renderer: create once.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!phaserParentRef.current) return;
    if (phaserRef.current) return;

    let destroyed = false;

    (async () => {
      const PhaserMod: any = await import('phaser');
      if (destroyed) return;
      const Phaser = PhaserMod.default ?? PhaserMod;

      const scene = new Phaser.Scene('ws-render');
      phaserSceneRef.current = scene;

      scene.preload = function preload() {
        try {
          setRenderStatus('loading');
          setRenderError('');
          criticalLoadFailedRef.current = false;
        } catch {
          // ignore
        }

        // Surface asset load failures (helps debug "black screen" cases).
        this.load.on('loaderror', (_: any, file: any) => {
          try {
            const key = String(file?.key || '').trim();
            const src = String(file?.src || '').trim();
            if (CRITICAL_ASSET_KEYS.has(key)) {
              criticalLoadFailedRef.current = true;
              setRenderStatus('error');
            }
            setRenderError(`Asset failed: ${key} (${src})`);
          } catch {
            // ignore
          }
        });

        // IMPORTANT: Do not call `setPath('/')` here. Phaser concatenates `path + url` and
        // using a leading "/" can yield URLs like "//assets/..." which browsers interpret
        // as protocol-relative hosts ("https://assets/..."), breaking loads.
        //
        // Use absolute paths rooted at the current origin.
        this.load.image('pawn', '/assets/img/shellrunner.png');
        this.load.image('water_1', '/assets/img/back/water_1.png');
        this.load.image('left_bank_1', '/assets/img/back/left_bank_1.png');
        this.load.image('right_bank_1', '/assets/img/back/right_bank_1.png');
        this.load.image('fill_grass', '/assets/img/back/fill_grass.png');
        this.load.image('grass_1', '/assets/img/back/grass_1.png');

        // Obstacles.
        for (let i = 1; i <= 3; i += 1) {
          this.load.image(`log_${i}`, `/assets/img/obstacles/log_${i}.png`);
        }
        for (let i = 1; i <= 6; i += 1) {
          this.load.image(`rock_${i}`, `/assets/img/obstacles/rock_${i}.png`);
        }

        // Collectibles.
        this.load.image('orange_star_fish', '/assets/img/orange_star_fish.png');
        this.load.image('yellow_star_fish', '/assets/img/yellow_star_fish.png');
        this.load.image('red_star_fish', '/assets/img/red_star_fish.png');

        // PowerUps.
        this.load.image('pow_movement', '/assets/img/movement_power.png');
        this.load.image('pow_invincibility', '/assets/img/invincibility_power.png');
        this.load.image('pow_slow', '/assets/img/slow_scroll_power.png');
      };

      scene.create = function create() {
        try {
          if (!criticalLoadFailedRef.current) {
            setRenderStatus('ready');
            setRenderError('');
          }
        } catch {
          // ignore
        }
        // Richer background layer to better match the full game visual style.
        const g = this.add.graphics();
        phaserObjectsRef.current.bg = g;
        g.fillStyle(0x0b2b46, 1);
        g.fillRect(0, 0, DESIGN_W, DESIGN_H);

        // Water across full width so transparent pixels in side assets never show black gaps.
        const water = this.add.tileSprite(DESIGN_W * 0.5, DESIGN_H * 0.5, DESIGN_W, DESIGN_H, 'water_1');
        water.setOrigin(0.5, 0.5);
        water.setAlpha(0.95);
        phaserObjectsRef.current.water = water;

        // First draw stretched grass all the way to the wall.
        const grassLeft = this.add.tileSprite(
          SIDE_OVERLAY_W * 0.5,
          DESIGN_H * 0.5,
          SIDE_OVERLAY_W,
          DESIGN_H,
          'fill_grass'
        );
        grassLeft.setOrigin(0.5, 0.5);
        grassLeft.setAlpha(0.58);
        phaserObjectsRef.current.grassLeft = grassLeft;

        const grassRight = this.add.tileSprite(
          DESIGN_W - SIDE_OVERLAY_W * 0.5,
          DESIGN_H * 0.5,
          SIDE_OVERLAY_W,
          DESIGN_H,
          'fill_grass'
        );
        grassRight.setOrigin(0.5, 0.5);
        grassRight.setAlpha(0.58);
        phaserObjectsRef.current.grassRight = grassRight;

        const grassEdgeLeft = this.add.tileSprite(
          SIDE_OVERLAY_W - SIDE_GRASS_EDGE_W * 0.5,
          DESIGN_H * 0.5,
          SIDE_GRASS_EDGE_W,
          DESIGN_H,
          'grass_1'
        );
        grassEdgeLeft.setOrigin(0.5, 0.5);
        grassEdgeLeft.setAlpha(0.85);
        phaserObjectsRef.current.grassEdgeLeft = grassEdgeLeft;

        const grassEdgeRight = this.add.tileSprite(
          DESIGN_W - SIDE_OVERLAY_W + SIDE_GRASS_EDGE_W * 0.5,
          DESIGN_H * 0.5,
          SIDE_GRASS_EDGE_W,
          DESIGN_H,
          'grass_1'
        );
        grassEdgeRight.setOrigin(0.5, 0.5);
        grassEdgeRight.setAlpha(0.85);
        phaserObjectsRef.current.grassEdgeRight = grassEdgeRight;

        // Then place the sand bank on top.
        const leftBank = this.add.tileSprite(
          SIDE_BANK_W * 0.5,
          DESIGN_H * 0.5,
          SIDE_BANK_W,
          DESIGN_H,
          'left_bank_1'
        );
        leftBank.setOrigin(0.5, 0.5);
        leftBank.setAlpha(0.94);
        phaserObjectsRef.current.leftBank = leftBank;

        const rightBank = this.add.tileSprite(
          DESIGN_W - SIDE_BANK_W * 0.5,
          DESIGN_H * 0.5,
          SIDE_BANK_W,
          DESIGN_H,
          'right_bank_1'
        );
        rightBank.setOrigin(0.5, 0.5);
        rightBank.setAlpha(0.94);
        phaserObjectsRef.current.rightBank = rightBank;

        const pawn = this.add.image(960, 972, 'pawn');
        pawn.setOrigin(0.5, 0.5);
        pawn.setDisplaySize(140, 140);
        pawn.setAlpha(0.95);
        phaserObjectsRef.current.pawn = pawn;
      };

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: phaserParentRef.current!,
        width: DESIGN_W,
        height: DESIGN_H,
        transparent: true,
        scale: {
          // Fill the iframe viewport to avoid "mini game" appearance.
          // ENVELOP preserves aspect ratio and crops edges if needed.
          mode: Phaser.Scale.ENVELOP,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        audio: { noAudio: true }, // Use HTMLAudio to keep gesture rules predictable.
        scene,
      });
      phaserRef.current = game;
    })().catch((e: any) => {
      try {
        setRenderStatus('error');
        setRenderError(String(e?.message || e));
      } catch {
        // ignore
      }
    });

    return () => {
      destroyed = true;
      try {
        phaserRef.current?.destroy(true);
      } catch {
        // ignore
      }
      phaserRef.current = null;
      phaserSceneRef.current = null;
      phaserObjectsRef.current = { entities: new Map() };
    };
  }, []);

  // If Phaser claims it's ready but the canvas isn't mounted, surface an error so we show the fallback renderer.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (renderStatus !== 'ready') return;
    const el = phaserParentRef.current;
    if (!el) return;
    const id = window.setTimeout(() => {
      const canvas = el.querySelector('canvas');
      if (!canvas) {
        setRenderStatus('error');
        setRenderError('Phaser canvas not mounted');
        return;
      }
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) {
        setRenderStatus('error');
        setRenderError('Phaser canvas has zero size');
      }
    }, 1200);
    return () => window.clearTimeout(id);
  }, [renderStatus]);

  // Apply frames to Phaser objects.
  useEffect(() => {
    const scene = phaserSceneRef.current;
    if (!scene || !frame) return;
    const store = phaserObjectsRef.current;
    if (!store || !store.pawn) return;
    // Avoid applying frames before the scene is booted/created (can happen if frames arrive very fast).
    if (!(scene as any).sys || !(scene as any).sys.isBooted) return;
    const existing = store.entities;

    const entities: FrameEntity[] = Array.isArray(frame.entities) ? (frame.entities as any) : [];
    const nextIds = new Set<string>();

    for (const e of entities) {
      const id = String((e as any).id ?? '');
      if (!id) continue;
      nextIds.add(id);

      let obj = existing.get(id);
      if (!obj) {
        let key = '';
        if (e.k === 'obstacle') key = String((e as any).tex ?? '');
        else if (e.k === 'collectible') key = String((e as any).tex ?? '');
        else if (e.k === 'powerup') key = resolvePowerUpKey(String((e as any).t ?? ''));

        if (!key) continue;
        try {
          obj = scene.add.image(Number((e as any).x ?? 0), Number((e as any).y ?? 0), key);
        } catch {
          continue;
        }
        obj.setOrigin(0.5, 0.5);
        existing.set(id, obj);
      }

      obj.setPosition(Number((e as any).x ?? 0), Number((e as any).y ?? 0));
      if (e.k === 'obstacle') {
        obj.setDisplaySize(Number((e as any).w ?? 120), Number((e as any).h ?? 120));
      } else if (e.k === 'collectible') {
        obj.setDisplaySize(100, 100);
      } else if (e.k === 'powerup') {
        obj.setDisplaySize(150, 150);
      }
    }

    for (const [id, obj] of existing.entries()) {
      if (!nextIds.has(id)) {
        try {
          obj.destroy();
        } catch {
          // ignore
        }
        existing.delete(id);
      }
    }

    const pawn = store.pawn;
    if (pawn) {
      pawn.setPosition(Number(frame.pawn?.x ?? 960), Number(frame.pawn?.y ?? 972));
      pawn.setAlpha(frame.pawn?.ghost ? 0.55 : 0.95);
      if (frame.pawn?.invincible) pawn.setTint(0xff4d6e);
      else pawn.clearTint();
    }

    const scroll = Number(frame.tMs ?? 0) * 0.12;
    if (store.water) {
      store.water.tilePositionY = scroll * 1.2;
      store.water.tilePositionX = scroll * 0.08;
    }
    if (store.leftBank) store.leftBank.tilePositionY = scroll * 0.32;
    if (store.rightBank) store.rightBank.tilePositionY = scroll * 0.32;
    if (store.grassLeft) store.grassLeft.tilePositionY = scroll * 0.55;
    if (store.grassRight) store.grassRight.tilePositionY = scroll * 0.55;
    if (store.grassEdgeLeft) store.grassEdgeLeft.tilePositionY = scroll * 0.75;
    if (store.grassEdgeRight) store.grassEdgeRight.tilePositionY = scroll * 0.75;
  }, [frame]);

  useEffect(() => {
    return () => {
      try {
        audioRef.current?.pause();
      } catch {
        // ignore
      }
      audioRef.current = null;
    };
  }, []);

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

  const elapsed = Number(frame?.tMs ?? 0);
  const scoreCurrent = Number(frame?.score?.current ?? 0);
  const scoreHigh = Number(frame?.score?.high ?? 0);
  const phase = String(frame?.phase ?? '');
  const entityCount = Array.isArray(frame?.entities) ? frame!.entities!.length : 0;
  const isPaused = phase === 'paused';

  const togglePause = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== ws.OPEN) return;
    const cmd = isPaused ? 'resume' : 'pause';
    try {
      ws.send(JSON.stringify({ t: 'cmd', cmd }));
    } catch {
      // ignore
    }
  };

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
      {/* Fallback (always works): used until Phaser is fully ready. */}
      {renderStatus !== 'ready' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <FrameCanvas frame={frame} />
        </div>
      )}
      <div
        ref={phaserParentRef}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'block',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* HUD */}
      <div
        style={{
          position: 'absolute',
          right: 14,
          top: 14,
          display: 'grid',
          gap: 10,
          pointerEvents: 'auto',
          zIndex: 20,
        }}
      >
        <div
          style={{
            border: '1px solid rgba(215,247,255,0.22)',
            borderRadius: 12,
            padding: 12,
            background: 'rgba(10,12,18,0.55)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 12px 28px rgba(0,0,0,0.55)',
            minWidth: 260,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: 8,
              top: 8,
              width: 96,
              opacity: 0.2,
              pointerEvents: 'none',
              zIndex: 0,
            }}>
            <img
              src='/assets/img/logo.png'
              alt=''
              aria-hidden='true'
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                filter: 'drop-shadow(0 0 12px rgba(16, 174, 255, 0.35))',
              }}
            />
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
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
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                  Renderer: {renderStatus}
                  {renderError ? <span style={{ color: '#ffb38a' }}> ({renderError})</span> : null}
                </div>
                <div style={{ marginTop: 10, display: 'grid', gap: 6, fontSize: 12, opacity: 0.9 }}>
                  <div>Elapsed: {formatElapsed(elapsed)}</div>
                  <div>
                    Score: {scoreCurrent} (high {scoreHigh})
                  </div>
                  <div>Entities: {entityCount}</div>
                </div>
                {error ? (
                  <div style={{ marginTop: 10, fontSize: 12, color: '#ffb38a' }}>{error}</div>
                ) : null}
              </>
            ) : null}
            {hudMinimized ? (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.78 }}>
                Score {scoreCurrent} | {formatElapsed(elapsed)}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 14,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          pointerEvents: 'auto',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type='button'
            onPointerDown={() => {
              const ws = wsRef.current;
              pressedRef.current.left = true;
              if (ws) sendDir(ws, computeDir());
            }}
            onPointerUp={() => {
              const ws = wsRef.current;
              pressedRef.current.left = false;
              if (ws) sendDir(ws, computeDir());
            }}
            onPointerCancel={() => {
              const ws = wsRef.current;
              pressedRef.current.left = false;
              if (ws) sendDir(ws, computeDir());
            }}
            style={{
              borderRadius: 12,
              padding: '10px 14px',
              border: '1px solid rgba(215,247,255,0.22)',
              background: 'rgba(10,12,18,0.50)',
              color: '#d7f7ff',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
            }}
          >
            Left
          </button>
          <button
            type='button'
            onPointerDown={() => {
              const ws = wsRef.current;
              pressedRef.current.right = true;
              if (ws) sendDir(ws, computeDir());
            }}
            onPointerUp={() => {
              const ws = wsRef.current;
              pressedRef.current.right = false;
              if (ws) sendDir(ws, computeDir());
            }}
            onPointerCancel={() => {
              const ws = wsRef.current;
              pressedRef.current.right = false;
              if (ws) sendDir(ws, computeDir());
            }}
            style={{
              borderRadius: 12,
              padding: '10px 14px',
              border: '1px solid rgba(215,247,255,0.22)',
              background: 'rgba(10,12,18,0.50)',
              color: '#d7f7ff',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
            }}
          >
            Right
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type='button'
            onClick={() => setSoundEnabled((v) => !v)}
            style={{
              borderRadius: 12,
              padding: '10px 14px',
              border: '1px solid rgba(215,247,255,0.22)',
              background: 'rgba(10,12,18,0.50)',
              color: '#d7f7ff',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
            }}
          >
            Sound: {soundEnabled ? 'On' : 'Off'}
          </button>
          <button
            type='button'
            onClick={togglePause}
            style={{
              borderRadius: 12,
              padding: '10px 14px',
              border: '1px solid rgba(215,247,255,0.22)',
              background: 'rgba(10,12,18,0.50)',
              color: '#d7f7ff',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
            }}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            type='button'
            onClick={onExit}
            style={{
              borderRadius: 12,
              padding: '10px 14px',
              border: '1px solid rgba(255, 77, 110, 0.45)',
              background: 'rgba(40, 10, 14, 0.35)',
              color: '#ffd1db',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
            }}
          >
            Exit
          </button>
        </div>
      </div>

    </main>
  );
}
