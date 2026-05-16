import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type EntityKind = 'obstacle' | 'collectible' | 'powerup';
type PowerupType = 'movement' | 'invincibility' | 'slow';

type Entity = {
  id: number;
  kind: EntityKind;
  lane: number;
  y: number;
  speed: number;
  asset: string;
  label: string;
  powerup?: PowerupType;
};

type GameSnapshot = {
  status: 'ready' | 'running' | 'ended';
  lane: number;
  score: number;
  distance: number;
  lives: number;
  livesMax: number;
  hunger: number;
  hungerMax: number;
  invincibleUntil: number;
  slowUntil: number;
  movementUntil: number;
  entities: Entity[];
  message: string;
};

const LANES = 3;
const TICK_MS = 1000 / 60;
const PLAYER_Y = 78;
const PLAYER_HEIGHT = 14;
const ENTITY_HEIGHT = 12;
const MOVE_COOLDOWN_MS = 155;
const SHELL_ASSET = '/assets/img/shellrunner.png';
const COLLECTIBLE_ASSETS = [
  '/assets/img/blue_star_fish.png',
  '/assets/img/orange_star_fish.png',
  '/assets/img/red_star_fish.png',
  '/assets/img/yellow_star_fish.png',
];
const OBSTACLE_ASSETS = [
  '/assets/img/obstacles/rock_1.png',
  '/assets/img/obstacles/rock_2.png',
  '/assets/img/obstacles/rock_3.png',
  '/assets/img/obstacles/rock_4.png',
  '/assets/img/obstacles/rock_5.png',
  '/assets/img/obstacles/rock_6.png',
  '/assets/img/obstacles/log_1.png',
  '/assets/img/obstacles/log_2.png',
  '/assets/img/obstacles/log_3.png',
];
const POWERUP_ASSETS: Record<PowerupType, string> = {
  movement: '/assets/img/movement_power.png',
  invincibility: '/assets/img/invincibility_power.png',
  slow: '/assets/img/slow_scroll_power.png',
};

function clampLane(lane: number) {
  return Math.max(0, Math.min(LANES - 1, lane));
}

function randomFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)] as T;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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

function makeObstacle(id: number, score: number, lane?: number, y = -14): Entity {
  return {
    id,
    kind: 'obstacle',
    lane: lane ?? Math.floor(Math.random() * LANES),
    y,
    speed: 0.25 + Math.min(score / 2600, 0.16) + Math.random() * 0.1,
    asset: randomFrom(OBSTACLE_ASSETS),
    label: 'Obstacle',
  };
}

function makeCollectible(id: number, lane?: number, y = -12): Entity {
  return {
    id,
    kind: 'collectible',
    lane: lane ?? Math.floor(Math.random() * LANES),
    y,
    speed: 0.25 + Math.random() * 0.08,
    asset: randomFrom(COLLECTIBLE_ASSETS),
    label: 'Food',
  };
}

function makePowerup(id: number, lane?: number, y = -12): Entity {
  const powerup = randomFrom<PowerupType>(['movement', 'invincibility', 'slow']);
  return {
    id,
    kind: 'powerup',
    lane: lane ?? Math.floor(Math.random() * LANES),
    y,
    speed: 0.24 + Math.random() * 0.06,
    asset: POWERUP_ASSETS[powerup],
    label: powerup === 'movement' ? 'Move' : powerup === 'invincibility' ? 'Shield' : 'Slow',
    powerup,
  };
}

function makeEntity(id: number, score: number): Entity {
  const roll = Math.random();
  if (roll > 0.87) return makePowerup(id);
  if (roll > 0.64) return makeCollectible(id);
  return makeObstacle(id, score);
}

function makeInitialEntities() {
  return [
    makeObstacle(1, 0, 0, 12),
    makeCollectible(2, 1, 28),
    makeObstacle(3, 0, 2, 44),
    makePowerup(4, 0, 62),
  ];
}

function createInitialSnapshot(): GameSnapshot {
  return {
    status: 'ready',
    lane: 1,
    score: 0,
    distance: 0,
    lives: 3,
    livesMax: 3,
    hunger: 180,
    hungerMax: 220,
    invincibleUntil: 0,
    slowUntil: 0,
    movementUntil: 0,
    entities: makeInitialEntities(),
    message: '',
  };
}

export default function ShellRunnersTestMode() {
  const [bestScore, setBestScore] = useState(0);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => createInitialSnapshot());
  const nextEntityIdRef = useRef(5);
  const nextSpawnAtRef = useRef(0);
  const lastTickRef = useRef(0);
  const lastMoveAtRef = useRef(0);
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    setBestScore(readBestScore());
  }, []);

  const startGame = useCallback(() => {
    nextEntityIdRef.current = 5;
    nextSpawnAtRef.current = 420;
    lastTickRef.current = 0;
    lastMoveAtRef.current = 0;
    setSnapshot({
      ...createInitialSnapshot(),
      status: 'running',
      entities: makeInitialEntities(),
    });
  }, []);

  const moveLane = useCallback((delta: number) => {
    const now = performance.now();
    const current = snapshotRef.current;
    const cooldown =
      current.movementUntil > current.distance ? Math.round(MOVE_COOLDOWN_MS * 0.58) : MOVE_COOLDOWN_MS;
    if (now - lastMoveAtRef.current < cooldown) return;
    lastMoveAtRef.current = now;
    setSnapshot((state) => ({
      ...state,
      lane: clampLane(state.lane + delta),
    }));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        event.preventDefault();
        moveLane(-1);
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        event.preventDefault();
        moveLane(1);
      }
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        const status = snapshotRef.current.status;
        if (status === 'ready' || status === 'ended') startGame();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moveLane, startGame]);

  useEffect(() => {
    let raf = 0;

    const tick = (time: number) => {
      raf = window.requestAnimationFrame(tick);
      const current = snapshotRef.current;
      if (current.status !== 'running') {
        lastTickRef.current = time;
        return;
      }

      const previous = lastTickRef.current || time;
      const delta = Math.min(48, time - previous);
      if (delta < TICK_MS * 0.45) return;
      lastTickRef.current = time;

      setSnapshot((state) => {
        if (state.status !== 'running') return state;

        const distance = state.distance + delta * 0.058;
        const slowActive = state.slowUntil > state.distance;
        const invincible = state.invincibleUntil > state.distance;
        const speedScale = slowActive ? 0.52 : 1;
        let score = state.score + delta * 0.017;
        let hunger = clamp(state.hunger - delta * 0.026, 0, state.hungerMax);
        let lives = state.lives;
        let message = '';
        let invincibleUntil = state.invincibleUntil;
        let slowUntil = state.slowUntil;
        let movementUntil = state.movementUntil;
        let entities = state.entities
          .map((entity) => ({
            ...entity,
            y: entity.y + entity.speed * delta * 0.16 * speedScale,
          }))
          .filter((entity) => entity.y < 114);

        nextSpawnAtRef.current -= delta;
        if (nextSpawnAtRef.current <= 0) {
          entities = [...entities, makeEntity(nextEntityIdRef.current++, score)];
          nextSpawnAtRef.current = Math.max(360, 820 - score * 0.52);
        }

        const removeIds = new Set<number>();
        for (const entity of entities) {
          const overlapsLane = entity.lane === state.lane;
          const overlapsY =
            entity.y + ENTITY_HEIGHT >= PLAYER_Y &&
            entity.y <= PLAYER_Y + PLAYER_HEIGHT;
          if (!overlapsLane || !overlapsY) continue;

          removeIds.add(entity.id);
          if (entity.kind === 'collectible') {
            hunger = clamp(hunger + 34, 0, state.hungerMax);
            score += 30;
            message = '+food';
          } else if (entity.kind === 'powerup') {
            score += 18;
            if (entity.powerup === 'invincibility') {
              message = 'shield';
              invincibleUntil = distance + 210;
            } else if (entity.powerup === 'slow') {
              message = 'slow';
              slowUntil = distance + 190;
            } else {
              message = 'move boost';
              movementUntil = distance + 190;
            }
          } else if (invincible) {
            score += 12;
            message = 'blocked';
          } else {
            lives = Math.max(0, lives - 1);
            hunger = clamp(hunger - 18, 0, state.hungerMax);
            message = lives > 0 ? 'hit' : 'run ended';
          }
        }

        if (removeIds.size > 0) {
          entities = entities.filter((entity) => !removeIds.has(entity.id));
        }

        if (hunger <= 0) {
          lives = Math.max(0, lives - 1);
          hunger = lives > 0 ? Math.round(state.hungerMax * 0.44) : 0;
          message = lives > 0 ? 'hungry' : 'run ended';
        }

        if (lives <= 0) {
          const finalScore = Math.floor(score);
          writeBestScore(finalScore);
          setBestScore(readBestScore());
          return {
            ...state,
            status: 'ended',
            score: finalScore,
            distance,
            hunger,
            lives,
            invincibleUntil,
            slowUntil,
            movementUntil,
            entities,
            message,
          };
        }

        return {
          ...state,
          score,
          distance,
          hunger,
          lives,
          invincibleUntil,
          slowUntil,
          movementUntil,
          entities,
          message,
        };
      });
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const laneStyle = useMemo(
    () => ({
      left: `${20 + snapshot.lane * 30}%`,
    }),
    [snapshot.lane]
  );
  const hungerPct = Math.round((snapshot.hunger / snapshot.hungerMax) * 100);
  const invincibleActive = snapshot.invincibleUntil > snapshot.distance;
  const slowActive = snapshot.slowUntil > snapshot.distance;
  const movementActive = snapshot.movementUntil > snapshot.distance;

  return (
    <main className='shell-practice'>
      <section className='shell-practice__hud' aria-label='Practice status'>
        <div className='shell-practice__brand'>
          <img src='/assets/img/logo.png' alt='ShellRunners' />
          <span>Practice</span>
        </div>
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
        <div className='shell-practice__water' />
        <div className='shell-practice__bank shell-practice__bank--left' />
        <div className='shell-practice__bank shell-practice__bank--right' />
        <div className='shell-practice__lane shell-practice__lane--left' />
        <div className='shell-practice__lane shell-practice__lane--mid' />
        <div className='shell-practice__lane shell-practice__lane--right' />

        <div className='shell-practice__top-panel'>
          <div className='shell-practice__hunger'>
            <span>Hunger {Math.floor(snapshot.hunger)}/{snapshot.hungerMax}</span>
            <i style={{ width: `${hungerPct}%` }} />
          </div>
          <div className='shell-practice__boosts'>
            <span className={invincibleActive ? 'is-active' : ''}>Shield</span>
            <span className={slowActive ? 'is-active' : ''}>Slow</span>
            <span className={movementActive ? 'is-active' : ''}>Move</span>
          </div>
        </div>

        {snapshot.entities.map((entity) => (
          <img
            key={entity.id}
            className={`shell-practice__entity shell-practice__entity--${entity.kind}`}
            src={entity.asset}
            alt=''
            style={{
              left: `${20 + entity.lane * 30}%`,
              top: `${entity.y}%`,
            }}
            draggable={false}
          />
        ))}

        <img
          className={`shell-practice__player ${invincibleActive ? 'is-shielded' : ''}`}
          src={SHELL_ASSET}
          alt='ShellRunner'
          style={laneStyle}
          draggable={false}
        />

        {snapshot.message && snapshot.status === 'running' ? (
          <div className='shell-practice__message'>{snapshot.message}</div>
        ) : null}

        {snapshot.status !== 'running' && (
          <div className='shell-practice__overlay'>
            <strong>{snapshot.status === 'ended' ? 'Run ended' : 'Practice ready'}</strong>
            <span>Local practice only. Rewards require official AI-agent sessions.</span>
            <button type='button' onClick={startGame}>
              {snapshot.status === 'ended' ? 'Restart Practice' : 'Start Practice'}
            </button>
          </div>
        )}
      </section>

      <section className='shell-practice__controls' aria-label='Practice controls'>
        <button type='button' onClick={() => moveLane(-1)} aria-label='Move left'>
          Left
        </button>
        <button type='button' onClick={startGame}>
          {snapshot.status === 'running' ? 'Restart' : 'Start'}
        </button>
        <button type='button' onClick={() => moveLane(1)} aria-label='Move right'>
          Right
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

        .shell-practice {
          min-height: 100vh;
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

        .shell-practice__hud,
        .shell-practice__controls {
          width: min(860px, 100%);
          margin: 0 auto;
          display: flex;
          align-items: stretch;
          justify-content: space-between;
          gap: 8px;
        }

        .shell-practice__brand,
        .shell-practice__stat,
        .shell-practice__top-panel,
        .shell-practice__controls button,
        .shell-practice__overlay button {
          border: 1px solid rgba(184, 232, 255, 0.24);
          background: rgba(4, 18, 27, 0.78);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.24);
          backdrop-filter: blur(10px);
        }

        .shell-practice__brand {
          min-width: 0;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border-radius: 8px;
          padding: 8px 12px;
          text-transform: uppercase;
          font-size: 12px;
          font-weight: 800;
          color: #aee9ff;
        }

        .shell-practice__brand img {
          width: 112px;
          height: auto;
          object-fit: contain;
        }

        .shell-practice__stat {
          min-width: 86px;
          border-radius: 8px;
          padding: 8px 12px;
          display: grid;
          gap: 2px;
          text-align: right;
        }

        .shell-practice__stat span {
          color: #9fb5c2;
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 700;
        }

        .shell-practice__stat strong {
          font-size: 21px;
          line-height: 1;
        }

        .shell-practice__track {
          position: relative;
          width: min(860px, 100%);
          min-height: 460px;
          margin: 0 auto;
          overflow: hidden;
          border: 1px solid rgba(151, 221, 255, 0.2);
          border-radius: 8px;
          background: #07334c;
          box-shadow: inset 0 0 80px rgba(255, 255, 255, 0.08);
        }

        .shell-practice__water {
          position: absolute;
          inset: 0 13%;
          opacity: 0.92;
          background-image: url('/assets/img/back/water_1.png');
          background-size: 260px 260px;
          animation: water-scroll 2.1s linear infinite;
        }

        .shell-practice__bank {
          position: absolute;
          top: -7%;
          bottom: -7%;
          width: 22%;
          background-size: 100% 100%;
          opacity: 0.96;
          z-index: 1;
        }

        .shell-practice__bank--left {
          left: 0;
          background-image: url('/assets/img/back/left_bank_1.png');
        }

        .shell-practice__bank--right {
          right: 0;
          background-image: url('/assets/img/back/right_bank_1.png');
        }

        .shell-practice__lane {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: rgba(255, 255, 255, 0.16);
          z-index: 1;
        }

        .shell-practice__lane--left {
          left: 35%;
        }

        .shell-practice__lane--mid {
          left: 50%;
        }

        .shell-practice__lane--right {
          left: 65%;
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

        .shell-practice__player,
        .shell-practice__entity {
          position: absolute;
          transform: translate(-50%, -50%);
          user-select: none;
          pointer-events: none;
          transition: left 170ms ease;
        }

        .shell-practice__player {
          top: ${PLAYER_Y}%;
          width: clamp(82px, 15vw, 128px);
          z-index: 4;
          filter: drop-shadow(0 12px 16px rgba(0, 0, 0, 0.34));
        }

        .shell-practice__player.is-shielded {
          filter:
            drop-shadow(0 0 12px rgba(121, 226, 255, 0.72))
            drop-shadow(0 12px 16px rgba(0, 0, 0, 0.34));
        }

        .shell-practice__entity {
          width: clamp(54px, 10vw, 88px);
          z-index: 3;
        }

        .shell-practice__entity--collectible,
        .shell-practice__entity--powerup {
          width: clamp(36px, 7vw, 58px);
          filter: drop-shadow(0 0 12px rgba(255, 235, 125, 0.55));
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
        }

        .shell-practice__controls button,
        .shell-practice__overlay button {
          min-width: 96px;
          border-radius: 8px;
          color: #f7fbff;
          cursor: pointer;
          font-weight: 800;
          padding: 11px 14px;
        }

        .shell-practice__overlay button {
          background: #e0b85f;
          border-color: rgba(255, 235, 179, 0.8);
          color: #241600;
        }

        .shell-practice__controls button:active,
        .shell-practice__overlay button:active {
          transform: translateY(1px);
        }

        @keyframes water-scroll {
          from {
            background-position: 0 0;
          }
          to {
            background-position: 0 260px;
          }
        }

        @media (max-width: 620px) {
          .shell-practice {
            padding: 8px;
            gap: 8px;
          }

          .shell-practice__hud {
            display: grid;
            grid-template-columns: 1fr 76px 76px 76px;
          }

          .shell-practice__brand {
            padding: 7px 8px;
          }

          .shell-practice__brand img {
            width: 82px;
          }

          .shell-practice__stat {
            min-width: 0;
            padding: 7px 8px;
          }

          .shell-practice__stat strong {
            font-size: 17px;
          }

          .shell-practice__track {
            min-height: 386px;
          }

          .shell-practice__top-panel {
            grid-template-columns: 1fr;
            gap: 6px;
          }

          .shell-practice__boosts {
            justify-content: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
