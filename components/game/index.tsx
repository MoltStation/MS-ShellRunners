import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const RUNTIME_EVENT_SOURCE = 'moltstation-runtime';

function resolveCoreBaseUrlFromWindow(fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const fallbackUrl = String(fallback || '').trim() || window.location.origin;
  try {
    const params = new URLSearchParams(window.location.search);
    const coreOrigin = String(params.get('coreOrigin') || '').trim();
    if (coreOrigin) {
      const parsed = new URL(coreOrigin);
      return parsed.origin;
    }
  } catch {
    // ignore invalid query params
  }
  return fallbackUrl;
}

const GameScreen = () => {
  const [inventoryChecked, setInventoryChecked] = useState(false);
  const router = useRouter();
  const state = useStore();
  const parentEl = useRef<HTMLDivElement>(null);
  const { game, grs } = useGame(parentEl);
  const snapshotIntervalMs = Number(
    process.env.NEXT_PUBLIC_MOLTBOT_SNAPSHOT_INTERVAL_MS ?? 5000
  );
  const coreBaseUrl = resolveCoreBaseUrlFromWindow(
    process.env.NEXT_PUBLIC_CORE_LANDING_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '')
  );
  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;
  const startedRef = useRef(false);
  const canStart = useMemo(
    () =>
      state.walletConnected &&
      state.hasIdentity &&
      state.contractsReady &&
      inventoryChecked,
    [state.walletConnected, state.hasIdentity, state.contractsReady, inventoryChecked]
  );
  const postRuntimeEvent = useCallback(
    (event: string, payload: Record<string, unknown> = {}) => {
      if (typeof window === 'undefined' || !isEmbedded || !window.parent) return false;
      const message = {
        source: RUNTIME_EVENT_SOURCE,
        event,
        payload,
      };
      try {
        const targetOrigin = new URL(coreBaseUrl).origin;
        window.parent.postMessage(message, targetOrigin);
      } catch {
        window.parent.postMessage(message, '*');
      }
      return true;
    },
    [coreBaseUrl, isEmbedded]
  );

  const goToCorePath = useCallback(
    (path: string) => {
      if (typeof window === 'undefined') return;
      try {
        const target = new URL(path, coreBaseUrl);
        if (target.origin === window.location.origin) {
          router.replace(`${target.pathname}${target.search}${target.hash}`);
          return;
        }
        window.location.replace(target.toString());
      } catch {
        window.location.replace(coreBaseUrl);
      }
    },
    [coreBaseUrl, router]
  );

  const endGameCB = useCallback(
    async (score: number, metersTravelled: number, choseToMint: boolean) => {
      postRuntimeEvent('runtime_score', { score: Math.floor(score), final: true });
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
      }
    },
    [state, postRuntimeEvent]
  );

  const goHomeCB = useCallback(() => {
    state.closeGameplaySession();
    if (postRuntimeEvent('runtime_exit', { reason: 'result_screen' })) {
      return;
    }
    goToCorePath('/profile');
  }, [goToCorePath, postRuntimeEvent, state]);

  const exitToCoreCB = useCallback(() => {
    state.closeGameplaySession();
    if (postRuntimeEvent('runtime_exit', { reason: 'pause_menu' })) {
      return;
    }
    goToCorePath('/');
  }, [goToCorePath, postRuntimeEvent, state]);

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
      postRuntimeEvent('runtime_score', { score: Math.floor(score) });
    },
    [state, postRuntimeEvent]
  );

  useEffect(() => {
    if (state.walletConnected) return;
    if (!isEmbedded) {
      notify('danger', 'Wallet not connected');
      goToCorePath('/games/shellrunners');
    }
  }, [state.walletConnected, goToCorePath, isEmbedded]);

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
      if (!isEmbedded) {
        notify('danger', 'Identity NFT required to play');
        goToCorePath('/profile');
      }
    }
  }, [state.walletConnected, state.identityLoaded, state.hasIdentity, goToCorePath, isEmbedded]);

  useEffect(() => {
    if (
      state.walletConnected &&
      state.addressConfigLoaded &&
      !state.contractsReady
    ) {
      if (!isEmbedded) {
        notify('danger', 'Contracts not configured');
        goToCorePath('/profile');
      }
    }
  }, [
    state.walletConnected,
    state.addressConfigLoaded,
    state.contractsReady,
    goToCorePath,
    isEmbedded,
  ]);

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
    if (!game || !grs || !canStart || startedRef.current) return;
    startedRef.current = true;
    game.scene.start('boot', {
      grs,
      initGameData: {
        isEmbedded,
        highScore: state.highScore,
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
  }, [
    canStart,
    endGameCB,
    exitToCoreCB,
    game,
    goHomeCB,
    grs,
    isEmbedded,
    mintShellRunnersCB,
    sessionStartCB,
    snapshotIntervalMs,
    snapshotScoreCB,
    state.highScore,
    state.userNftList,
    state.userNftWithMetadata,
  ]);

  useEffect(() => {
    return () => {
      startedRef.current = false;
    };
  }, []);

  return (
    <>
      <div ref={parentEl} style={{ width: '100%', height: '100%', overflow: 'hidden' }} />
      {!canStart && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(2, 6, 23, 0.65)',
            zIndex: 20,
            textAlign: 'center',
            padding: 16,
          }}>
          <div
            style={{
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 14,
              background: 'rgba(15, 23, 42, 0.9)',
              padding: 18,
              maxWidth: 420,
            }}>
            {!state.walletConnected && (
              <>
                <div style={{ marginBottom: 10, color: '#e5e7eb' }}>Wallet connection required</div>
                <button
                  type='button'
                  onClick={() => state.connectToWallet()}
                  style={{
                    borderRadius: 10,
                    padding: '10px 14px',
                    border: '1px solid rgba(245, 158, 11, 0.6)',
                    background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                    color: '#0b0f14',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                  Connect Wallet
                </button>
              </>
            )}
            {state.walletConnected && !state.identityLoaded && (
              <div style={{ color: '#e5e7eb' }}>Checking Identity NFT...</div>
            )}
            {state.walletConnected && state.identityLoaded && !state.hasIdentity && (
              <div style={{ color: '#fde68a' }}>Identity NFT required to play.</div>
            )}
            {state.walletConnected && state.hasIdentity && !state.contractsReady && (
              <div style={{ color: '#fecaca' }}>Game contracts are not configured.</div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default GameScreen;
