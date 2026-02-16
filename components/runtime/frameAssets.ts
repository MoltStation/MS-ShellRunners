type Img = HTMLImageElement;

export type FrameEntity =
  | { id: string; k: 'obstacle'; t?: string; tex?: string; x: number; y: number; w: number; h: number }
  | { id: string; k: 'collectible'; t?: string; tex?: string; x: number; y: number }
  | { id: string; k: 'powerup'; t?: string; x: number; y: number };

export type SimFrame = {
  v?: number;
  sessionId?: string;
  tick?: number;
  tMs?: number;
  phase?: string;
  pawn?: { x?: number; y?: number; ghost?: boolean; invincible?: boolean };
  score?: { current?: number; high?: number };
  lives?: number;
  hunger?: number;
  entities?: FrameEntity[];
};

function resolveObstacleUrl(tex: string) {
  const key = String(tex || '').trim();
  if (!key) return '';
  return `/assets/img/obstacles/${encodeURIComponent(key)}.png`;
}

function resolveCollectibleUrl(tex: string) {
  const key = String(tex || '').trim();
  if (!key) return '';
  return `/assets/img/${encodeURIComponent(key)}.png`;
}

function resolvePowerUpUrl(kind: string) {
  const k = String(kind || '').trim();
  if (!k) return '';
  if (k === 'MovementSpeedPowerUp') return '/assets/img/movement_power.png';
  if (k === 'InvincibilityPowerUp') return '/assets/img/invincibility_power.png';
  if (k === 'ScrollSpeedSlowPowerUp') return '/assets/img/slow_scroll_power.png';
  return '';
}

export function resolveEntityImageUrl(e: FrameEntity) {
  if (!e || typeof e !== 'object') return '';
  if (e.k === 'obstacle') return resolveObstacleUrl(String((e as any).tex || ''));
  if (e.k === 'collectible') return resolveCollectibleUrl(String((e as any).tex || ''));
  if (e.k === 'powerup') return resolvePowerUpUrl(String((e as any).t || ''));
  return '';
}

export type AssetCache = {
  pawn: Img;
  water: Img;
  leftBank: Img;
  rightBank: Img;
  fillGrass: Img;
  grassEdge: Img;
  obstacle: Map<string, Img>;
  collectible: Map<string, Img>;
  powerup: Map<string, Img>;
};

function makeImg(url: string) {
  const img = new Image();
  // Same-origin; allow browser caching.
  img.decoding = 'async';
  img.loading = 'eager';
  img.src = url;
  return img;
}

export function createAssetCache(): AssetCache {
  return {
    pawn: makeImg('/assets/img/shellrunner.png'),
    water: makeImg('/assets/img/back/water_1.png'),
    leftBank: makeImg('/assets/img/back/left_bank_1.png'),
    rightBank: makeImg('/assets/img/back/right_bank_1.png'),
    fillGrass: makeImg('/assets/img/back/fill_grass.png'),
    grassEdge: makeImg('/assets/img/back/grass_1.png'),
    obstacle: new Map(),
    collectible: new Map(),
    powerup: new Map(),
  };
}

function getOrLoad(map: Map<string, Img>, url: string) {
  if (!url) return null;
  const existing = map.get(url);
  if (existing) return existing;
  const img = makeImg(url);
  map.set(url, img);
  return img;
}

export function resolveImagesForFrame(cache: AssetCache, frame: SimFrame | null) {
  if (!cache || !frame) return;
  const entities = Array.isArray(frame.entities) ? frame.entities : [];
  for (const e of entities) {
    const url = resolveEntityImageUrl(e);
    if (!url) continue;
    if (e.k === 'obstacle') getOrLoad(cache.obstacle, url);
    else if (e.k === 'collectible') getOrLoad(cache.collectible, url);
    else if (e.k === 'powerup') getOrLoad(cache.powerup, url);
  }
}

export function getEntityImage(cache: AssetCache, e: FrameEntity) {
  const url = resolveEntityImageUrl(e);
  if (!url) return null;
  if (e.k === 'obstacle') return getOrLoad(cache.obstacle, url);
  if (e.k === 'collectible') return getOrLoad(cache.collectible, url);
  if (e.k === 'powerup') return getOrLoad(cache.powerup, url);
  return null;
}
