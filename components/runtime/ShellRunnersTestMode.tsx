import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import FrameCanvas from './FrameCanvas';
import type { FrameEntity, SimFrame } from './frameAssets';

type PowerupType = 'movement' | 'invincibility' | 'slow';
type PracticeEntityKind = 'obstacle' | 'collectible' | 'powerup';

type PracticeEntity = {
  id: string;
  k: PracticeEntityKind;
  t?: string;
  tex?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  powerup?: PowerupType;
};

type GameSnapshot = {
  status: 'ready' | 'running' | 'ended';
  playerX: number;
  score: number;
  highScore: number;
  lives: number;
  livesMax: number;
  hunger: number;
  hungerMax: number;
  scrollSpeed: number;
  tMs: number;
  tick: number;
  ghostMs: number;
  invincibleMs: number;
  slowMs: number;
  movementMs: number;
  hungerTickMs: number;
  speedIncreaseCountdownMs: number;
  speedTween: {
    from: number;
    to: number;
    elapsedMs: number;
    durationMs: number;
  } | null;
  entities: PracticeEntity[];
  message: string;
};

const DESIGN_W = 1920;
const DESIGN_H = 1080;
const CAM_CENTER_X = 960;
const PLAYER_Y = 972;
const PLAYER_MIN_X = 270;
const PLAYER_MAX_X = DESIGN_W - 270;
const PLAYER_SPEED_PX_PER_SECOND = 540;
const PLAYER_RADIUS = 64;
const ENTITY_CULL_Y = DESIGN_H + 180;

const HUNGER_EMPTY = 220;
const HUNGER_INC = 5;
const HUNGER_DEC = 45;
const HUNGER_THRESHOLD_MS = 500;
const COLLECTIBLE_SCORE_MULT = 100;
const INIT_SCROLL_SPEED = 0.055;
const MAX_SCROLL_SPEED = 0.38;
const SPEED_INCREASE_THRESHOLD_MS = 24000;
const SPEED_INCREASE = 0.018;
const SPEED_INCREASE_TWEEN_MS = 6000;
const GHOST_DURATION_MS = 1850;
const INVINCIBLE_DURATION_MS = 5500;
const MOVE_BOOST_DURATION_MS = 5000;
const SCROLL_SLOW_DURATION_MS = 4500;

const OBSTACLE_TEXTURES = [
  'rock_1',
  'rock_2',
  'rock_3',
  'rock_4',
  'rock_5',
  'rock_6',
  'log_1',
  'log_2',
  'log_3',
];
const COLLECTIBLE_TEXTURES = ['orange_star_fish', 'yellow_star_fish', 'red_star_fish'];
const POWERUP_TYPES: PowerupType[] = ['movement', 'invincibility', 'slow'];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)] as T;
}

function readBestScore() {
  if (typeof window === 'undefined') return 0;
  return Number(window.localStorage.getItem('shellrunners.practice.best') || 0) || 0;
}

function writeBestScore(score: number) {
  if (typeof window === 'undefined') return;
  const best = Math.max(readBestScore(), Math.floor(score));
  window.localStorage.setItem('shellrunners.practice.best', String(best));
}

function randomX() {
  return Math.round(PLAYER_MIN_X + Math.random() * (PLAYER_MAX_X - PLAYER_MIN_X));
}

function makeObstacle(id: number, y = -120): PracticeEntity {
  const tex = randomFrom(OBSTACLE_TEXTURES);
  const isLog = tex.startsWith('log_');
  return {
    id: `practice-obstacle-${id}`,
    k: 'obstacle',
    t: isLog ? 'Log' : 'Rock',
    tex,
    x: randomX(),
    y,
    w: isLog ? 190 : 132,
    h: isLog ? 95 : 132,
  };
}

function makeCollectible(id: number, y = -120): PracticeEntity {
  return {
    id: `practice-food-${id}`,
    k: 'collectible',
    t: 'StarFish',
    tex: randomFrom(COLLECTIBLE_TEXTURES),
    x: randomX(),
    y,
  };
}

function makePowerup(id: number, y = -120): PracticeEntity {
  const powerup = randomFrom(POWERUP_TYPES);
  return {
    id: `practice-powerup-${id}`,
    k: 'powerup',
    t:
      powerup === 'movement'
        ? 'MovementSpeedPowerUp'
        : powerup === 'invincibility'
          ? 'InvincibilityPowerUp'
          : 'ScrollSlowPowerUp',
    powerup,
    x: randomX(),
    y,
  };
}

function makeEntity(id: number, score: number, playerX: number): PracticeEntity {
  const roll = Math.random();
  if (roll > 0.9) return makePowerup(id);
  if (roll > 0.66) return makeCollectible(id);
  const obstacle = makeObstacle(id);
  if (Math.random() > 0.44) {
    obstacle.x = clamp(playerX + (Math.random() * 2 - 1) * 220, PLAYER_MIN_X, PLAYER_MAX_X);
  }
  const scoreSpread = Math.min(170, score / 12);
  obstacle.x = clamp(obstacle.x + (Math.random() * 2 - 1) * scoreSpread, PLAYER_MIN_X, PLAYER_MAX_X);
  return obstacle;
}

function makeInitialEntities() {
  return [
    makeObstacle(1, -90),
    makeCollectible(2, 160),
    makeObstacle(3, 430),
    makePowerup(4, 700),
  ];
}

function createInitialSnapshot(best = 0): GameSnapshot {
  return {
    status: 'ready',
    playerX: CAM_CENTER_X,
    score: 0,
    highScore: best,
    lives: 3,
    livesMax: 3,
    hunger: 40,
    hungerMax: HUNGER_EMPTY,
    scrollSpeed: INIT_SCROLL_SPEED,
    tMs: 0,
    tick: 0,
    ghostMs: 0,
    invincibleMs: 0,
    slowMs: 0,
    movementMs: 0,
    hungerTickMs: 0,
    speedIncreaseCountdownMs: SPEED_INCREASE_THRESHOLD_MS,
    speedTween: null,
    entities: makeInitialEntities(),
    message: '',
  };
}

function overlapsPlayer(entity: PracticeEntity, playerX: number) {
  const dx = Math.abs(entity.x - playerX);
  const dy = Math.abs(entity.y - PLAYER_Y);
  if (entity.k === 'obstacle') {
    const halfW = Math.max(58, Number(entity.w || 120) * 0.45);
    const halfH = Math.max(52, Number(entity.h || 120) * 0.45);
    return dx <= halfW + PLAYER_RADIUS * 0.42 && dy <= halfH + PLAYER_RADIUS * 0.45;
  }
  return dx <= 92 && dy <= 92;
}

function updateScrollSpeed(state: GameSnapshot, dtMs: number) {
  let scrollSpeed = state.scrollSpeed;
  let speedTween = state.speedTween;
  let speedIncreaseCountdownMs = state.speedIncreaseCountdownMs;

  if (speedTween) {
    const elapsedMs = speedTween.elapsedMs + dtMs;
    const progress = clamp(elapsedMs / Math.max(1, speedTween.durationMs), 0, 1);
    scrollSpeed = speedTween.from + (speedTween.to - speedTween.from) * progress;
    speedTween =
      progress >= 1
        ? null
        : {
            ...speedTween,
            elapsedMs,
          };
  }

  if (!speedTween && scrollSpeed < MAX_SCROLL_SPEED) {
    speedIncreaseCountdownMs -= dtMs;
    if (speedIncreaseCountdownMs <= 0) {
      speedIncreaseCountdownMs = SPEED_INCREASE_THRESHOLD_MS;
      const target = clamp(scrollSpeed + SPEED_INCREASE, INIT_SCROLL_SPEED, MAX_SCROLL_SPEED);
      speedTween = {
        from: scrollSpeed,
        to: target,
        elapsedMs: 0,
        durationMs: SPEED_INCREASE_TWEEN_MS,
      };
    }
  }

  return {
    scrollSpeed,
    speedIncreaseCountdownMs,
    speedTween,
  };
}

export default function ShellRunnersTestMode() {
  const [bestScore, setBestScore] = useState(0);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => createInitialSnapshot());
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const snapshotRef = useRef(snapshot);
  const pressedRef = useRef({ left: false, right: false });
  const nextEntityIdRef = useRef(5);
  const nextSpawnAtRef = useRef(620);
  const rafRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef(0);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const musicEnabledRef = useRef(true);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const best = readBestScore();
    setBestScore(best);
    setSnapshot(createInitialSnapshot(best));
  }, []);

  const pauseMusic = useCallback(() => {
    try {
      bgmRef.current?.pause();
    } catch {
      // ignore
    }
  }, []);

  const ensureMusic = useCallback(() => {
    if (!musicEnabledRef.current) return;
    if (typeof Audio === 'undefined') return;
    if (!bgmRef.current) {
      const audio = new Audio('/assets/audio/bgm.wav');
      audio.loop = true;
      audio.volume = 0.45;
      bgmRef.current = audio;
    }
    void bgmRef.current.play().catch(() => {});
  }, []);

  const playSfx = useCallback((src: string, volume = 0.54) => {
    if (!musicEnabledRef.current) return;
    if (typeof Audio === 'undefined') return;
    const audio = new Audio(src);
    audio.volume = volume;
    void audio.play().catch(() => {});
  }, []);

  const toggleMusic = useCallback((event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    setMusicEnabled((enabled) => {
      const next = !enabled;
      musicEnabledRef.current = next;
      if (next) window.setTimeout(() => ensureMusic(), 0);
      else pauseMusic();
      return next;
    });
  }, [ensureMusic, pauseMusic]);

  const startGame = useCallback(() => {
    ensureMusic();
    pressedRef.current = { left: false, right: false };
    nextEntityIdRef.current = 5;
    nextSpawnAtRef.current = 950;
    const best = readBestScore();
    setBestScore(best);
    setSnapshot({
      ...createInitialSnapshot(best),
      status: 'running',
      entities: makeInitialEntities(),
      message: 'run',
    });
  }, [ensureMusic]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (snapshotRef.current.status === 'ready') startGame();
    }, 350);
    return () => window.clearTimeout(id);
  }, [startGame]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        event.preventDefault();
        pressedRef.current.left = true;
        ensureMusic();
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        event.preventDefault();
        pressedRef.current.right = true;
        ensureMusic();
      }
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (snapshotRef.current.status !== 'running') startGame();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        event.preventDefault();
        pressedRef.current.left = false;
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        event.preventDefault();
        pressedRef.current.right = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [ensureMusic, startGame]);

  useEffect(() => {
    const step = (now: number) => {
      const prev = lastFrameAtRef.current || now;
      lastFrameAtRef.current = now;
      const dtMs = clamp(now - prev, 0, 50);

      setSnapshot((state) => {
        if (state.status !== 'running') return state;

        const dtSec = dtMs / 1000;
        const slowActive = state.slowMs > 0;
        const invincibleActive = state.invincibleMs > 0;
        const movementActive = state.movementMs > 0;
        const scrollScale = slowActive ? 0.55 : 1;
        const {
          scrollSpeed,
          speedIncreaseCountdownMs,
          speedTween,
        } = updateScrollSpeed(state, dtMs);
        let playerX = state.playerX;
        let score = state.score + scrollSpeed * 45 * dtSec;
        let lives = state.lives;
        let hunger = state.hunger;
        let hungerTickMs = state.hungerTickMs + dtMs;
        let ghostMs = Math.max(0, state.ghostMs - dtMs);
        let invincibleMs = Math.max(0, state.invincibleMs - dtMs);
        let slowMs = Math.max(0, state.slowMs - dtMs);
        let movementMs = Math.max(0, state.movementMs - dtMs);
        let message = '';

        const pressed = pressedRef.current;
        const dir = pressed.left === pressed.right ? 0 : pressed.left ? -1 : 1;
        if (dir !== 0) {
          const speedMul = movementActive ? 1.3 : 1;
          playerX = clamp(
            playerX + dir * PLAYER_SPEED_PX_PER_SECOND * speedMul * dtSec,
            PLAYER_MIN_X,
            PLAYER_MAX_X
          );
        }

        while (hungerTickMs >= HUNGER_THRESHOLD_MS) {
          hungerTickMs -= HUNGER_THRESHOLD_MS;
          if (ghostMs <= 0 && invincibleMs <= 0) hunger = clamp(hunger + HUNGER_INC, 0, HUNGER_EMPTY);
        }

        let entities = state.entities
          .map((entity) => ({
            ...entity,
            y: entity.y + scrollSpeed * scrollScale * dtMs,
          }))
          .filter((entity) => entity.y < ENTITY_CULL_Y);

        nextSpawnAtRef.current -= dtMs;
        if (nextSpawnAtRef.current <= 0) {
          entities = [...entities, makeEntity(nextEntityIdRef.current++, score, playerX)];
          nextSpawnAtRef.current = Math.max(920, 1450 - score * 0.028);
        }

        const remove = new Set<string>();
        for (const entity of entities) {
          if (!overlapsPlayer(entity, playerX)) continue;
          remove.add(entity.id);
          if (entity.k === 'collectible') {
            hunger = clamp(hunger - HUNGER_DEC, 0, HUNGER_EMPTY);
            score += COLLECTIBLE_SCORE_MULT;
            message = '+food';
            playSfx('/assets/audio/starFish.wav', 0.48);
          } else if (entity.k === 'powerup') {
            score += 25;
            if (entity.powerup === 'invincibility') {
              invincibleMs = INVINCIBLE_DURATION_MS;
              message = 'shield';
            } else if (entity.powerup === 'slow') {
              slowMs = SCROLL_SLOW_DURATION_MS;
              message = 'slow';
            } else {
              movementMs = MOVE_BOOST_DURATION_MS;
              message = 'move boost';
            }
            playSfx('/assets/audio/powerup.wav', 0.48);
          } else if (invincibleActive || ghostMs > 0) {
            score += 25;
            message = 'blocked';
            playSfx('/assets/audio/collision.wav', 0.28);
          } else {
            lives = Math.max(0, lives - 1);
            ghostMs = lives > 0 ? GHOST_DURATION_MS : 0;
            hunger = lives > 0 ? 40 : HUNGER_EMPTY;
            message = lives > 0 ? 'hit' : 'run ended';
            playSfx('/assets/audio/collision.wav', 0.58);
          }
        }
        if (remove.size) entities = entities.filter((entity) => !remove.has(entity.id));

        if (hunger >= HUNGER_EMPTY && lives > 0 && ghostMs <= 0) {
          lives = Math.max(0, lives - 1);
          ghostMs = lives > 0 ? GHOST_DURATION_MS : 0;
          hunger = lives > 0 ? 40 : HUNGER_EMPTY;
          message = lives > 0 ? 'hungry' : 'run ended';
          playSfx('/assets/audio/collision.wav', 0.52);
        }

        const finalScore = Math.floor(score);
        if (lives <= 0) {
          writeBestScore(finalScore);
          const best = readBestScore();
          setBestScore(best);
          pressedRef.current = { left: false, right: false };
          return {
            ...state,
            status: 'ended',
            playerX,
            score: finalScore,
            highScore: best,
            lives,
            hunger,
            hungerTickMs,
            scrollSpeed,
            ghostMs,
            invincibleMs,
            slowMs,
            movementMs,
            speedIncreaseCountdownMs,
            speedTween,
            tMs: state.tMs + dtMs,
            tick: state.tick + 1,
            entities,
            message,
          };
        }

        return {
          ...state,
          playerX,
          score,
          highScore: Math.max(state.highScore, finalScore),
          lives,
          hunger,
          hungerTickMs,
          scrollSpeed,
          ghostMs,
          invincibleMs,
          slowMs,
          movementMs,
          speedIncreaseCountdownMs,
          speedTween,
          tMs: state.tMs + dtMs,
          tick: state.tick + 1,
          entities,
          message,
        };
      });

      rafRef.current = window.requestAnimationFrame(step);
    };

    rafRef.current = window.requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playSfx]);

  useEffect(() => {
    return () => {
      try {
        bgmRef.current?.pause();
      } catch {
        // ignore
      }
      bgmRef.current = null;
    };
  }, []);

  const frame = useMemo<SimFrame>(() => ({
    v: 1,
    sessionId: 'practice',
    tick: snapshot.tick,
    tMs: snapshot.tMs,
    phase: snapshot.status === 'ended' ? 'ended' : 'running',
    pawn: {
      x: snapshot.playerX,
      y: PLAYER_Y,
      ghost: snapshot.ghostMs > 0,
      invincible: snapshot.invincibleMs > 0,
    },
    score: {
      current: Math.floor(snapshot.score),
      high: Math.floor(snapshot.highScore),
    },
    lives: snapshot.lives,
    hunger: snapshot.hunger,
    entities: snapshot.entities.map((entity) => ({ ...entity })) as FrameEntity[],
  }), [snapshot]);

  const hungerRemaining = Math.max(0, Math.round(snapshot.hungerMax - snapshot.hunger));
  const hungerPct = Math.round((hungerRemaining / snapshot.hungerMax) * 100);
  const invincibleActive = snapshot.invincibleMs > 0;
  const slowActive = snapshot.slowMs > 0;
  const movementActive = snapshot.movementMs > 0;

  const setControl = useCallback((dir: 'left' | 'right', value: boolean) => {
    pressedRef.current[dir] = value;
    if (value) ensureMusic();
  }, [ensureMusic]);

  return (
    <main className={`shell-practice ${focusMode ? 'is-focus' : ''}`} onPointerDown={ensureMusic}>
      <section className='shell-practice__hud' aria-label='Practice status'>
        <div className='shell-practice__stat'>
          <span>Score</span>
          <strong>{Math.floor(snapshot.score)}</strong>
        </div>
        <div className='shell-practice__stat'>
          <span>Best</span>
          <strong>{bestScore}</strong>
        </div>
        <div className='shell-practice__stat'>
          <span>Lives</span>
          <strong>{snapshot.lives}/{snapshot.livesMax}</strong>
        </div>
      </section>

      <section className='shell-practice__track' aria-label='ShellRunners practice track'>
        <FrameCanvas frame={frame} className='shell-practice__canvas' />

        <div className='shell-practice__top-panel'>
          <div className='shell-practice__hunger'>
            <span>Hunger {hungerRemaining}/{snapshot.hungerMax}</span>
            <i style={{ width: `${hungerPct}%` }} />
          </div>
          <div className='shell-practice__boosts'>
            <span className={invincibleActive ? 'is-active' : ''}>Shield</span>
            <span className={slowActive ? 'is-active' : ''}>Slow</span>
            <span className={movementActive ? 'is-active' : ''}>Move</span>
          </div>
        </div>

        {snapshot.message && snapshot.status === 'running' ? (
          <div className='shell-practice__message'>{snapshot.message}</div>
        ) : null}

        {snapshot.status !== 'running' && (
          <div className='shell-practice__overlay'>
            <strong>{snapshot.status === 'ended' ? 'Run ended' : 'Practice ready'}</strong>
            <span>Practice is public and local. Hold Left or Right to move continuously.</span>
            <button type='button' onClick={startGame}>
              {snapshot.status === 'ended' ? 'Restart Practice' : 'Start Practice'}
            </button>
          </div>
        )}

        <div className='shell-practice__touch-controls' aria-label='In-game practice controls'>
          <button
            type='button'
            onPointerDown={() => setControl('left', true)}
            onPointerUp={() => setControl('left', false)}
            onPointerLeave={() => setControl('left', false)}
            onPointerCancel={() => setControl('left', false)}
            aria-label='Move left'>
            Left
          </button>
          <button type='button' onClick={startGame}>
            {snapshot.status === 'running' ? 'Restart' : 'Start'}
          </button>
          <button
            type='button'
            onPointerDown={() => setControl('right', true)}
            onPointerUp={() => setControl('right', false)}
            onPointerLeave={() => setControl('right', false)}
            onPointerCancel={() => setControl('right', false)}
            aria-label='Move right'>
            Right
          </button>
        </div>
      </section>

      <section className='shell-practice__controls' aria-label='Practice controls'>
        <button
          type='button'
          onPointerDown={() => setControl('left', true)}
          onPointerUp={() => setControl('left', false)}
          onPointerLeave={() => setControl('left', false)}
          onPointerCancel={() => setControl('left', false)}
          aria-label='Move left'>
          Left
        </button>
        <button type='button' onClick={startGame}>
          {snapshot.status === 'running' ? 'Restart' : 'Start'}
        </button>
        <button
          type='button'
          onPointerDown={() => setControl('right', true)}
          onPointerUp={() => setControl('right', false)}
          onPointerLeave={() => setControl('right', false)}
          onPointerCancel={() => setControl('right', false)}
          aria-label='Move right'>
          Right
        </button>
        <button type='button' onClick={toggleMusic}>
          Audio {musicEnabled ? 'On' : 'Off'}
        </button>
        <button type='button' onClick={() => setFocusMode((enabled) => !enabled)}>
          {focusMode ? 'Normal' : 'Full Screen'}
        </button>
      </section>

      <style jsx>{`
        :global(html),
        :global(body),
        :global(#__next) {
          min-height: 100%;
          margin: 0;
          background: #04121b;
        }

        :global(.arena-shell) {
          min-height: 100vh;
          background: #04121b;
        }

        :global(.shell-practice__canvas) {
          position: absolute;
          inset: 0;
        }

        .shell-practice {
          min-height: 100dvh;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          gap: 10px;
          padding: 10px;
          color: #f7fbff;
          background:
            radial-gradient(circle at 50% 0%, rgba(71, 166, 194, 0.28), transparent 34%),
            linear-gradient(180deg, #061927 0%, #082331 48%, #031018 100%);
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            'Segoe UI',
            sans-serif;
          overflow: hidden;
        }

        .shell-practice.is-focus {
          position: fixed;
          inset: 0;
          z-index: 9999;
          min-height: 100dvh;
          padding: 6px;
          grid-template-rows: auto minmax(0, 1fr) auto;
        }

        .shell-practice__hud,
        .shell-practice__controls {
          width: min(940px, 100%);
          margin: 0 auto;
          display: flex;
          align-items: stretch;
          justify-content: space-between;
          gap: 8px;
        }

        .shell-practice__stat,
        .shell-practice__top-panel,
        .shell-practice__controls button,
        .shell-practice__overlay button {
          border: 1px solid rgba(184, 232, 255, 0.24);
          background: rgba(4, 18, 27, 0.78);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.24);
          backdrop-filter: blur(10px);
        }

        .shell-practice__stat {
          min-width: 82px;
          border-radius: 8px;
          padding: 7px 10px;
          display: grid;
          gap: 3px;
          text-align: center;
          align-content: center;
        }

        .shell-practice__stat span {
          color: #9fb5c2;
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 700;
        }

        .shell-practice__stat strong {
          font-size: 18px;
          line-height: 1;
        }

        .shell-practice__track {
          position: relative;
          width: min(940px, 100%);
          min-height: min(500px, calc(100dvh - 150px));
          height: min(62dvh, 560px);
          margin: 0 auto;
          overflow: hidden;
          border: 1px solid rgba(151, 221, 255, 0.2);
          border-radius: 8px;
          background: #07334c;
          box-shadow: inset 0 0 80px rgba(255, 255, 255, 0.08);
        }

        .shell-practice.is-focus .shell-practice__hud,
        .shell-practice.is-focus .shell-practice__controls,
        .shell-practice.is-focus .shell-practice__track {
          width: 100%;
        }

        .shell-practice.is-focus .shell-practice__track {
          height: auto;
          min-height: 0;
        }

        .shell-practice__top-panel {
          position: absolute;
          top: 12px;
          left: 12px;
          right: 12px;
          z-index: 5;
          display: grid;
          grid-template-columns: minmax(180px, 1fr) auto;
          gap: 10px;
          align-items: center;
          border-radius: 8px;
          padding: 9px 10px;
        }

        .shell-practice__hunger {
          display: grid;
          gap: 5px;
          color: #d7eef8;
          font-size: 12px;
          font-weight: 800;
        }

        .shell-practice__hunger::after {
          content: '';
          display: block;
          grid-row: 2;
          height: 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.16);
        }

        .shell-practice__hunger i {
          grid-row: 2;
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(90deg, #d0ec70, #f0b653);
          z-index: 1;
        }

        .shell-practice__boosts {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .shell-practice__boosts span {
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          padding: 4px 7px;
          color: #7c95a3;
          font-size: 11px;
          font-weight: 800;
        }

        .shell-practice__boosts span.is-active {
          color: #06141c;
          background: #aee9ff;
          border-color: #d8f6ff;
        }

        .shell-practice__message {
          position: absolute;
          left: 50%;
          top: 24%;
          z-index: 6;
          transform: translateX(-50%);
          border-radius: 999px;
          padding: 7px 12px;
          background: rgba(4, 18, 27, 0.72);
          color: #e9f8ff;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          pointer-events: none;
        }

        .shell-practice__overlay {
          position: absolute;
          inset: 0;
          z-index: 7;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 24px;
          text-align: center;
          background: rgba(2, 10, 15, 0.58);
        }

        .shell-practice__overlay strong {
          font-size: clamp(28px, 7vw, 58px);
          line-height: 1;
        }

        .shell-practice__overlay span {
          max-width: 420px;
          color: #d2e7f2;
          font-size: 14px;
        }

        .shell-practice__controls {
          justify-content: center;
          flex-wrap: wrap;
        }

        .shell-practice__controls button,
        .shell-practice__touch-controls button,
        .shell-practice__overlay button {
          min-width: 96px;
          border-radius: 8px;
          color: #f7fbff;
          cursor: pointer;
          font-weight: 800;
          padding: 11px 14px;
          touch-action: none;
          user-select: none;
        }

        .shell-practice__touch-controls {
          position: absolute;
          left: 16px;
          right: 16px;
          bottom: 14px;
          z-index: 8;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          pointer-events: auto;
          margin: 0 auto;
          max-width: 440px;
        }

        .shell-practice__touch-controls button {
          min-width: 0;
          min-height: 42px;
          padding: 9px 10px;
          background: rgba(4, 18, 27, 0.84);
          border-color: rgba(184, 232, 255, 0.38);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
        }

        .shell-practice__controls button:nth-child(-n + 3) {
          display: none;
        }

        .shell-practice__overlay button {
          background: #e0b85f;
          border-color: rgba(255, 235, 179, 0.8);
          color: #241600;
        }

        .shell-practice__controls button:active,
        .shell-practice__touch-controls button:active,
        .shell-practice__overlay button:active {
          transform: translateY(1px);
        }

        @media (max-width: 760px) {
          .shell-practice {
            padding: 6px;
            gap: 6px;
            grid-template-rows: auto minmax(0, 1fr) auto;
          }

          .shell-practice__hud {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
            width: 100%;
          }

          .shell-practice__stat {
            min-width: 0;
            min-height: 50px;
            padding: 5px 6px;
            align-content: center;
          }

          .shell-practice__stat span {
            font-size: 9px;
          }

          .shell-practice__stat strong {
            font-size: 15px;
          }

          .shell-practice__track {
            height: auto;
            min-height: 0;
          }

          .shell-practice__top-panel {
            grid-template-columns: 1fr;
            gap: 6px;
            top: 8px;
            left: 8px;
            right: 8px;
            padding: 8px;
          }

          .shell-practice__hunger {
            font-size: 11px;
          }

          .shell-practice__boosts {
            justify-content: flex-start;
          }

          .shell-practice__boosts span {
            padding: 3px 6px;
            font-size: 10px;
          }

          .shell-practice__controls {
            display: flex;
            justify-content: center;
            gap: 6px;
          }

          .shell-practice__controls button {
            display: inline-flex;
            min-width: 0;
            width: min(150px, 48%);
            padding: 9px 7px;
            font-size: 12px;
          }

          .shell-practice__controls button:nth-child(-n + 3) {
            display: none;
          }

          .shell-practice__touch-controls button {
            min-height: 42px;
            padding: 9px 8px;
          }
        }

        @media (max-width: 920px) and (orientation: landscape) {
          .shell-practice {
            min-height: 100dvh;
            padding: 6px;
            gap: 6px;
            grid-template-rows: auto minmax(0, 1fr) auto;
          }

          .shell-practice__hud,
          .shell-practice__controls,
          .shell-practice__track {
            width: 100%;
          }

          .shell-practice__hud {
            display: grid;
            grid-template-columns: minmax(130px, 1fr) repeat(3, 82px);
            gap: 6px;
          }

          .shell-practice__stat {
            min-width: 0;
            padding: 5px 8px;
          }

          .shell-practice__stat span {
            font-size: 10px;
          }

          .shell-practice__stat strong {
            font-size: 16px;
          }

          .shell-practice__track {
            height: auto;
            min-height: 0;
          }

          .shell-practice__top-panel {
            top: 8px;
            left: 8px;
            right: 8px;
            padding: 7px 8px;
          }

          .shell-practice__controls {
            gap: 6px;
          }

          .shell-practice__controls button {
            min-width: 78px;
            padding: 9px 10px;
          }
        }
      `}</style>
    </main>
  );
}
