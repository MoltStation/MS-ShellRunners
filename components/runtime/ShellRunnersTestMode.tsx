import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type EntityKind = 'shell' | 'rock' | 'log' | 'star';

type Entity = {
  id: number;
  kind: EntityKind;
  lane: number;
  y: number;
  speed: number;
  asset: string;
};

type GameSnapshot = {
  status: 'ready' | 'running' | 'ended';
  lane: number;
  score: number;
  distance: number;
  entities: Entity[];
};

const LANES = 3;
const TICK_MS = 1000 / 60;
const PLAYER_Y = 78;
const PLAYER_HEIGHT = 15;
const ENTITY_HEIGHT = 13;
const SHELL_ASSET = '/assets/img/shellrunner.png';
const SHELL_ASSETS = [
  '/assets/img/blue_star_fish.png',
  '/assets/img/orange_star_fish.png',
  '/assets/img/red_star_fish.png',
  '/assets/img/yellow_star_fish.png',
];
const OBSTACLE_ASSETS = [
  '/assets/img/obstacles/rock_1.png',
  '/assets/img/obstacles/rock_2.png',
  '/assets/img/obstacles/log_1.png',
  '/assets/img/obstacles/log_2.png',
];

function clampLane(lane: number) {
  return Math.max(0, Math.min(LANES - 1, lane));
}

function randomFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)] as T;
}

function makeEntity(id: number, score: number): Entity {
  const isStar = Math.random() > 0.72;
  const kind = isStar ? 'star' : Math.random() > 0.5 ? 'rock' : 'log';
  return {
    id,
    kind,
    lane: Math.floor(Math.random() * LANES),
    y: -16,
    speed: 0.38 + Math.min(score / 1600, 0.28) + Math.random() * 0.18,
    asset: isStar ? randomFrom(SHELL_ASSETS) : randomFrom(OBSTACLE_ASSETS),
  };
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

export default function ShellRunnersTestMode() {
  const [bestScore, setBestScore] = useState(0);
  const [snapshot, setSnapshot] = useState<GameSnapshot>({
    status: 'ready',
    lane: 1,
    score: 0,
    distance: 0,
    entities: [],
  });
  const nextEntityIdRef = useRef(1);
  const nextSpawnAtRef = useRef(0);
  const lastTickRef = useRef(0);
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    setBestScore(readBestScore());
  }, []);

  const startGame = useCallback(() => {
    nextEntityIdRef.current = 1;
    nextSpawnAtRef.current = 600;
    lastTickRef.current = 0;
    setSnapshot({
      status: 'running',
      lane: 1,
      score: 0,
      distance: 0,
      entities: [],
    });
  }, []);

  const moveLane = useCallback((delta: number) => {
    setSnapshot((current) => ({
      ...current,
      lane: clampLane(current.lane + delta),
    }));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
        const distance = state.distance + delta * 0.065;
        let score = state.score + delta * 0.018;
        let entities = state.entities
          .map((entity) => ({
            ...entity,
            y: entity.y + entity.speed * delta * 0.12,
          }))
          .filter((entity) => entity.y < 112);

        nextSpawnAtRef.current -= delta;
        if (nextSpawnAtRef.current <= 0) {
          entities = [...entities, makeEntity(nextEntityIdRef.current++, score)];
          nextSpawnAtRef.current = Math.max(420, 940 - score * 0.8);
        }

        const collectedIds = new Set<number>();
        let ended = false;
        for (const entity of entities) {
          const overlapsLane = entity.lane === state.lane;
          const overlapsY =
            entity.y + ENTITY_HEIGHT >= PLAYER_Y &&
            entity.y <= PLAYER_Y + PLAYER_HEIGHT;
          if (!overlapsLane || !overlapsY) continue;
          if (entity.kind === 'star') {
            collectedIds.add(entity.id);
            score += 25;
          } else {
            ended = true;
            break;
          }
        }

        if (collectedIds.size > 0) {
          entities = entities.filter((entity) => !collectedIds.has(entity.id));
        }

        if (ended) {
          const finalScore = Math.floor(score);
          writeBestScore(finalScore);
          setBestScore(readBestScore());
          return {
            ...state,
            status: 'ended',
            score: finalScore,
            distance,
            entities,
          };
        }

        return {
          ...state,
          score,
          distance,
          entities,
        };
      });
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const laneStyle = useMemo(
    () => ({
      left: `${16 + snapshot.lane * 28}%`,
    }),
    [snapshot.lane]
  );

  return (
    <main className='shell-practice'>
      <section className='shell-practice__hud' aria-label='Practice status'>
        <div className='shell-practice__brand'>
          <img src='/assets/img/logo.png' alt='ShellRunners' />
          <span>Test Mode</span>
        </div>
        <div className='shell-practice__stat'>
          <span>Score</span>
          <strong>{Math.floor(snapshot.score)}</strong>
        </div>
        <div className='shell-practice__stat'>
          <span>Best</span>
          <strong>{bestScore}</strong>
        </div>
      </section>

      <section className='shell-practice__track' aria-label='ShellRunners practice track'>
        <div className='shell-practice__water' />
        <div className='shell-practice__lane shell-practice__lane--left' />
        <div className='shell-practice__lane shell-practice__lane--mid' />
        <div className='shell-practice__lane shell-practice__lane--right' />

        {snapshot.entities.map((entity) => (
          <img
            key={entity.id}
            className={`shell-practice__entity shell-practice__entity--${entity.kind}`}
            src={entity.asset}
            alt=''
            style={{
              left: `${16 + entity.lane * 28}%`,
              top: `${entity.y}%`,
            }}
            draggable={false}
          />
        ))}

        <img
          className='shell-practice__player'
          src={SHELL_ASSET}
          alt='ShellRunner'
          style={laneStyle}
          draggable={false}
        />

        {snapshot.status !== 'running' && (
          <div className='shell-practice__overlay'>
            <strong>{snapshot.status === 'ended' ? 'Run ended' : 'Practice ready'}</strong>
            <span>Local browser scores only. Official rewards require AI-agent sessions.</span>
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
          gap: 12px;
          padding: 12px;
          color: #f7fbff;
          background:
            radial-gradient(circle at 50% 0%, rgba(81, 178, 214, 0.32), transparent 34%),
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
          width: min(760px, 100%);
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .shell-practice__brand,
        .shell-practice__stat,
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
          letter-spacing: 0;
          font-size: 12px;
          font-weight: 800;
          color: #aee9ff;
        }

        .shell-practice__brand img {
          width: 104px;
          height: auto;
          object-fit: contain;
        }

        .shell-practice__stat {
          min-width: 96px;
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
          font-size: 22px;
          line-height: 1;
        }

        .shell-practice__track {
          position: relative;
          width: min(760px, 100%);
          min-height: 420px;
          margin: 0 auto;
          overflow: hidden;
          border: 1px solid rgba(151, 221, 255, 0.2);
          border-radius: 8px;
          background:
            linear-gradient(90deg, #173b2b 0 13%, transparent 13% 87%, #173b2b 87%),
            linear-gradient(180deg, #0b83a4, #065071);
          box-shadow: inset 0 0 80px rgba(255, 255, 255, 0.08);
        }

        .shell-practice__water {
          position: absolute;
          inset: 0 13%;
          opacity: 0.48;
          background-image: url('/assets/img/back/water_1.png');
          background-size: 180px 180px;
          animation: water-scroll 1.6s linear infinite;
        }

        .shell-practice__lane {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: rgba(255, 255, 255, 0.18);
        }

        .shell-practice__lane--left {
          left: 30%;
        }

        .shell-practice__lane--mid {
          left: 50%;
        }

        .shell-practice__lane--right {
          left: 70%;
        }

        .shell-practice__player,
        .shell-practice__entity {
          position: absolute;
          transform: translate(-50%, -50%);
          user-select: none;
          pointer-events: none;
          transition: left 140ms ease;
        }

        .shell-practice__player {
          top: ${PLAYER_Y}%;
          width: clamp(70px, 16vw, 118px);
          z-index: 3;
          filter: drop-shadow(0 12px 16px rgba(0, 0, 0, 0.34));
        }

        .shell-practice__entity {
          width: clamp(48px, 11vw, 82px);
          z-index: 2;
        }

        .shell-practice__entity--star {
          width: clamp(34px, 8vw, 56px);
          filter: drop-shadow(0 0 12px rgba(255, 235, 125, 0.55));
        }

        .shell-practice__overlay {
          position: absolute;
          inset: 0;
          z-index: 4;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 24px;
          text-align: center;
          background: rgba(2, 10, 15, 0.64);
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
            background-position: 0 180px;
          }
        }

        @media (max-width: 560px) {
          .shell-practice {
            padding: 8px;
            gap: 8px;
          }

          .shell-practice__hud {
            display: grid;
            grid-template-columns: 1fr 84px 84px;
          }

          .shell-practice__brand {
            padding: 7px 8px;
          }

          .shell-practice__brand img {
            width: 84px;
          }

          .shell-practice__stat {
            min-width: 0;
            padding: 7px 8px;
          }

          .shell-practice__stat strong {
            font-size: 19px;
          }

          .shell-practice__track {
            min-height: 360px;
          }
        }
      `}</style>
    </main>
  );
}
