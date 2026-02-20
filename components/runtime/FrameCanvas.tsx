import { useEffect, useRef } from 'react';

import type { AssetCache, SimFrame, FrameEntity } from './frameAssets';
import { createAssetCache, getEntityImage, resolveImagesForFrame } from './frameAssets';

const DESIGN_W = 1920;
const DESIGN_H = 1080;
const SIDE_BANK_W = 148;
const BANK_VERTICAL_STRETCH = 80;

const PAWN_RADIUS = 20;
const COLLECTIBLE_RADIUS = 50;
const POWER_UP_RADIUS = 48;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function drawGlowRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.shadowColor = 'rgba(111, 228, 255, 0.20)';
  ctx.shadowBlur = 14;
  ctx.strokeStyle = 'rgba(111, 228, 255, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawImageCentered(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  w: number,
  h: number
) {
  if (!img || !img.complete) return false;
  const iw = img.naturalWidth || 0;
  const ih = img.naturalHeight || 0;
  if (iw <= 0 || ih <= 0) return false;
  ctx.drawImage(img, cx - w * 0.5, cy - h * 0.5, w, h);
  return true;
}

function drawImageStretched(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 1
) {
  if (!img || !img.complete) return false;
  const iw = img.naturalWidth || 0;
  const ih = img.naturalHeight || 0;
  if (iw <= 0 || ih <= 0) return false;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
  return true;
}

function drawEntity(
  ctx: CanvasRenderingContext2D,
  cache: AssetCache,
  e: FrameEntity
) {
  const x = Number((e as any).x ?? 0);
  const y = Number((e as any).y ?? 0);

  if (e.k === 'obstacle') {
    const w = Number((e as any).w ?? 120);
    const h = Number((e as any).h ?? 120);
    const img = getEntityImage(cache, e);
    if (!img || !drawImageCentered(ctx, img, x, y, w, h)) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x - w * 0.5, y - h * 0.5, w, h);
      ctx.strokeStyle = 'rgba(255,109,194,0.22)';
      ctx.strokeRect(x - w * 0.5, y - h * 0.5, w, h);
    }
    return;
  }

  if (e.k === 'collectible') {
    const r = COLLECTIBLE_RADIUS;
    const img = getEntityImage(cache, e);
    if (!img || !drawImageCentered(ctx, img, x, y, r * 2, r * 2)) {
      ctx.fillStyle = 'rgba(245,158,11,0.85)';
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (e.k === 'powerup') {
    const r = POWER_UP_RADIUS;
    const img = getEntityImage(cache, e);
    if (!img || !drawImageCentered(ctx, img, x, y, r * 2, r * 2)) {
      ctx.fillStyle = 'rgba(71,221,255,0.85)';
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
}

export default function FrameCanvas({
  frame,
  className,
  showHud = false,
}: {
  frame: SimFrame | null;
  className?: string;
  showHud?: boolean;
}) {
  const cacheRef = useRef<AssetCache | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!cacheRef.current) cacheRef.current = createAssetCache();
    resolveImagesForFrame(cacheRef.current, frame);
  }, [frame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [dpr]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const cache = cacheRef.current;
    if (!canvas || !cache) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    // Cover-fit design coords to canvas (prevents top/bottom black letterboxing).
    const scale = Math.max(cw / (DESIGN_W * dpr), ch / (DESIGN_H * dpr)) * dpr;
    const offsetX = (cw - DESIGN_W * scale) * 0.5;
    const offsetY = (ch - DESIGN_H * scale) * 0.5;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    // Background lane + banks (prefer texture assets, fallback to gradients/colors).
    ctx.fillStyle = '#0b2b46';
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    const bankW = SIDE_BANK_W;
    const laneX = SIDE_BANK_W;
    const laneW = DESIGN_W - laneX * 2;

    // Water across full width so transparent pixels in side assets never show black.
    const drewWater = drawImageStretched(ctx, cache.water, 0, 0, DESIGN_W, DESIGN_H, 0.96);
    if (!drewWater) {
      const grad = ctx.createLinearGradient(laneX, 0, laneX + laneW, 0);
      grad.addColorStop(0, '#071c2c');
      grad.addColorStop(0.5, '#0b2b46');
      grad.addColorStop(1, '#071c2c');
      ctx.fillStyle = grad;
      ctx.fillRect(laneX, 0, laneW, DESIGN_H);
    }

    // Draw only side banks (grass overlay removed).
    const bankY = -BANK_VERTICAL_STRETCH * 0.5;
    const bankH = DESIGN_H + BANK_VERTICAL_STRETCH;
    const drewLeftBank = drawImageStretched(ctx, cache.leftBank, 0, bankY, bankW, bankH, 0.94);
    const drewRightBank = drawImageStretched(
      ctx,
      cache.rightBank,
      DESIGN_W - bankW,
      bankY,
      bankW,
      bankH,
      0.94
    );
    if (!drewLeftBank) {
      ctx.fillStyle = '#061018';
      ctx.fillRect(0, bankY, bankW, bankH);
    }
    if (!drewRightBank) {
      ctx.fillStyle = '#061018';
      ctx.fillRect(DESIGN_W - bankW, bankY, bankW, bankH);
    }

    // Soft scanline overlay.
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#000';
    for (let y = 0; y < DESIGN_H; y += 6) {
      ctx.fillRect(0, y, DESIGN_W, 2);
    }
    ctx.restore();

    const entities: FrameEntity[] = Array.isArray(frame?.entities) ? (frame!.entities as any) : [];
    for (const e of entities) drawEntity(ctx, cache, e);

    // Pawn.
    const px = Number(frame?.pawn?.x ?? 960);
    const py = Number(frame?.pawn?.y ?? 972);
    const ghost = Boolean(frame?.pawn?.ghost);
    const inv = Boolean(frame?.pawn?.invincible);

    ctx.save();
    if (ghost) ctx.globalAlpha = 0.55;
    if (inv) {
      ctx.shadowColor = 'rgba(255, 77, 110, 0.55)';
      ctx.shadowBlur = 18;
    } else {
      ctx.shadowColor = 'rgba(111, 228, 255, 0.25)';
      ctx.shadowBlur = 14;
    }

    const pawnSize = PAWN_RADIUS * 7; // make it visible (sprite is small relative to design units)
    if (!drawImageCentered(ctx, cache.pawn, px, py, pawnSize, pawnSize)) {
      ctx.fillStyle = inv
        ? 'rgba(255,77,110,0.9)'
        : ghost
          ? 'rgba(223,244,255,0.55)'
          : 'rgba(223,244,255,0.9)';
      ctx.beginPath();
      ctx.arc(px, py, PAWN_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (showHud) {
      // Optional HUD overlay for standalone debug use.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const hudW = 320;
      const hudH = 96;
      ctx.fillStyle = 'rgba(5,6,10,0.55)';
      ctx.fillRect(16, 16, hudW, hudH);
      drawGlowRect(ctx, 16, 16, hudW, hudH);

      const lives = Number(frame?.lives ?? 0);
      const hunger = Number(frame?.hunger ?? 0);
      const score = Number(frame?.score?.current ?? 0);
      ctx.fillStyle = '#d7f7ff';
      ctx.font = '12px monospace';
      ctx.fillText(`Score: ${score}`, 28, 44);
      ctx.fillText(`Lives: ${lives}`, 28, 66);
      ctx.fillText(`Hunger: ${Math.floor(clamp(hunger, 0, 220))}/220`, 28, 88);
    }
  }, [frame, dpr, showHud]);

  return (
    <div ref={wrapRef} className={className} style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
