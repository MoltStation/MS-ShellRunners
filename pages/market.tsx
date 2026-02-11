import Link from 'next/link';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import type { Address } from 'viem';
import { useStore } from '../mobx';
import { fetchIpfs, Order, sortNfts } from '../mobx/helpers';

// Use a plain <img> for marketplace cards to avoid Next Image remote host restrictions
// when switching IPFS gateways (Cloudflare/Pinata/ipfs.io) in local dev.

type Category = 'all' | 'Identity' | 'PoPT' | 'Shell Runners';
type ViewMode = 'all' | 'listings' | 'myNfts';

const PAGE_SIZE = 12;

const fallbackMetadata: IMetadata = {
  name: 'Unknown NFT',
  description: 'Metadata unavailable',
  componentIndices: {
    eyes: '0',
    hands: '0',
    head: '0',
    legs: '0',
    shell: '0',
    shellOuter: '0',
    tail: '0',
  },
  attributes: [],
  image: '/assets/ShellRunnerPlaceholder.png',
};

const Market = () => {
  const store = useStore();
  const [isLoading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [sortOrder, setSortOrder] = useState<Order>(Order.LATEST);
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [metadataCache, setMetadataCache] = useState<Record<string, IMetadata>>(
    {}
  );
  const [listModalOpen, setListModalOpen] = useState(false);
  const [listTarget, setListTarget] = useState<ICoreOwnedNft | null>(null);
  const [listPriceEth, setListPriceEth] = useState('0.01');
  const [listBusy, setListBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    store
      .fetchGlobalNftsList()
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [store]);

  useEffect(() => {
    if (viewMode === 'listings') return;
    if (!store.walletConnected) return;
    store.fetchCoreOwnedNfts(true).catch(() => {});
  }, [store, store.walletConnected, viewMode]);

  const counts = useMemo(() => {
    const listings = store.marketNftList ?? [];
    const owned = store.coreOwnedNftList ?? [];
    const listingKeys = new Set(
      listings.map((item: any) => `${item.nftContract}-${item.tokenId}`)
    );
    const unlistedOwned = owned.filter(
      (item: any) => !listingKeys.has(`${item.nftContract}-${item.tokenId}`)
    );

    const list =
      viewMode === 'myNfts'
        ? owned
        : viewMode === 'listings'
          ? listings
          : [...listings, ...unlistedOwned];
    let identity = 0;
    let popt = 0;
    let shell = 0;
    list.forEach((item: any) => {
      if (item.collectionLabel === 'Identity') identity += 1;
      if (item.collectionLabel === 'PoPT') popt += 1;
      if (item.collectionLabel === 'Shell Runners') shell += 1;
    });
    return { all: list.length, identity, popt, shell };
  }, [store.marketNftList, store.coreOwnedNftList, viewMode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = sortNfts([...(store.marketNftList ?? [])], sortOrder);
    const byCategory =
      category === 'all'
        ? list
        : list.filter((item) => item.collectionLabel === category);
    if (!q) return byCategory;
    return byCategory.filter((item) => {
      const key = `${item.nftContract}-${item.tokenId}`;
      const meta = metadataCache[key];
      const name = (meta?.name ?? '').toLowerCase();
      return (
        String(item.tokenId).includes(q) ||
        String(item.itemId).includes(q) ||
        (item.owner ?? '').toLowerCase().includes(q) ||
        (item.seller ?? '').toLowerCase().includes(q) ||
        (item.collectionLabel ?? '').toLowerCase().includes(q) ||
        name.includes(q)
      );
    });
  }, [store.marketNftList, sortOrder, category, query, metadataCache]);

  useEffect(() => {
    setPage(0);
  }, [query, category, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = filtered.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE
  );
  const sliceKey = slice.map((item) => `${item.nftContract}-${item.tokenId}`).join('|');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const missing = slice.filter(
        (item) => !metadataCache[`${item.nftContract}-${item.tokenId}`]
      );
      if (missing.length === 0) return;

      const updates: Record<string, IMetadata> = {};
      await Promise.all(
        missing.map(async (item) => {
          const key = `${item.nftContract}-${item.tokenId}`;
          try {
            if (!item.tokenUri) {
              updates[key] = fallbackMetadata;
              return;
            }
            updates[key] = await fetchIpfs(item.tokenUri);
          } catch {
            updates[key] = fallbackMetadata;
          }
        })
      );

      if (cancelled) return;
      setMetadataCache((prev) => ({ ...prev, ...updates }));
    };

    load().catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sliceKey]);

  const marketAddress =
    store.addressConfig.market ??
    (process.env.NEXT_PUBLIC_MOLTBOT_MARKET_ADDRESS as string | undefined) ??
    (process.env.NEXT_PUBLIC_SHELLRUNNERS_MARKET_ADDRESS as string | undefined);
  const marketConfigured =
    typeof marketAddress === 'string' && /^0x[a-fA-F0-9]{40}$/.test(marketAddress);

  const renderCard = (item: IMarketNft) => {
    const key = `${item.nftContract}-${item.tokenId}`;
    const meta = metadataCache[key] ?? fallbackMetadata;
    const seller = (item.seller ?? '').toLowerCase();
    const isSeller =
      store.accountAddress && seller === store.accountAddress.toLowerCase();
    const needsConnect = !store.walletConnected;
    const canBuy = store.walletConnected && !isSeller;

    const onBuy = async () => {
      await store.purchaseMarketItem({
        nftContract: item.nftContract as Address,
        itemId: item.itemId,
        price: item.price,
      });
    };

    const onCancel = async () => {
      await store.cancelMarketItem(item.itemId);
    };

    return (
      <article className='molt-market-item' key={key}>
        <div className='molt-market-item-top'>
          <div className='molt-market-item-meta'>
            <div className='molt-market-item-title'>{meta.name ?? 'NFT'}</div>
            <div className='molt-market-item-sub'>
              <span className='molt-market-pill'>{item.collectionLabel ?? 'Collection'}</span>
              <span className='molt-market-dim'>#{item.tokenId}</span>
              {isSeller && <span className='molt-market-owner-pill'>You</span>}
            </div>
          </div>
          <div className='molt-market-price'>
            <div className='molt-market-dim'>Price</div>
            <div className='molt-market-price-val'>{item.price} ETH</div>
          </div>
        </div>

          <div className='molt-market-item-media'>
          <img
            className='molt-market-img'
            src={meta.image ?? '/assets/ShellRunnerPlaceholder.png'}
            alt={meta.name ?? 'NFT'}
            loading='lazy'
          />
        </div>

        <div className='molt-market-item-actions'>
          <button
            className={`molt-market-btn ${
              needsConnect ? 'ghost' : canBuy ? 'primary' : 'ghost'
            }`}
            onClick={
              needsConnect
                ? () => store.connectToWallet()
                : canBuy
                  ? onBuy
                  : undefined
            }
            disabled={!needsConnect && !canBuy}
          >
            {isSeller ? 'Your Listing' : needsConnect ? 'Connect Wallet' : 'Buy'}
          </button>
          {isSeller && (
            <div className='molt-market-note'>
              You own this listing. Manage it in <strong>My NFTs</strong>.
            </div>
          )}
          <div className='molt-market-dim molt-market-item-foot'>
            Item #{item.itemId} - Seller {String(item.seller).slice(0, 6)}...
            {String(item.seller).slice(-4)}
          </div>
        </div>
      </article>
    );
  };

  const ownedFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...(store.coreOwnedNftList ?? [])];
    const byCategory =
      category === 'all'
        ? list
        : list.filter((item) => item.collectionLabel === category);
    if (!q) return byCategory;
    return byCategory.filter((item) => {
      const key = `${item.nftContract}-${item.tokenId}`;
      const meta = metadataCache[key];
      const name = (meta?.name ?? '').toLowerCase();
      return (
        String(item.tokenId).includes(q) ||
        (item.collectionLabel ?? '').toLowerCase().includes(q) ||
        name.includes(q)
      );
    });
  }, [store.coreOwnedNftList, category, query, metadataCache]);

  const ownedKey = useMemo(() => {
    return ownedFiltered
      .map((item) => `${item.nftContract}-${item.tokenId}`)
      .join('|');
  }, [ownedFiltered]);

  // Identify which of the owned NFTs are currently listed (active listing in fetchMarketItems).
  const listingByToken = useMemo(() => {
    const map = new Map<string, IMarketNft>();
    (store.marketNftList ?? []).forEach((item) => {
      map.set(`${item.nftContract.toLowerCase()}-${item.tokenId}`, item);
    });
    return map;
  }, [store.marketNftList]);

  const unlistedOwnedFiltered = useMemo(() => {
    return ownedFiltered.filter((item) => {
      const listing = listingByToken.get(
        `${item.nftContract.toLowerCase()}-${item.tokenId}`
      );
      return !listing;
    });
  }, [ownedFiltered, listingByToken]);

  const renderOwnedCard = (item: ICoreOwnedNft) => {
    const key = `${item.nftContract}-${item.tokenId}`;
    const meta = metadataCache[key] ?? fallbackMetadata;
    const listing = listingByToken.get(
      `${item.nftContract.toLowerCase()}-${item.tokenId}`
    );
    const isListed = Boolean(listing);
    const priceLabel = isListed ? `${listing!.price} ETH` : 'Not listed';

    const onList = async () => {
      setListTarget(item);
      setListModalOpen(true);
    };

    const onCancel = async () => {
      if (!listing) return;
      await store.cancelMarketItem(listing.itemId);
    };

    return (
      <article className='molt-market-item' key={`owned-${key}`}>
        <div className='molt-market-item-top'>
          <div className='molt-market-item-meta'>
            <div className='molt-market-item-title'>{meta.name ?? 'NFT'}</div>
            <div className='molt-market-item-sub'>
              <span className='molt-market-pill'>{item.collectionLabel}</span>
              <span className='molt-market-dim'>#{item.tokenId}</span>
              {!isListed && (
                <span className='molt-market-dim'>Not listed for sale</span>
              )}
            </div>
          </div>
          <div className='molt-market-price'>
            <div className='molt-market-dim'>{isListed ? 'Price' : 'Status'}</div>
            <div className='molt-market-price-val'>{priceLabel}</div>
          </div>
        </div>

        <div className='molt-market-item-media'>
          <img
            className='molt-market-img'
            src={meta.image ?? '/assets/ShellRunnerPlaceholder.png'}
            alt={meta.name ?? 'NFT'}
            loading='lazy'
          />
        </div>

        <div className='molt-market-item-actions'>
          {!store.walletConnected ? (
            <button className='molt-market-btn ghost' onClick={() => store.connectToWallet()}>
              Connect Wallet
            </button>
          ) : isListed ? (
            <button className='molt-market-btn ghost' onClick={onCancel}>
              Cancel Listing
            </button>
          ) : (
            <button className='molt-market-btn primary' onClick={onList}>
              List For Sale
            </button>
          )}
          <div className='molt-market-dim molt-market-item-foot'>
            {isListed
              ? `Listed as Item #${listing!.itemId}`
              : 'This NFT is in your wallet.'}
          </div>
        </div>
      </article>
    );
  };

  useEffect(() => {
    let cancelled = false;

    const loadOwned = async () => {
      const missing = ownedFiltered.filter(
        (item) => !metadataCache[`${item.nftContract}-${item.tokenId}`]
      );
      if (missing.length === 0) return;

      const updates: Record<string, IMetadata> = {};
      await Promise.all(
        missing.map(async (item) => {
          const key = `${item.nftContract}-${item.tokenId}`;
          try {
            if (!item.tokenUri) {
              updates[key] = fallbackMetadata;
              return;
            }
            updates[key] = await fetchIpfs(item.tokenUri);
          } catch {
            updates[key] = fallbackMetadata;
          }
        })
      );

      if (cancelled) return;
      setMetadataCache((prev) => ({ ...prev, ...updates }));
    };

    loadOwned().catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownedKey]);

  return (
    <main className='molt-market-page'>
      <section className='molt-market-card'>
        <div className='molt-market-brand'>MoltStation</div>
        <div className='molt-market-head'>
          <h1 className='molt-market-title'>Marketplace</h1>
          <div className='molt-market-nav'>
            <Link className='molt-market-link' href='/'>
              Home
            </Link>
            <Link className='molt-market-link' href='/profile'>
              Profile
            </Link>
            <button
              className={`molt-market-link ${viewMode === 'all' ? 'active' : ''}`}
              type='button'
              onClick={() => setViewMode('all')}
            >
              All
            </button>
            <button
              className={`molt-market-link ${
                viewMode === 'listings' ? 'active' : ''
              }`}
              type='button'
              onClick={() => setViewMode('listings')}
            >
              Listings
            </button>
            <button
              className={`molt-market-link ${viewMode === 'myNfts' ? 'active' : ''}`}
              type='button'
              onClick={() => setViewMode('myNfts')}
            >
              My NFTs
            </button>
          </div>
        </div>

        <p className='molt-market-subtitle'>
          Browse Identity and PoPT NFTs listed on the MoltStation core marketplace.
        </p>

        {viewMode !== 'listings' && (
          <div className='molt-market-alert'>
            <strong>
              {viewMode === 'myNfts' ? 'My NFTs:' : 'All NFTs:'}
            </strong>{' '}
            {viewMode === 'myNfts'
              ? 'Identity and PoPT in your connected wallet.'
              : 'Active listings on the MoltStation core marketplace.'}
            {' '}
            Listing requires a small listing fee and a one-time approval transaction per collection.
          </div>
        )}

        {!marketConfigured && (
          <div className='molt-market-alert'>
            Marketplace contract not configured. Fill `public/config/addresses.json`
            (or env fallbacks) with a valid `market` address.
          </div>
        )}

        {store.addressConfigError && (
          <div className='molt-market-alert'>
            Address config failed to load: {store.addressConfigError}
          </div>
        )}

        <div className='molt-market-controls'>
          <div className='molt-market-tabs'>
            <button
              className={`molt-market-tab ${category === 'all' ? 'active' : ''}`}
              onClick={() => setCategory('all')}
              type='button'
            >
              All ({counts.all})
            </button>
            <button
              className={`molt-market-tab ${
                category === 'Identity' ? 'active' : ''
              }`}
              onClick={() => setCategory('Identity')}
              type='button'
            >
              Identity ({counts.identity})
            </button>
            <button
              className={`molt-market-tab ${category === 'PoPT' ? 'active' : ''}`}
              onClick={() => setCategory('PoPT')}
              type='button'
            >
              PoPT ({counts.popt})
            </button>
            <button
              className={`molt-market-tab ${
                category === 'Shell Runners' ? 'active' : ''
              }`}
              onClick={() => setCategory('Shell Runners')}
              type='button'
            >
              Shell Runners ({counts.shell})
            </button>
          </div>

          <div className='molt-market-row'>
            <label className='molt-market-search'>
              <span className='molt-market-dim'>Search</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Token ID, item ID, seller, owner...'
              />
            </label>

            <label className='molt-market-sort'>
              <span className='molt-market-dim'>Sort</span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) as Order)}
              >
                <option value={Order.LATEST}>Latest</option>
                <option value={Order.OLDEST}>Oldest</option>
                <option value={Order.PRICE_ASC}>Price (low)</option>
                <option value={Order.PRICE_DSC}>Price (high)</option>
              </select>
            </label>
          </div>
        </div>

        <div className='molt-market-grid'>
          {viewMode === 'myNfts' && !store.walletConnected && (
            <div className='molt-market-empty'>
              Connect your wallet to view your NFTs.
            </div>
          )}

          {viewMode === 'myNfts' && store.walletConnected && !store.coreOwnedNftLoaded && (
            <div className='molt-market-empty'>Loading your NFTs...</div>
          )}

          {viewMode === 'myNfts' && store.walletConnected && store.coreOwnedNftLoaded && ownedFiltered.length === 0 && (
            <div className='molt-market-empty'>
              No NFTs found in this wallet yet.
            </div>
          )}

          {viewMode === 'myNfts' &&
            store.walletConnected &&
            store.coreOwnedNftLoaded &&
            unlistedOwnedFiltered.length > 0 && (
              <div className='molt-market-empty'>
                Your wallet NFTs (not listed for sale):
              </div>
            )}

          {viewMode === 'myNfts' &&
            store.walletConnected &&
            store.coreOwnedNftLoaded &&
            unlistedOwnedFiltered.map(renderOwnedCard)}

          {viewMode === 'myNfts' &&
            store.walletConnected &&
            store.coreOwnedNftLoaded &&
            ownedFiltered.length > unlistedOwnedFiltered.length && (
              <div className='molt-market-empty'>Your active listings:</div>
            )}

          {viewMode === 'myNfts' &&
            store.walletConnected &&
            store.coreOwnedNftLoaded &&
            ownedFiltered
              .filter(
                (item) =>
                  Boolean(
                    listingByToken.get(
                      `${item.nftContract.toLowerCase()}-${item.tokenId}`
                    )
                  )
              )
              .map(renderOwnedCard)}

          {(viewMode === 'listings' || viewMode === 'all') && isLoading && (
            <div className='molt-market-empty'>Loading marketplace items...</div>
          )}
          {(viewMode === 'listings' || viewMode === 'all') &&
            !isLoading &&
            filtered.length === 0 && (
            <div className='molt-market-empty'>
              No active listings found.
              {marketConfigured ? ' Try changing filters.' : ''}
            </div>
          )}
          {(viewMode === 'listings' || viewMode === 'all') &&
            !isLoading &&
            slice.map(renderCard)}

          {viewMode === 'all' &&
            store.walletConnected &&
            store.coreOwnedNftLoaded &&
            unlistedOwnedFiltered.length > 0 && (
              <div className='molt-market-empty'>
                Your wallet NFTs (not listed for sale):
              </div>
            )}

          {viewMode === 'all' &&
            store.walletConnected &&
            store.coreOwnedNftLoaded &&
            unlistedOwnedFiltered.map(renderOwnedCard)}
        </div>

        {(viewMode === 'listings' || viewMode === 'all') && (
          <div className='molt-market-pagination'>
            <button
              className='molt-market-btn ghost'
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage <= 0}
              type='button'
            >
              Previous
            </button>
            <div className='molt-market-dim'>
              Page {safePage + 1} / {totalPages}
            </div>
            <button
              className='molt-market-btn ghost'
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              type='button'
            >
              Next
            </button>
          </div>
        )}
      </section>

      {listModalOpen && listTarget && (
        <div
          className='molt-market-modal-backdrop'
          role='dialog'
          aria-modal='true'
          onClick={() => {
            if (listBusy) return;
            setListModalOpen(false);
            setListTarget(null);
          }}
        >
          <div
            className='molt-market-modal'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='molt-market-modal-title'>List NFT For Sale</div>
            <div className='molt-market-dim'>
              {listTarget.collectionLabel} #{listTarget.tokenId}
            </div>

            <div className='molt-market-modal-form'>
              <label className='molt-market-search'>
                <span className='molt-market-dim'>Price (ETH)</span>
                <input
                  value={listPriceEth}
                  onChange={(e) => setListPriceEth(e.target.value)}
                  placeholder='0.01'
                  inputMode='decimal'
                />
              </label>

              <div className='molt-market-modal-actions'>
                <button
                  className='molt-market-btn ghost'
                  type='button'
                  disabled={listBusy}
                  onClick={() => {
                    setListModalOpen(false);
                    setListTarget(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className='molt-market-btn primary'
                  type='button'
                  disabled={listBusy}
                  onClick={async () => {
                    setListBusy(true);
                    try {
                      await store.listCoreNftForSale({
                        nftContract: listTarget.nftContract as Address,
                        tokenId: listTarget.tokenId,
                        priceEth: listPriceEth,
                      });
                      setListModalOpen(false);
                      setListTarget(null);
                    } finally {
                      setListBusy(false);
                    }
                  }}
                >
                  {listBusy ? 'Listing...' : 'List'}
                </button>
              </div>

              <div className='molt-market-dim'>
                Listing triggers 2 transactions if you have not approved the marketplace yet:
                approval, then listing (includes the listing fee).
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default observer(Market);
