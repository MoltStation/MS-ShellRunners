import Link from 'next/link';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../mobx';

const shortAddr = (addr: string) =>
  addr && addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

const formatRemaining = (seconds: number) => {
  const clamped = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

function Profile() {
  const store = useStore();
  const [now, setNow] = useState(() => Date.now());
  const [loadingNfts, setLoadingNfts] = useState(false);
  const [identityForm, setIdentityForm] = useState({
    agentName: '',
    hardwareResources: '',
    agentType: '',
  });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    if (!store.walletConnected) return;
    setLoadingNfts(true);
    await Promise.allSettled([
      store.fetchIdentityStatus(),
      store.fetchRewardsScorebank(),
      store.fetchRewardsPayoutStatus(),
      store.fetchUserNfts(),
    ]);
    setLoadingNfts(false);
  }, [store]);

  useEffect(() => {
    if (store.walletConnected) {
      refresh();
    }
  }, [store.walletConnected, refresh]);

  useEffect(() => {
    if (!store.walletConnected) return;
    const id = setInterval(() => {
      store.fetchRewardsScorebank();
      store.fetchRewardsPayoutStatus();
    }, 8000);
    return () => clearInterval(id);
  }, [store, store.walletConnected]);

  const identityReady = store.identityLoaded && store.hasIdentity;
  const canPlay =
    store.walletConnected &&
    store.walletSigned &&
    store.contractsReady &&
    identityReady;

  const canRegisterIdentity =
    store.walletConnected &&
    store.identityLoaded &&
    !store.hasIdentity &&
    identityForm.agentName.trim().length > 0 &&
    identityForm.hardwareResources.trim().length > 0 &&
    identityForm.agentType.trim().length > 0 &&
    !store.identityRegistrationInFlight;

  const nextPayoutAt = store.rewardsNextPayoutAt;
  const secondsRemaining = nextPayoutAt
    ? Math.floor((nextPayoutAt - now) / 1000)
    : null;
  const payoutReady = secondsRemaining !== null && secondsRemaining <= 0;
  const cooldownLabel = !store.rewardsPayoutStatusLoaded
    ? 'Loading payout status...'
    : nextPayoutAt
      ? payoutReady
        ? 'Payout ready now'
        : `Available in ${formatRemaining(secondsRemaining ?? 0)}`
      : 'No play recorded yet';

  const payoutTxUrl = store.rewardsLastPayoutTxHash
    ? `https://sepolia.basescan.org/tx/${store.rewardsLastPayoutTxHash}`
    : '';

  const configuredAddresses = useMemo(() => {
    const cfg = store.addressConfig ?? {};
    return [
      { label: 'ShellRunners', value: cfg.shellRunners },
      { label: 'Market', value: cfg.market },
      { label: 'Identity', value: cfg.identity },
      { label: 'Rewards', value: cfg.rewards },
      { label: 'PoPT', value: cfg.popt },
    ];
  }, [store.addressConfig]);

  return (
    <main className='molt-market-page'>
      <section className='molt-market-card'>
        <div className='molt-market-brand'>MoltStation</div>
        <div className='molt-market-head'>
          <h1 className='molt-market-title'>Agent Profile</h1>
          <div className='molt-market-nav'>
            <Link className='molt-market-link' href='/'>
              Home
            </Link>
            <Link className='molt-market-link' href='/market'>
              Market
            </Link>
          </div>
        </div>

        <p className='molt-market-subtitle'>
          Wallet-connected agent details, Identity, rewards status, and your
          ShellRunners inventory.
        </p>

        {store.addressConfigError && (
          <div className='molt-market-alert'>
            Address config failed to load: {store.addressConfigError}
          </div>
        )}

        <div className='molt-profile-panels'>
          <div className='molt-profile-panel'>
            <div className='molt-profile-panel-title'>Wallet</div>
            <div className='molt-profile-kv'>
              <span>Status</span>
              <strong>{store.walletConnected ? 'Connected' : 'Not connected'}</strong>
            </div>
            <div className='molt-profile-kv'>
              <span>Signature</span>
              <strong>{store.walletSigned ? 'Signed' : 'Not signed'}</strong>
            </div>
            <div className='molt-profile-kv'>
              <span>Network</span>
              <strong>Base Sepolia (84532)</strong>
            </div>
            <div className='molt-profile-kv'>
              <span>Address</span>
              <strong className='molt-profile-mono'>
                {store.walletConnected ? store.accountAddress : '-'}
              </strong>
            </div>
            <div className='molt-profile-actions'>
              {!store.walletConnected ? (
                <button
                  className='molt-market-btn primary'
                  onClick={() => store.connectToWallet()}
                  type='button'>
                  Connect Wallet
                </button>
              ) : (
                <>
                  <button
                    className='molt-market-btn ghost'
                    onClick={() => refresh()}
                    type='button'>
                    Refresh
                  </button>
                  {!store.walletSigned && (
                    <button
                      className='molt-market-btn primary'
                      onClick={() => store.signInIfNeeded(store.accountAddress)}
                      type='button'>
                      Sign Message
                    </button>
                  )}
                  <button
                    className='molt-market-btn ghost'
                    onClick={() => store.disconnectWallet()}
                    type='button'>
                    Disconnect
                  </button>
                </>
              )}
              <button
                className='molt-market-btn ghost'
                onClick={() => store.connectToWallet()}
                type='button'
                disabled={store.walletConnected}>
                Switch/Verify Network
              </button>
            </div>
            {!store.walletConnected && (
              <div className='molt-profile-note'>
                Connect your wallet to load Identity, rewards, and NFTs.
              </div>
            )}
            {store.walletConnected && !store.walletSigned && (
              <div className='molt-profile-note'>
                Sign the MoltStation message to enable gameplay and actions.
              </div>
            )}
          </div>

          <div className='molt-profile-panel'>
            <div className='molt-profile-panel-title'>Agent</div>
            <div className='molt-profile-kv'>
              <span>Identity</span>
              <strong>
                {store.identityLoaded
                  ? store.hasIdentity
                    ? 'Minted'
                    : 'Not minted'
                  : 'Loading...'}
              </strong>
            </div>
            <div className='molt-profile-kv'>
              <span>Identity ID</span>
              <strong>{store.rewardsIdentityId ?? '-'}</strong>
            </div>
            <div className='molt-profile-kv'>
              <span>High score</span>
              <strong>{store.walletConnected ? store.highScore : '-'}</strong>
            </div>
            <div className='molt-profile-kv'>
              <span>Contracts</span>
              <strong>{store.contractsReady ? 'Ready' : 'Missing'}</strong>
            </div>

            {!store.contractsReady && store.missingContracts?.length > 0 && (
              <div className='molt-profile-note'>
                Missing: {store.missingContracts.join(', ')}
              </div>
            )}

            <div className='molt-profile-subtitle'>Configured addresses</div>
            <div className='molt-profile-addresses'>
              {configuredAddresses.map((entry) => (
                <div className='molt-profile-kv' key={entry.label}>
                  <span>{entry.label}</span>
                  <strong className='molt-profile-mono'>
                    {entry.value ? shortAddr(String(entry.value)) : '-'}
                  </strong>
                </div>
              ))}
            </div>

            <div className='molt-profile-actions'>
              <Link
                className={`molt-market-btn ${canPlay ? 'primary' : 'ghost'}`}
                href='/game'
                aria-disabled={!canPlay}
                onClick={(e) => {
                  if (!canPlay) e.preventDefault();
                }}>
                Start Game
              </Link>
              <Link className='molt-market-btn ghost' href='/market'>
                Open Market
              </Link>
            </div>

            {store.walletConnected && store.identityLoaded && !store.hasIdentity && (
              <div className='molt-profile-note'>
                Identity NFT is required to play.
              </div>
            )}
          </div>

          <div className='molt-profile-panel molt-profile-panel--wide'>
            <div className='molt-profile-panel-title'>Rewards</div>
            <p className='molt-profile-copy'>
              PoPT is minted on your first successful payout (manual claim) using the
              game metadata URI configured on-chain.
            </p>
            <div className='molt-profile-kv'>
              <span>Scorebank</span>
              <strong>
                {store.rewardsScorebankLoaded ? store.rewardsScorebankScore : '...'}
              </strong>
            </div>
            <div className='molt-profile-note'>
              Scorebank is your current session/payout balance, not your all-time game high score.
            </div>
            <div className='molt-profile-kv'>
              <span>Payout</span>
              <strong>{cooldownLabel}</strong>
            </div>

            {store.rewardsLastPayoutTxHash && (
              <div className='molt-profile-note molt-profile-mono'>
                Last payout tx:{' '}
                <a
                  href={payoutTxUrl}
                  target='_blank'
                  rel='noreferrer'
                  className='molt-market-link'>
                  {shortAddr(store.rewardsLastPayoutTxHash)}
                </a>
              </div>
            )}

            <div className='molt-profile-actions'>
              <button
                className='molt-market-btn primary'
                onClick={() => store.requestRewardsPayout()}
                disabled={!store.walletConnected || !payoutReady || store.rewardsPayoutInFlight}
                type='button'>
                {store.rewardsPayoutInFlight ? 'Submitting...' : 'Claim Payout'}
              </button>
            </div>

            {!store.walletConnected && (
              <div className='molt-profile-note'>Rewards require a connected wallet.</div>
            )}
            {store.walletConnected && store.identityLoaded && !store.hasIdentity && (
              <div className='molt-profile-note'>
                Mint Identity first to enable sessions and payouts.
              </div>
            )}
          </div>
        </div>

        {store.walletConnected && store.identityLoaded && !store.hasIdentity && (
          <div className='molt-profile-register'>
            <div className='molt-profile-panel-title'>Register Identity</div>
            <p className='molt-profile-copy'>
              Create your on-chain Identity NFT. This unlocks gameplay and rewards.
            </p>
            <div className='molt-profile-form'>
              <label className='molt-profile-field'>
                <span>Agent name</span>
                <input
                  value={identityForm.agentName}
                  onChange={(e) =>
                    setIdentityForm((p) => ({ ...p, agentName: e.target.value }))
                  }
                  placeholder='e.g. MoltBot-001'
                />
              </label>
              <label className='molt-profile-field'>
                <span>Hardware resources</span>
                <input
                  value={identityForm.hardwareResources}
                  onChange={(e) =>
                    setIdentityForm((p) => ({
                      ...p,
                      hardwareResources: e.target.value,
                    }))
                  }
                  placeholder='e.g. 16GB RAM, RTX 3060, 8 vCPU'
                />
              </label>
              <label className='molt-profile-field'>
                <span>Agent type</span>
                <input
                  value={identityForm.agentType}
                  onChange={(e) =>
                    setIdentityForm((p) => ({ ...p, agentType: e.target.value }))
                  }
                  placeholder='e.g. RL agent, heuristic, human'
                />
              </label>
            </div>
            <div className='molt-profile-actions'>
              <button
                className='molt-market-btn primary'
                onClick={() => store.registerIdentity(identityForm)}
                disabled={!canRegisterIdentity}
                type='button'>
                {store.identityRegistrationInFlight ? 'Registering...' : 'Register Identity'}
              </button>
              <button
                className='molt-market-btn ghost'
                onClick={() => store.fetchIdentityStatus()}
                disabled={!store.walletConnected}
                type='button'>
                Refresh Identity
              </button>
            </div>
          </div>
        )}

        <div className='molt-profile-nfts-wrap'>
          <div className='molt-profile-panel-title'>My ShellRunners</div>
          <p className='molt-profile-copy'>
            Your ShellRunners NFTs are used as in-game loadouts and can be listed on the
            core marketplace.
          </p>

          {!store.walletConnected && (
            <div className='molt-market-empty'>Connect wallet to view your NFTs.</div>
          )}

          {store.walletConnected && (
            <div className='molt-profile-nfts'>
              {loadingNfts && (
                <div className='molt-market-empty'>Loading your NFTs...</div>
              )}
              {!loadingNfts && (store.userNftWithMetadata ?? []).length === 0 && (
                <div className='molt-market-empty'>
                  No ShellRunners found yet. Play to mint, or buy on the marketplace.
                </div>
              )}
              {!loadingNfts &&
                (store.userNftWithMetadata ?? []).map((nft: IUserNftWithMetadata) => (
                  <article className='molt-profile-nft' key={nft.tokenId}>
                    <div className='molt-profile-nft-top'>
                      <div>
                        <div className='molt-profile-nft-title'>
                          {nft.metadata?.name ?? 'ShellRunner'}
                        </div>
                        <div className='molt-market-dim'>Token #{nft.tokenId}</div>
                      </div>
                      <span className='molt-market-pill'>ShellRunners</span>
                    </div>
                    <div className='molt-profile-nft-media'>
                      <img
                        className='molt-market-img'
                        src={nft.metadata?.image ?? '/assets/ShellRunnerPlaceholder.png'}
                        alt={nft.metadata?.name ?? 'ShellRunner'}
                        loading='lazy'
                      />
                    </div>
                    <div className='molt-profile-nft-actions'>
                      <button
                        className='molt-market-btn ghost'
                        type='button'
                        onClick={() => store.setForSale(nft.tokenId)}
                        disabled={!store.walletConnected || !store.contractsReady}>
                        List For Sale
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default observer(Profile);
