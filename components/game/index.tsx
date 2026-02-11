import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useGame } from './hooks';
import { useStore } from '../../mobx';
import { notify } from '../../mobx/helpers';

const starterShellRunner: IUserNftWithMetadata = {
  tokenId: -1,
  tokenUri: 'local://starter',
  metadata: {
    name: 'Starter ShellRunner',
    description: 'Local starter runner (not an NFT).',
    componentIndices: {
      eyes: '1',
      hands: '1',
      head: '1',
      legs: '1',
      shell: '1',
      shellOuter: '1',
      tail: '1',
    },
    attributes: [
      { trait_type: 'speed', value: 10 },
      { trait_type: 'breed', value: 1 },
    ],
    image: '/assets/img/shellrunner.png',
  },
};

const GameScreen = () => {
  const [ended, setEnded] = useState(false);
  const [inventoryChecked, setInventoryChecked] = useState(false);
  const router = useRouter();
  const state = useStore();
  const parentEl = useRef<HTMLDivElement>(null);
  const { game, grs } = useGame(parentEl);
  const snapshotIntervalMs = Number(
    process.env.NEXT_PUBLIC_MOLTBOT_SNAPSHOT_INTERVAL_MS ?? 5000
  );

  const endGameCB = useCallback(
    async (score: number, metersTravelled: number, choseToMint: boolean) => {
      await state.snapshotRewardsScore(score);
      await state.trackGameEnd(score, metersTravelled, choseToMint);
      if (state.walletConnected) {
        // Pull latest on-chain scorebank shortly after final snapshot submission.
        for (let i = 0; i < 4; i += 1) {
          await new Promise((r) => setTimeout(r, 1200));
          await state.fetchRewardsScorebank();
          if (state.rewardsScorebankScore >= Math.floor(score)) break;
        }
      }
      if (state.walletConnected) {
        if (choseToMint) {
          state.mintNFT(score);
        }
      } else if (process.env.NODE_ENV === 'development') {
        console.log('end game cb is working but user not connected to wallet');
      }
    },
    [state]
  );

  const goHomeCB = useCallback(() => {
    router.push('/profile');
  }, [router]);

  const exitToCoreCB = useCallback(() => {
    const coreLanding =
      process.env.NEXT_PUBLIC_CORE_LANDING_URL || 'https://moltstation.games';
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const target = new URL(coreLanding, window.location.origin);
      // If core landing is same-origin, route internally for instant navigation.
      if (target.origin === window.location.origin) {
        router.replace(`${target.pathname}${target.search}${target.hash}`);
        return;
      }
      // Cross-origin fallback: replace without keeping game page in history.
      window.location.replace(target.toString());
    } catch {
      window.location.replace(coreLanding);
    }
  }, [router]);

  const mintShellRunnersCB = useCallback(
    async (score: number) => {
      return await state.mintNFT(score);
    },
    [state]
  );

  const sessionStartCB = useCallback(() => {
    state.startRewardsSession();
  }, [state]);

  const snapshotScoreCB = useCallback(
    (score: number) => {
      state.snapshotRewardsScore(score);
    },
    [state]
  );

  useEffect(() => {
    if (!state.walletConnected) {
      notify('danger', 'Wallet not connected');
      router.replace('/');
    }
  }, [state.walletConnected, router]);

  useEffect(() => {
    if (state.walletConnected && !state.identityLoaded) {
      state.fetchIdentityStatus();
    }
  }, [state, state.walletConnected, state.identityLoaded]);

  useEffect(() => {
    if (
      state.walletConnected &&
      state.identityLoaded &&
      !state.hasIdentity &&
      true
    ) {
      notify('danger', 'Identity NFT required to play');
      router.replace('/profile');
    }
  }, [state.walletConnected, state.identityLoaded, state.hasIdentity, router]);

  useEffect(() => {
    if (
      state.walletConnected &&
      state.addressConfigLoaded &&
      !state.contractsReady
    ) {
      notify('danger', 'Contracts not configured');
      router.replace('/profile');
    }
  }, [state.walletConnected, state.addressConfigLoaded, state.contractsReady, router]);

  useEffect(() => {
    if (state.walletConnected && !state.rewardsScorebankLoaded) {
      state.fetchRewardsScorebank();
    }
  }, [state.walletConnected, state.rewardsScorebankLoaded, state]);

  useEffect(() => {
    if (!state.walletConnected) {
      setInventoryChecked(false);
      return;
    }
    if (inventoryChecked) return;
    state
      .fetchUserNfts()
      .catch(() => {})
      .finally(() => setInventoryChecked(true));
  }, [state.walletConnected, inventoryChecked, state]);

  useEffect(() => {
    // Platform rule: game requires a connected wallet + Identity NFT.
    // ShellRunners NFTs are optional; if none exist we use a local starter runner.
    const canStart = state.walletConnected && state.hasIdentity && state.contractsReady;
    // if (state.loaded) {
    if (game && !ended && canStart && inventoryChecked) {
      game.scene.start('boot', {
        grs,
        initGameData: {
          highScore:
            process.env.NODE_ENV === 'development' && !state.walletConnected
              ? 250
              : state.highScore,
          endGameCB,
          mintShellRunnersCB,
          goHomeCB,
          hasShellRunnerNft: (state.userNftList ?? []).some((nft: any) => Number(nft?.tokenId) >= 0),
          snapshotIntervalMs: Number.isFinite(snapshotIntervalMs)
            ? snapshotIntervalMs
            : 5000,
          snapshotScoreCB,
          sessionStartCB,
          exitToCoreCB,
          initMetaData:
            (state.userNftWithMetadata ?? []).length > 0
              ? state.userNftWithMetadata
              : [starterShellRunner],
        },
      });
    }
    if (ended) {
      console.log('rerouting');
      router.push('/home');
    }
    // }
  }, [
    game,
    ended,
    router,
    endGameCB,
    goHomeCB,
    mintShellRunnersCB,
    grs,
    snapshotScoreCB,
    sessionStartCB,
    exitToCoreCB,
    snapshotIntervalMs,
    inventoryChecked,
    state.walletConnected,
    state.rewardsScorebankLoaded,
    state.rewardsScorebankScore,
    state.highScore,
    state.userNftWithMetadata,
    state.dummyUserNftWithMetadata,
  ]);

  return (
    <>
      <div ref={parentEl} style={{ height: '100vh', overflow: 'hidden' }} />
      <div id='font-hack'>.</div>
    </>
  );
};

export default GameScreen;
