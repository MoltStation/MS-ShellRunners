import 'phaser';
import React, { useEffect, useRef, useState } from 'react';
import { GameResizer } from '../src/utils/GameResizer';
import { BootScene } from '../src/scenes/BootScene';
import { GameScene } from '../src/scenes/GameScene';

const DEBUG_RUNTIME = process.env.NEXT_PUBLIC_SHELLRUNNERS_DEBUG === 'true';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  title: 'Shell Runners',
  banner: false,
  scale: {
    fullscreenTarget: 'app-root',
    mode: Phaser.Scale.NONE,
    width: 1920,
    height: 1080,
    autoRound: true,
  },
  clearBeforeRender: false,
  fps: {
    smoothStep: true,
  },
};

const classifyDevicePerformance = () => {
  const mem = Number((navigator as any).deviceMemory || 0);
  const cores = Number(navigator.hardwareConcurrency || 0);
  let score = 0;

  if (Number.isFinite(mem) && mem > 0) {
    if (mem >= 8) score += 2;
    else if (mem >= 4) score += 1;
  }

  if (Number.isFinite(cores) && cores > 0) {
    if (cores >= 8) score += 2;
    else if (cores >= 4) score += 1;
  }

  if (DEBUG_RUNTIME) {
    console.log('Device performance score:', score, 'cores:', cores, 'mem:', mem);
  }

  return score;
};

const getRendererAndDPR = () => {
  const performanceScore = classifyDevicePerformance();
  let dpr = window.devicePixelRatio;
  let rendererType = Phaser.AUTO;
  if (performanceScore >= 3) {
    if (DEBUG_RUNTIME) {
      console.log('High Performance! 0% quality reduction');
    }
  } else if (performanceScore >= 1) {
    if (DEBUG_RUNTIME) {
      console.log('Moderate Performance! 10% quality reduction');
    }
    dpr *= 0.9;
  } else {
    if (DEBUG_RUNTIME) {
      console.log('Low Performance! Switched to Canvas Mode');
    }
    rendererType = Phaser.CANVAS;
    dpr *= 0.75;
  }

  if (
    navigator &&
    (navigator as any).deviceMemory &&
    (navigator as any).deviceMemory <= 2.5
  ) {
    rendererType = Phaser.CANVAS;
  }

  return { rendererType, dpr };
};

const addNewGame = (parent: HTMLDivElement) => {
  const { rendererType, dpr } = getRendererAndDPR();
  const newGame = new Phaser.Game({ ...config, type: rendererType, parent });
  const gameResizer = new GameResizer(newGame, dpr);

  let resizeCB = () => {
    gameResizer.resize();
  };
  window.addEventListener('resize', resizeCB);

  let orientationCB = () => {
    // Added a time delay since it's observed that devicePixelRatio updates the next frame
    setTimeout(() => {
      gameResizer.resize();
    }, 1);
  };

  window.addEventListener('orientationchange', orientationCB);

  newGame.scene.add('boot', BootScene, false);
  newGame.scene.add('game', GameScene, false);

  return {
    newGame,
    resizeRemCB: () => {
      window.removeEventListener('resize', resizeCB);
    },
    orientationRemCB: () => {
      window.removeEventListener('orientationchange', orientationCB);
    },
    grs: gameResizer,
  };
};

const useGame = (
  containerRef: React.RefObject<HTMLDivElement | null>
): { game: Phaser.Game | undefined; grs: GameResizer | undefined } => {
  const [game, setGame] = useState<Phaser.Game>();
  const gameRef = useRef<Phaser.Game | undefined>(undefined);
  const resizeRemRef = useRef<Function | undefined>(undefined);
  const orientationRemRef = useRef<Function | undefined>(undefined);
  const grsRef = useRef<GameResizer | undefined>(undefined);

  useEffect(() => {
    if (!containerRef.current) return;
    // Next dev w/ reactStrictMode intentionally mounts/unmounts components twice.
    // Using the state value in cleanup is racy (first cleanup runs before state is set),
    // which can leak a Phaser instance and create a second canvas.
    if (gameRef.current) return;

    const { newGame, resizeRemCB, orientationRemCB, grs } = addNewGame(
      containerRef.current
    );
    gameRef.current = newGame;
    resizeRemRef.current = resizeRemCB;
    orientationRemRef.current = orientationRemCB;
    grsRef.current = grs;
    setGame(newGame);

    return () => {
      if (DEBUG_RUNTIME) {
        console.warn('remove game and listeners');
      }
      gameRef.current && gameRef.current.destroy(true);
      gameRef.current = undefined;
      resizeRemRef.current && resizeRemRef.current();
      orientationRemRef.current && orientationRemRef.current();
    };
  }, [containerRef]);
  return { game, grs: grsRef.current };
};

export default useGame;
