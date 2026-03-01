import { makeAutoObservable, runInAction } from 'mobx';
import { formatEther, keccak256, parseEther, toBytes, type Address } from 'viem';
import {
  NET_ID,
  Order,
  notify,
  fetchIpfs,
  ipfsToHttp,
  sortNfts,
  dummyShellRunner1,
  dummyShellRunner2,
} from './helpers';
import {
  identityAbi,
  erc721MetadataAbi,
  erc721ApprovalAbi,
  moltBotArenaMarketAbi,
  poptAbi,
  rewardsAbi,
  shellRunnersAbi,
} from '../lib/contractAbis';
import {
  getChainId,
  getWalletClient,
  getPublicClient,
  read,
  switchToBaseSepolia,
  write,
} from '../lib/viemClient';

type AddressConfig = {
  shellRunners?: string;
  market?: string;
  identity?: string;
  rewards?: string;
  popt?: string;
  poptId?: string | number;
  identityId?: string | number;
};

const ENV_SHELLRUNNERS_ADDRESS = process.env
  .NEXT_PUBLIC_SHELLRUNNERS_ADDRESS as `0x${string}` | undefined;
const ENV_MARKET_ADDRESS =
  (process.env.NEXT_PUBLIC_MOLTBOT_MARKET_ADDRESS as
    | `0x${string}`
    | undefined) ??
  (process.env.NEXT_PUBLIC_SHELLRUNNERS_MARKET_ADDRESS as
    | `0x${string}`
    | undefined);
const ENV_IDENTITY_ADDRESS = process.env
  .NEXT_PUBLIC_MOLTBOT_IDENTITY_ADDRESS as `0x${string}` | undefined;
const ENV_REWARDS_ADDRESS = process.env
  .NEXT_PUBLIC_MOLTBOT_REWARDS_ADDRESS as `0x${string}` | undefined;
const ENV_POPT_ADDRESS = process.env
  .NEXT_PUBLIC_MOLTBOT_POPT_ADDRESS as `0x${string}` | undefined;
const ENV_POPT_ID = process.env.NEXT_PUBLIC_MOLTBOT_POPT_ID;
const ENV_IDENTITY_ID = process.env.NEXT_PUBLIC_MOLTBOT_IDENTITY_ID;

export class GlobalStore {
  accountAddress: string = '';
  walletConnected: boolean = false;
  walletSigned: boolean = false;
  walletSignMessage: string = '';
  walletSignature: string = '';
  highScore: number = 0;
  sortOrder: Order = Order.LATEST;
  rewardsSessionId: string = '';
  rewardsSessionExpiresAt: number = 0;
  rewardsIdentityId: number | null = null;
  rewardsScorebankScore: number = 0;
  rewardsScorebankLoaded: boolean = false;
  rewardsPayoutCooldownSeconds: number = 0;
  rewardsLastPayoutAt: number | null = null;
  rewardsFirstPlayAt: number | null = null;
  rewardsNextPayoutAt: number | null = null;
  rewardsPayoutStatusLoaded: boolean = false;
  rewardsPayoutInFlight: boolean = false;
  rewardsLastPayoutTxHash: string = '';
  identityLoaded: boolean = false;
  hasIdentity: boolean = false;
  identityRegistrationInFlight: boolean = false;
  addressConfig: AddressConfig = {};
  addressConfigLoaded: boolean = false;
  addressConfigError: string = '';
  contractsReady: boolean = false;
  missingContracts: string[] = [];
  private rewardsApiBaseOverride: string | null = null;

  private async waitForTx(hash: `0x${string}`) {
    try {
      const client = getPublicClient();
      await client.waitForTransactionReceipt({ hash });
    } catch {
      // If the RPC is flaky in dev, we still want to proceed.
    }
  }

  private async refreshMarketUntil(
    predicate: () => boolean,
    { attempts = 6, delayMs = 900 }: { attempts?: number; delayMs?: number } = {}
  ) {
    for (let i = 0; i < attempts; i += 1) {
      await this.fetchGlobalNftsList();
      if (predicate()) return;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  marketNftList: IMarketNft[] = [];
  userNftList: IUserNft[] = [];
  coreOwnedNftList: ICoreOwnedNft[] = [];
  coreOwnedNftLoaded: boolean = false;

  page: number = 0;
  marketNftWithMetadata: IMarketNftWithMetadata[] = [];
  userNftWithMetadata: IUserNftWithMetadata[] = [];
  dummyUserNftWithMetadata: IUserNftWithMetadata[] = [
    dummyShellRunner1,
    dummyShellRunner2,
  ];

  constructor() {
    makeAutoObservable(this);
  }

  private authStorageKey(address: string) {
    return `moltstation_auth_${NET_ID}_${address.toLowerCase()}`;
  }

  private loadPersistedAuth(address: string) {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(this.authStorageKey(address));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { message?: string; signature?: string };
      if (parsed?.message && parsed?.signature) {
        runInAction(() => {
          this.walletSigned = true;
          this.walletSignMessage = parsed.message ?? '';
          this.walletSignature = parsed.signature ?? '';
        });
      }
    } catch {
      // ignore
    }
  }

  private persistAuth(address: string, message: string, signature: string) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        this.authStorageKey(address),
        JSON.stringify({ message, signature })
      );
    } catch {
      // ignore
    }
  }

  private buildSignInMessage(address: string) {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://moltstation.games';
    const domain =
      typeof window !== 'undefined' && window.location?.host
        ? window.location.host
        : 'moltstation.games';
    const nonce = this.createSessionId().slice(2, 10);
    const issuedAt = new Date().toISOString();

    return [
      `${domain} wants you to sign in with your Ethereum account:`,
      address,
      '',
      'MoltStation sign-in (no gas, no transaction).',
      '',
      `URI: ${origin}`,
      'Version: 1',
      `Chain ID: ${NET_ID}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt}`,
    ].join('\n');
  }

  async signInIfNeeded(address: string) {
    if (typeof window === 'undefined') return;
    if (!window.ethereum) return;

    this.loadPersistedAuth(address);
    if (this.walletSigned && this.walletSignature) {
      return;
    }

    const message = this.buildSignInMessage(address);
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, address],
    });

    runInAction(() => {
      this.walletSigned = true;
      this.walletSignMessage = message;
      this.walletSignature = String(signature ?? '');
    });
    this.persistAuth(address, message, String(signature ?? ''));
  }

  async autoConnectWallet() {
    await this.ensureAddressConfigLoaded();
    if (typeof window === 'undefined') return;
    if (!window.ethereum) return;
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      const accountAddress = (accounts?.[0] ?? '') as string;
      if (!accountAddress) return;
      this.loadPersistedAuth(accountAddress);
      runInAction(() => {
        this.accountAddress = accountAddress;
        this.walletConnected = true;
      });
      void this.trackAnalyticsEvent('login', {
        metadata: {
          source: 'auto_connect',
          signed: Boolean(this.walletSigned && this.walletSignature),
        },
      });
      this.refreshContractStatus();
    } catch {
      // ignore
    }
  }

  private resolveAddress(value: unknown): Address | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return null;
    return trimmed as Address;
  }

  private resolveNumeric(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  }

  private async ensureAddressConfigLoaded() {
    if (this.addressConfigLoaded || typeof window === 'undefined') {
      return;
    }
    try {
      const response = await fetch('/config/addresses.json', {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Config load failed (${response.status})`);
      }
      const data = (await response.json()) as AddressConfig;
      runInAction(() => {
        this.addressConfig = data ?? {};
        this.addressConfigLoaded = true;
        this.addressConfigError = '';
      });
    } catch (e) {
      runInAction(() => {
        this.addressConfigLoaded = true;
        this.addressConfigError = (e as Error).message;
      });
    }
    this.refreshContractStatus();
  }

  private refreshContractStatus() {
    const missing: string[] = [];
    if (!this.resolveShellRunnersAddress()) {
      missing.push('ShellRunners address');
    }
    if (!this.resolveMarketAddress()) {
      missing.push('Market address');
    }
    if (!this.getIdentityContractAddress()) {
      missing.push('Identity address');
    }
    if (!this.getRewardsContractAddress()) {
      missing.push('Rewards address');
    }
    if (!this.getPoptContractAddress()) {
      missing.push('PoPT address');
    }
    runInAction(() => {
      this.missingContracts = missing;
      this.contractsReady = missing.length === 0;
    });
  }

  private resolveShellRunnersAddress(): Address | null {
    return this.resolveAddress(
      this.addressConfig.shellRunners ?? ENV_SHELLRUNNERS_ADDRESS
    );
  }

  private resolveMarketAddress(): Address | null {
    return this.resolveAddress(
      this.addressConfig.market ?? ENV_MARKET_ADDRESS
    );
  }

  private resolveCollectionLabel(nftContract: Address): string {
    const shellRunners = this.resolveShellRunnersAddress();
    const identity = this.getIdentityContractAddress();
    const rewards = this.getRewardsContractAddress();
    const popt = this.getPoptContractAddress();
    if (shellRunners && nftContract.toLowerCase() === shellRunners.toLowerCase()) {
      return 'Shell Runners';
    }
    if (identity && nftContract.toLowerCase() === identity.toLowerCase()) {
      return 'Identity';
    }
    if (popt && nftContract.toLowerCase() === popt.toLowerCase()) {
      return 'PoPT';
    }
    if (rewards && nftContract.toLowerCase() === rewards.toLowerCase()) {
      return 'Rewards';
    }
    return 'Collection';
  }

  private getMarketAddresses() {
    const shellRunnersMarket = this.resolveMarketAddress();
    if (!shellRunnersMarket) {
      return null;
    }
    return { shellRunnersMarket };
  }

  private requireMarketAddresses() {
    const addresses = this.getMarketAddresses();
    if (!addresses) {
      if (process.env.NODE_ENV === 'development') {
        notify('danger', 'Marketplace contracts not configured');
        return null;
      }
      throw new Error('Missing marketplace address configuration');
    }
    return addresses;
  }

  private requireShellRunnersAddress(): Address | null {
    const shellRunners = this.resolveShellRunnersAddress();
    if (!shellRunners) {
      if (process.env.NODE_ENV === 'development') {
        notify('danger', 'Shell Runners contract not configured');
        return null;
      }
      throw new Error('Missing Shell Runners contract address');
    }
    return shellRunners;
  }

  private getRewardsApiBase(): string | null {
    const base = process.env.NEXT_PUBLIC_MOLTBOT_API_URL;
    if (base) {
      return base.replace(/\/$/, '');
    }
    if (this.rewardsApiBaseOverride) {
      return this.rewardsApiBaseOverride.replace(/\/$/, '');
    }
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:4100';
    }
    return null;
  }

  private async fetchRewardsApi(
    path: string,
    init: RequestInit
  ): Promise<Response> {
    const base0 = this.getRewardsApiBase();
    if (!base0) {
      throw new Error('Rewards API not configured');
    }
    const url0 = `${base0}${path}`;
    try {
      return await fetch(url0, init);
    } catch (e) {
      // Dev-only fallback: if the backend is already running on 4101 (or 4100),
      // retry once and cache the working base for this session.
      if (process.env.NODE_ENV !== 'development') throw e;

      const candidates: string[] = [];
      if (base0.includes('localhost:4100')) {
        candidates.push(base0.replace('localhost:4100', 'localhost:4101'));
      } else if (base0.includes('localhost:4101')) {
        candidates.push(base0.replace('localhost:4101', 'localhost:4100'));
      } else {
        candidates.push('http://localhost:4100', 'http://localhost:4101');
      }

      for (const base1 of candidates) {
        try {
          const res = await fetch(`${base1}${path}`, init);
          this.rewardsApiBaseOverride = base1;
          return res;
        } catch {
          // keep trying
        }
      }
      throw e;
    }
  }

  private async trackAnalyticsEvent(
    eventType: 'login' | 'logout' | 'game_end' | 'identity_checked' | 'popt_checked',
    payload: Record<string, unknown> = {}
  ) {
    if (!this.accountAddress) return;
    try {
      await this.fetchRewardsApi('/api/events/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          walletAddress: this.accountAddress,
          ...payload,
        }),
      });
    } catch {
      // Analytics should never block gameplay.
    }
  }

  private getRewardsContractAddress(): Address | null {
    return this.resolveAddress(
      this.addressConfig.rewards ?? ENV_REWARDS_ADDRESS
    );
  }

  private getIdentityContractAddress(): Address | null {
    return this.resolveAddress(
      this.addressConfig.identity ?? ENV_IDENTITY_ADDRESS
    );
  }

  private getPoptContractAddress(): Address | null {
    return this.resolveAddress(this.addressConfig.popt ?? ENV_POPT_ADDRESS);
  }

  private getSessionTtlSeconds(): number {
    const ttl = Number(process.env.NEXT_PUBLIC_MOLTBOT_SESSION_TTL_SECONDS ?? 3600);
    return Number.isFinite(ttl) && ttl > 0 ? ttl : 3600;
  }

  private createSessionId(): string {
    const bytes = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return `0x${Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`;
  }

  private resolvePoptId(): number {
    const configValue = this.resolveNumeric(this.addressConfig.poptId);
    if (configValue !== null && configValue >= 0) return configValue;
    const envValue = this.resolveNumeric(ENV_POPT_ID);
    if (envValue !== null && envValue >= 0) return envValue;
    return 0;
  }

  private resolveIdentityId(): number | null {
    const configValue = this.resolveNumeric(this.addressConfig.identityId);
    if (configValue !== null && configValue > 0) return configValue;
    const envValue = this.resolveNumeric(ENV_IDENTITY_ID);
    if (envValue !== null && envValue > 0) return envValue;
    if (this.rewardsIdentityId !== null) {
      return this.rewardsIdentityId;
    }
    return null;
  }

  async purchaseShellRunner(id: number, price: number) {
    await this.ensureAddressConfigLoaded();
    try {
      if (!this.walletConnected) throw new Error('Not connected to wallet');
      const addresses = this.requireMarketAddresses();
      if (!addresses) return;
      const shellRunners = this.requireShellRunnersAddress();
      if (!shellRunners) return;
      const { shellRunnersMarket } = addresses;
      await write({
        address: shellRunnersMarket,
        abi: moltBotArenaMarketAbi,
        functionName: 'createMarketSale',
        args: [shellRunners, BigInt(id)],
        account: this.accountAddress as Address,
        value: parseEther(price.toString()),
      });
      notify('success', 'Purchase Successfull');
    } catch (e) {
      notify('danger', (e as Error).message);
    }
  }

  async purchaseMarketItem({
    nftContract,
    itemId,
    price,
  }: {
    nftContract: Address;
    itemId: number;
    price: number;
  }) {
    await this.ensureAddressConfigLoaded();
    try {
      if (!this.walletConnected) throw new Error('Not connected to wallet');
      const addresses = this.requireMarketAddresses();
      if (!addresses) return;
      const { shellRunnersMarket } = addresses;
      const hash = await write({
        address: shellRunnersMarket,
        abi: moltBotArenaMarketAbi,
        functionName: 'createMarketSale',
        args: [nftContract, BigInt(itemId)],
        account: this.accountAddress as Address,
        value: parseEther(price.toString()),
      });
      // Wait so the UI refresh doesn't race the block inclusion.
      // @ts-ignore viem hash type narrowing isn't enforced across our wrappers.
      await this.waitForTx(hash);
      notify('success', 'Purchase successful');
      await this.fetchGLobalNftByPage();
    } catch (e) {
      notify('danger', (e as Error).message);
    }
  }

  async cancelMarketItem(itemId: number) {
    await this.ensureAddressConfigLoaded();
    try {
      if (!this.walletConnected) throw new Error('Not connected to wallet');
      const addresses = this.requireMarketAddresses();
      if (!addresses) return;
      const { shellRunnersMarket } = addresses;
      const hash = await write({
        address: shellRunnersMarket,
        abi: moltBotArenaMarketAbi,
        functionName: 'cancelMarketItem',
        args: [BigInt(itemId)],
        account: this.accountAddress as Address,
      });
      // @ts-ignore
      await this.waitForTx(hash);
      notify('success', 'Listing canceled');
      await this.refreshMarketUntil(
        () => !(this.marketNftList ?? []).some((it) => it.itemId === itemId)
      );
      await this.fetchCoreOwnedNfts(true);
    } catch (e) {
      notify('danger', (e as Error).message);
    }
  }

  async listCoreNftForSale({
    nftContract,
    tokenId,
    priceEth,
  }: {
    nftContract: Address;
    tokenId: number;
    priceEth?: string;
  }) {
    await this.ensureAddressConfigLoaded();
    const priceInput = (priceEth ?? '').trim();
    if (!priceInput) {
      notify('danger', 'Missing price');
      return;
    }
    const price = parseEther(priceInput);

    try {
      if (!this.walletConnected || !this.accountAddress) {
        throw new Error('Not connected to wallet');
      }
      const addresses = this.requireMarketAddresses();
      if (!addresses) return;
      const { shellRunnersMarket } = addresses;

      const approved = await read({
        address: nftContract,
        abi: erc721ApprovalAbi,
        functionName: 'isApprovedForAll',
        args: [this.accountAddress as Address, shellRunnersMarket],
      });
      if (!approved) {
        const approveHash = await write({
          address: nftContract,
          abi: erc721ApprovalAbi,
          functionName: 'setApprovalForAll',
          args: [shellRunnersMarket, true],
          account: this.accountAddress as Address,
        });
        // @ts-ignore
        await this.waitForTx(approveHash);
      }

      const listingPrice = await read({
        address: shellRunnersMarket,
        abi: moltBotArenaMarketAbi,
        functionName: 'getListingPrice',
      });
      const nonce = await read({
        address: shellRunnersMarket,
        abi: moltBotArenaMarketAbi,
        functionName: 'listingNonces',
        args: [this.accountAddress as Address],
      });
      const wallet = getWalletClient();
      if (!wallet) throw new Error('Wallet not detected');
      const chainId = await getChainId();
      if (!chainId) throw new Error('Missing chain id');

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 24 * 60 * 60);
      const signature = await wallet.signTypedData({
        account: this.accountAddress as Address,
        domain: {
          name: 'MoltBotArenaMarket',
          version: '1',
          chainId,
          verifyingContract: shellRunnersMarket,
        },
        types: {
          Listing: [
            { name: 'seller', type: 'address' },
            { name: 'nftContract', type: 'address' },
            { name: 'tokenId', type: 'uint256' },
            { name: 'price', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'Listing',
        message: {
          seller: this.accountAddress as Address,
          nftContract,
          tokenId: BigInt(tokenId),
          price,
          nonce,
          deadline,
        },
      });

      const listHash = await write({
        address: shellRunnersMarket,
        abi: moltBotArenaMarketAbi,
        functionName: 'createMarketItem',
        args: [nftContract, BigInt(tokenId), price, deadline, signature],
        account: this.accountAddress as Address,
        value: listingPrice,
      });
      // @ts-ignore
      await this.waitForTx(listHash);

      notify('success', 'Listed for sale');
      await this.refreshMarketUntil(
        () =>
          (this.marketNftList ?? []).some(
            (it) =>
              it.nftContract.toLowerCase() === nftContract.toLowerCase() &&
              it.tokenId === tokenId &&
              !it.sold
          )
      );
      await this.fetchCoreOwnedNfts(true);
    } catch (e) {
      console.error(e);
      notify('danger', 'Error trying to list NFT');
    }
  }

  async fetchGLobalNftByPage() {
    await this.fetchGlobalNftsList();
    const nfts = sortNfts(this.marketNftList, this.sortOrder);
    const min = Math.min((this.page + 1) * 6, nfts.length);
    const promises: Promise<IMetadata>[] = [];
    const nftSlice: IMarketNft[] = [];
    for (let i = this.page * 6; i < min; i++) {
      const tokenUri = nfts[i].tokenUri;
      if (tokenUri) {
        promises.push(fetchIpfs(tokenUri));
      } else {
        promises.push(
          Promise.resolve({
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
          })
        );
      }
      nftSlice.push(nfts[i]);
    }
    const metadata: IMetadata[] = await Promise.all(
      promises.map((promise) =>
        promise.catch(() => ({
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
        }))
      )
    );
    const nftsWithMetadata: IMarketNftWithMetadata[] = nftSlice.map(
      (nft, index): IMarketNftWithMetadata => ({
        ...nft,
        metadata: metadata[index],
      })
    );

    runInAction(() => {
      this.marketNftWithMetadata = nftsWithMetadata;
    });
  }

  async fetchUserNfts() {
    await this.fetchUserNftsList();
    const promises = [];
    const nftSlice: IUserNft[] = [];
    for (let i = 0; i < this.userNftList.length; i++) {
      promises.push(fetchIpfs(this.userNftList[i].tokenUri));
      nftSlice.push(this.userNftList[i]);
    }
    let metadata = await Promise.all(promises);
    metadata = metadata.map((data) => {
      data.image = ipfsToHttp(data.image);
      return data;
    });
    const nftsWithMetadata: IUserNftWithMetadata[] = nftSlice.map(
      (nft, index): IUserNftWithMetadata => ({
        ...nft,
        metadata: metadata[index],
      })
    );

    runInAction(() => {
      this.userNftWithMetadata = nftsWithMetadata;
    });
  }

  async connectToWallet() {
    await this.ensureAddressConfigLoaded();
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const netId = await getChainId();
        if (netId !== NET_ID) {
          await switchToBaseSepolia();
        }
        const finalNetId = await getChainId();
        if (finalNetId !== NET_ID) {
          throw new Error('Wrong network');
        }
        const wallet = getWalletClient();
        if (!wallet) throw new Error('Wallet not detected');
        const accounts = await wallet.getAddresses();
        const accountAddress = accounts[0];
        if (!accountAddress) throw new Error('No wallet account found');
        await this.signInIfNeeded(accountAddress);
        runInAction(() => {
          this.accountAddress = accountAddress;
          this.walletConnected = true;
        });
        void this.trackAnalyticsEvent('login', {
          metadata: {
            source: 'wallet_connect',
            chainId: finalNetId,
          },
        });
      } catch (e) {
        console.error(e);
        notify('danger', 'Connection error');
      }
    } else notify('danger', 'Wallet not detected');
  }

  disconnectWallet() {
    const walletAddress = this.accountAddress;
    if (walletAddress) {
      void this.trackAnalyticsEvent('logout', {
        metadata: { source: 'wallet_disconnect' },
      });
    }
    runInAction(() => {
      this.accountAddress = '';
      this.walletConnected = false;
      this.walletSigned = false;
      this.walletSignMessage = '';
      this.walletSignature = '';
      this.highScore = 0;
      this.userNftList = [];
      this.userNftWithMetadata = [];
      this.marketNftList = [];
      this.marketNftWithMetadata = [];
      this.coreOwnedNftList = [];
      this.coreOwnedNftLoaded = false;
      this.rewardsSessionId = '';
      this.rewardsSessionExpiresAt = 0;
      this.rewardsIdentityId = null;
      this.rewardsScorebankScore = 0;
      this.rewardsScorebankLoaded = false;
      this.rewardsPayoutStatusLoaded = false;
      this.rewardsPayoutInFlight = false;
      this.rewardsLastPayoutTxHash = '';
      this.identityLoaded = false;
      this.hasIdentity = false;
      this.identityRegistrationInFlight = false;
    });
  }

  closeGameplaySession() {
    runInAction(() => {
      this.rewardsSessionId = '';
      this.rewardsSessionExpiresAt = 0;
    });
  }

  private computeGameId(label: string) {
    return keccak256(toBytes(label));
  }

  async fetchCoreOwnedNfts(force = false) {
    await this.ensureAddressConfigLoaded();
    if (!force && this.coreOwnedNftLoaded) {
      return;
    }
    if (!this.walletConnected || !this.accountAddress) {
      runInAction(() => {
        this.coreOwnedNftList = [];
        this.coreOwnedNftLoaded = true;
      });
      return;
    }

    const identity = this.getIdentityContractAddress();
    const popt = this.getPoptContractAddress();
    const shellRunners = this.resolveShellRunnersAddress();
    const owned: ICoreOwnedNft[] = [];
    let poptTokenId: number | null = null;

    try {
      if (identity) {
        const tokenId = await read({
          address: identity,
          abi: identityAbi,
          functionName: 'primaryIdentity',
          args: [this.accountAddress as Address],
        });
        const parsed = Number(tokenId);
        if (Number.isFinite(parsed) && parsed > 0) {
          runInAction(() => {
            this.rewardsIdentityId = parsed;
          });
          const tokenUri = await read({
            address: identity,
            abi: erc721MetadataAbi,
            functionName: 'tokenURI',
            args: [BigInt(parsed)],
          });
          owned.push({
            tokenId: parsed,
            tokenUri: String(tokenUri ?? ''),
            nftContract: identity,
            collectionLabel: 'Identity',
          });
        }
      }

      const identityId = this.resolveIdentityId();
      if (popt && identityId && identityId > 0) {
        let poptId: unknown = 0n;
        try {
          poptId = await read({
            address: popt,
            abi: poptAbi,
            functionName: 'getPoPTId',
            args: [BigInt(identityId)],
          });
        } catch {
          // Backward compatibility with older deployments that still use getPoPTId(bytes32,uint256)
          const gameId = this.computeGameId('SHELLRUNNERS');
          poptId = await read({
            address: popt,
            abi: poptAbi,
            functionName: 'getPoPTId',
            args: [gameId, BigInt(identityId)],
          });
        }
        const parsed = Number(poptId);
        if (Number.isFinite(parsed) && parsed > 0) {
          poptTokenId = parsed;
          const tokenUri = await read({
            address: popt,
            abi: erc721MetadataAbi,
            functionName: 'tokenURI',
            args: [BigInt(parsed)],
          });
          owned.push({
            tokenId: parsed,
            tokenUri: String(tokenUri ?? ''),
            nftContract: popt,
            collectionLabel: 'PoPT',
          });
        }
      }

      // ShellRunners (game NFTs) are listable on the neutral core marketplace too.
      // Pull the user's owned ShellRunners so they can list/cancel directly from /market.
      if (shellRunners) {
        try {
          const nfts = await read({
            address: shellRunners,
            abi: shellRunnersAbi,
            functionName: 'getUserOwnedNFTs',
            args: [this.accountAddress as Address],
          });
          (nfts ?? []).forEach((item: any) => {
            const tokenId = Number(item.tokenId);
            const tokenUri = String(item.tokenURI ?? item.tokenUri ?? '');
            if (Number.isFinite(tokenId)) {
              owned.push({
                tokenId,
                tokenUri,
                nftContract: shellRunners,
                collectionLabel: 'Shell Runners',
              });
            }
          });
        } catch (e) {
          console.error(e);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (this.accountAddress && popt) {
        void this.trackAnalyticsEvent('popt_checked', {
          hasPoPT: poptTokenId !== null,
          tokenId: poptTokenId,
          contractAddress: popt,
        });
      }
      runInAction(() => {
        this.coreOwnedNftList = owned;
        this.coreOwnedNftLoaded = true;
      });
    }
  }

  async fetchGlobalNftsList() {
    await this.ensureAddressConfigLoaded();
    const addresses = this.requireMarketAddresses();
    if (!addresses) return;
    const { shellRunnersMarket } = addresses;
    const nftsData = await read({
      address: shellRunnersMarket,
      abi: moltBotArenaMarketAbi,
      functionName: 'fetchMarketItems',
    });
    const uri = await Promise.all(
      nftsData.map(async (nft: any) => {
        try {
          return await read({
            address: nft.nftContract,
            abi: erc721MetadataAbi,
            functionName: 'tokenURI',
            args: [nft.tokenId],
          });
        } catch (error) {
          console.warn('tokenURI fetch failed', nft.nftContract, nft.tokenId);
          return '';
        }
      })
    );
    runInAction(() => {
      this.marketNftList = nftsData.map((item: any, index: number) => ({
        price: parseFloat(formatEther(item.price)),
        owner: item.owner,
        seller: item.seller,
        sold: item.sold,
        tokenId: Number(item.tokenId),
        itemId: Number(item.itemId),
        tokenUri: uri[index],
        nftContract: item.nftContract,
        collectionLabel: this.resolveCollectionLabel(item.nftContract),
      }));
    });
  }

  async fetchUserNftsList(force = false) {
    await this.ensureAddressConfigLoaded();
    if (this.accountAddress) {
      const shellRunners = this.requireShellRunnersAddress();
      if (!shellRunners) return;
      const [newUserNftCount, highScore] = await Promise.all([
        read({
          address: shellRunners,
          abi: shellRunnersAbi,
          functionName: 'balanceOf',
          args: [this.accountAddress as Address],
        }),
        read({
          address: shellRunners,
          abi: shellRunnersAbi,
          functionName: 'userAddressToHighScore',
          args: [this.accountAddress as Address],
        }),
      ]);
      runInAction(() => {
        this.highScore = Number(highScore);
      });
      if (force || Number(newUserNftCount) !== this.userNftList.length) {
        const nftsData = await read({
          address: shellRunners,
          abi: shellRunnersAbi,
          functionName: 'getUserOwnedNFTs',
          args: [this.accountAddress as Address],
        });
        runInAction(() => {
          this.userNftList = nftsData.map((item: any) => ({
            tokenId: Number(item.tokenId),
            tokenUri: item.tokenURI,
          }));
        });
      }
    } else {
      // Not connected
    }
  }

  async fetchRewardsScorebank() {
    await this.ensureAddressConfigLoaded();
    if (!this.walletConnected || !this.accountAddress) {
      runInAction(() => {
        this.rewardsScorebankLoaded = true;
      });
      return;
    }
    try {
      const response = await this.fetchRewardsApi(`/api/rewards/scorebank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: this.accountAddress }),
      });
      if (!response.ok) {
        let message = 'Scorebank fetch failed';
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload?.error) {
            message = payload.error;
          }
        } catch {
          // keep generic message
        }
        throw new Error(message);
      }
      const payload = await response.json();
      const score = Number(payload.score ?? 0);
      const identityId = Number(payload.identityId ?? NaN);
      const sessionId = String(payload.sessionId ?? '');
      const sessionExpiresAt = Number(payload.sessionExpiresAt ?? NaN);
      runInAction(() => {
        this.rewardsScorebankScore = Number.isFinite(score) ? score : 0;
        if (Number.isFinite(identityId) && identityId > 0) {
          this.rewardsIdentityId = identityId;
        }
        this.rewardsSessionId =
          sessionId && /^0x[a-fA-F0-9]{64}$/.test(sessionId) && !/^0x0+$/.test(sessionId)
            ? sessionId
            : '';
        this.rewardsSessionExpiresAt =
          Number.isFinite(sessionExpiresAt) && sessionExpiresAt > 0
            ? sessionExpiresAt * 1000
            : 0;
        this.rewardsScorebankLoaded = true;
      });
    } catch (e) {
      runInAction(() => {
        this.rewardsScorebankLoaded = true;
      });
      console.error(e);
    }
  }

  async fetchIdentityStatus() {
    await this.ensureAddressConfigLoaded();
    const identityAddress = this.getIdentityContractAddress();
    if (!identityAddress || !this.walletConnected || !this.accountAddress) {
      runInAction(() => {
        this.identityLoaded = true;
        this.hasIdentity = false;
      });
      return;
    }
    try {
      const tokenId = await read({
        address: identityAddress,
        abi: identityAbi,
        functionName: 'primaryIdentity',
        args: [this.accountAddress as Address],
      });
      const parsed = Number(tokenId);
      runInAction(() => {
        if (Number.isFinite(parsed) && parsed > 0) {
          this.rewardsIdentityId = parsed;
          this.hasIdentity = true;
        } else {
          this.rewardsIdentityId = null;
          this.hasIdentity = false;
        }
        this.identityLoaded = true;
      });
      void this.trackAnalyticsEvent('identity_checked', {
        hasIdentity: Number.isFinite(parsed) && parsed > 0,
        tokenId: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
        contractAddress: identityAddress,
      });
    } catch (e) {
      runInAction(() => {
        this.identityLoaded = true;
        this.hasIdentity = false;
      });
      console.error(e);
    }
  }

  async registerIdentity({
    agentName,
    hardwareResources,
    agentType,
  }: {
    agentName: string;
    hardwareResources: string;
    agentType: string;
  }) {
    await this.ensureAddressConfigLoaded();
    if (!this.walletConnected || !this.accountAddress) {
      notify('danger', 'Wallet not connected');
      return;
    }
    const identityAddress = this.getIdentityContractAddress();
    if (!identityAddress) {
      notify('danger', 'Identity contract not configured');
      return;
    }
    const chainId = await getChainId();
    if (!chainId) {
      notify('danger', 'Missing chain id');
      return;
    }
    runInAction(() => {
      this.identityRegistrationInFlight = true;
    });

    try {
      const nonce = await read({
        address: identityAddress,
        abi: identityAbi,
        functionName: 'mintNonces',
        args: [this.accountAddress as Address],
      });
      const deadline = Math.floor(Date.now() / 1000) + 5 * 60;
      const response = await this.fetchRewardsApi(`/api/identity/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: this.accountAddress,
          agentName,
          hardwareResources,
          agentType,
          chainId,
          verifyingContract: identityAddress,
          nonce: nonce.toString(),
          deadline: deadline.toString(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Identity registration failed');
      }
      await write({
        address: identityAddress,
        abi: identityAbi,
        functionName: 'mintIdentityWithSignature',
        args: [
          this.accountAddress as Address,
          payload.tokenURI,
          BigInt(deadline),
          payload.signature,
        ],
        account: this.accountAddress as Address,
      });
      notify('success', 'Identity minted');
      await this.fetchIdentityStatus();
    } catch (e) {
      notify('danger', (e as Error).message);
    } finally {
      runInAction(() => {
        this.identityRegistrationInFlight = false;
      });
    }
  }

  async fetchRewardsPayoutStatus() {
    await this.ensureAddressConfigLoaded();
    const rewardsAddress = this.getRewardsContractAddress();
    const identityId = this.resolveIdentityId();
    if (!rewardsAddress || identityId === null) {
      runInAction(() => {
        this.rewardsPayoutStatusLoaded = true;
      });
      return;
    }
    try {
      const [cooldown, lastPayoutAt, firstPlayAt] = await Promise.all([
        read({
          address: rewardsAddress,
          abi: rewardsAbi,
          functionName: 'payoutCooldown',
        }),
        read({
          address: rewardsAddress,
          abi: rewardsAbi,
          functionName: 'lastPayoutAt',
          args: [BigInt(identityId)],
        }),
        read({
          address: rewardsAddress,
          abi: rewardsAbi,
          functionName: 'firstPlayAt',
          args: [BigInt(identityId)],
        }),
      ]);

      const cooldownSeconds = Number(cooldown);
      const lastPayoutSeconds = Number(lastPayoutAt);
      const firstPlaySeconds = Number(firstPlayAt);
      const nextSeconds =
        lastPayoutSeconds > 0
          ? lastPayoutSeconds + cooldownSeconds
          : firstPlaySeconds > 0
            ? firstPlaySeconds + cooldownSeconds
            : 0;

      runInAction(() => {
        this.rewardsPayoutCooldownSeconds = Number.isFinite(cooldownSeconds)
          ? cooldownSeconds
          : 0;
        this.rewardsLastPayoutAt =
          lastPayoutSeconds > 0 ? lastPayoutSeconds * 1000 : null;
        this.rewardsFirstPlayAt =
          firstPlaySeconds > 0 ? firstPlaySeconds * 1000 : null;
        this.rewardsNextPayoutAt = nextSeconds > 0 ? nextSeconds * 1000 : null;
        this.rewardsPayoutStatusLoaded = true;
      });
    } catch (e) {
      runInAction(() => {
        this.rewardsPayoutStatusLoaded = true;
      });
      console.error(e);
    }
  }

  async startRewardsSession(options?: { silent?: boolean }): Promise<boolean> {
    const silent = Boolean(options?.silent);
    await this.ensureAddressConfigLoaded();
    if (!this.walletConnected || !this.accountAddress) {
      if (!silent) notify('danger', 'Wallet not connected');
      return false;
    }
    if (
      this.rewardsSessionId &&
      this.rewardsSessionExpiresAt > Date.now() + 5000
    ) {
      return true;
    }
    const identityId = this.resolveIdentityId();
    if (identityId === null) {
      if (!silent) notify('danger', 'Identity not configured');
      return false;
    }
    const sessionId = this.createSessionId();
    const ttlSeconds = this.getSessionTtlSeconds();
    try {
      const response = await this.fetchRewardsApi(`/api/rewards/start-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: this.accountAddress,
          identityId,
          sessionId,
          ttlSeconds,
        }),
      });
      let payload: { txHash?: string; error?: string } = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to start rewards session');
      }
      runInAction(() => {
        this.rewardsSessionId = sessionId;
        this.rewardsSessionExpiresAt = Date.now() + ttlSeconds * 1000;
        this.rewardsIdentityId = identityId;
      });
      if (!silent) notify('success', 'Rewards session started');
      await this.fetchRewardsScorebank();
      return true;
    } catch (e) {
      if (!silent) notify('danger', (e as Error).message);
      console.error(e);
      return false;
    }
  }

  async snapshotRewardsScore(score: number) {
    if (!this.walletConnected || !this.accountAddress) {
      return;
    }
    if (
      !this.rewardsSessionId ||
      this.rewardsSessionExpiresAt <= Date.now() + 1000
    ) {
      const started = await this.startRewardsSession({ silent: true });
      if (!started || !this.rewardsSessionId) return;
    }
    const submitSnapshot = async () =>
      this.fetchRewardsApi(`/api/rewards/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: this.accountAddress,
          sessionId: this.rewardsSessionId,
          score: Math.floor(score),
        }),
      });

    try {
      let response = await submitSnapshot();
      if (!response.ok) {
        let errMsg = 'Snapshot failed';
        let errCode = '';
        try {
          const payload = (await response.json()) as {
            error?: string;
            code?: string;
          };
          errMsg = String(payload?.error ?? errMsg);
          errCode = String(payload?.code ?? '');
        } catch {
          // ignore parse errors
        }

        const isInvalidSession =
          response.status === 409 ||
          errCode === 'INVALID_SESSION' ||
          /invalid session/i.test(errMsg);

        if (isInvalidSession) {
          runInAction(() => {
            this.rewardsSessionId = '';
            this.rewardsSessionExpiresAt = 0;
          });
          const started = await this.startRewardsSession({ silent: true });
          if (!started || !this.rewardsSessionId) {
            throw new Error('Invalid session');
          }
          response = await submitSnapshot();
          if (!response.ok) {
            let retryMsg = 'Snapshot failed';
            try {
              const payload = (await response.json()) as { error?: string };
              retryMsg = String(payload?.error ?? retryMsg);
            } catch {
              // ignore parse errors
            }
            throw new Error(retryMsg);
          }
        } else {
          throw new Error(errMsg);
        }
      }
      runInAction(() => {
        const snapped = Math.floor(score);
        if (Number.isFinite(snapped) && snapped > this.rewardsScorebankScore) {
          this.rewardsScorebankScore = snapped;
        }
        this.rewardsScorebankLoaded = true;
      });
    } catch (e) {
      console.warn('snapshotRewardsScore', (e as Error).message);
    }
  }

  async requestRewardsPayout() {
    await this.ensureAddressConfigLoaded();
    if (!this.walletConnected || !this.accountAddress) {
      notify('danger', 'Wallet not connected');
      return;
    }
    if (!this.rewardsSessionId) {
      notify('danger', 'No active rewards session');
      return;
    }
    const identityId = this.resolveIdentityId();
    if (identityId === null) {
      notify('danger', 'Identity not configured');
      return;
    }
    const poptId = this.resolvePoptId();
    const score = Math.floor(this.rewardsScorebankScore);
    if (!Number.isFinite(score) || score <= 0) {
      notify('danger', 'No score available for payout');
      return;
    }

    runInAction(() => {
      this.rewardsPayoutInFlight = true;
    });

    try {
      const deadline = Math.floor(Date.now() / 1000) + 5 * 60;
      const response = await this.fetchRewardsApi(`/api/rewards/payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: this.accountAddress,
          identityId,
          poptId,
          score,
          sessionId: this.rewardsSessionId,
          deadline,
        }),
      });
      let payload: { txHash?: string; amount?: string; error?: string } = {};
      try {
        payload = await response.json();
      } catch (e) {
        payload = {};
      }
      if (!response.ok) {
        throw new Error(payload.error ?? 'Payout failed');
      }
      runInAction(() => {
        this.rewardsLastPayoutTxHash = payload.txHash ?? '';
      });
      notify('success', 'Payout submitted');
      await this.fetchRewardsScorebank();
      await this.fetchRewardsPayoutStatus();
    } catch (e) {
      notify('danger', (e as Error).message);
    } finally {
      runInAction(() => {
        this.rewardsPayoutInFlight = false;
      });
    }
  }

  async trackGameEnd(score: number, metersTravelled: number, choseToMint: boolean) {
    if (!this.walletConnected || !this.accountAddress) return;
    await this.trackAnalyticsEvent('game_end', {
      sessionId: this.rewardsSessionId || null,
      score: Math.floor(score),
      metersTravelled: Math.floor(metersTravelled),
      choseToMint: Boolean(choseToMint),
    });
  }

  async mintNFT(score: number): Promise<boolean> {
    await this.ensureAddressConfigLoaded();
    try {
      if (!this.walletConnected || !this.accountAddress) {
        notify('danger', 'Wallet not connected');
        return false;
      }
      const shellRunners = this.requireShellRunnersAddress();
      if (!shellRunners) return false;
      const currentHighScoreRaw = await read({
        address: shellRunners,
        abi: shellRunnersAbi,
        functionName: 'userAddressToHighScore',
        args: [this.accountAddress as Address],
      });
      const currentHighScore = Number(currentHighScoreRaw);
      if (Number.isFinite(currentHighScore)) {
        runInAction(() => {
          this.highScore = Math.max(this.highScore, currentHighScore);
        });
      }
      if (score <= Math.max(this.highScore, Number.isFinite(currentHighScore) ? currentHighScore : 0)) {
        throw new Error('Not a new high score');
      }

      // Platform rule: only mint once; subsequent improvements upgrade the first minted NFT.
      await this.fetchUserNftsList(true);
      const owned = (this.userNftList ?? []).filter((n) => Number(n.tokenId) >= 0);
      const hasShellRunner = owned.length > 0;
      const targetTokenId = hasShellRunner
        ? owned.map((n) => Number(n.tokenId)).sort((a, b) => a - b)[0]
        : null;

      const resp = await this.fetchRewardsApi('/api/games/shellrunners/nft/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score,
          walletAddress: this.accountAddress,
        }),
      });

      if (!resp.ok) {
        const payload = (await resp.json().catch(() => null)) as
          | { error?: string; code?: string; details?: string }
          | null;
        const message =
          String(payload?.error || '').trim() ||
          String(payload?.code || '').trim() ||
          `Mint metadata API failed (${resp.status})`;
        throw new Error(message);
      }

      const payload = (await resp.json()) as {
        ok?: boolean;
        action?: 'mint' | 'upgrade';
        tokenId?: number | string | null;
        payload?: {
          tokenURI?: string;
          metadataCid?: string;
          nonce?: string | number | bigint;
          deadline?: string | number | bigint;
          signature?: { v: number; r: `0x${string}`; s: `0x${string}` } | string;
        };
        error?: string;
      };
      if (!payload.payload?.signature) {
        throw new Error(payload.error ?? 'Missing signature');
      }

      // Important: tokenURI must match exactly what the backend signed.
      const tokenURI =
        payload.payload.tokenURI ??
        (payload.payload.metadataCid ? `ipfs://${payload.payload.metadataCid}` : '');
      if (!tokenURI) {
        throw new Error('Missing tokenURI');
      }

      const parsedSig =
        typeof payload.payload.signature === 'string'
          ? (JSON.parse(payload.payload.signature) as {
              v: number;
              r: `0x${string}`;
              s: `0x${string}`;
            })
          : (payload.payload.signature as { v: number; r: `0x${string}`; s: `0x${string}` });
      const { v, r, s } = parsedSig;
      if (
        payload.payload?.nonce === undefined ||
        payload.payload?.nonce === null ||
        payload.payload?.deadline === undefined ||
        payload.payload?.deadline === null
      ) {
        throw new Error('Missing nonce/deadline in signature payload');
      }
      const parsedNonce = BigInt(String(payload.payload?.nonce ?? ''));
      const parsedDeadline = BigInt(String(payload.payload?.deadline ?? ''));

      const mode = payload.action === 'upgrade' ? 'upgrade' : 'mint';
      const preparedTokenId = Number(payload.tokenId ?? targetTokenId ?? 0);
      if (mode === 'upgrade' && (!Number.isFinite(preparedTokenId) || preparedTokenId <= 0)) {
        throw new Error('Missing tokenId for upgrade');
      }
      const hash =
        mode === 'upgrade'
          ? await write({
              address: shellRunners,
              abi: shellRunnersAbi,
              functionName: 'upgradeShellRunner',
              args: [
                BigInt(score),
                tokenURI,
                BigInt(preparedTokenId),
                parsedNonce,
                parsedDeadline,
                v,
                r,
                s,
              ],
              account: this.accountAddress as Address,
            })
          : await write({
              address: shellRunners,
              abi: shellRunnersAbi,
              functionName: 'generateShellRunner',
              args: [BigInt(score), tokenURI, parsedNonce, parsedDeadline, v, r, s],
              account: this.accountAddress as Address,
            });
      // @ts-ignore
      await this.waitForTx(hash);
      notify('success', mode === 'upgrade' ? 'ShellRunner updated' : 'ShellRunner minted');
      await this.fetchUserNftsList(true);
      const latestOwned = (this.userNftList ?? []).filter((n) => Number(n.tokenId) >= 0);
      let resolvedTokenId: number | null =
        mode === 'upgrade' && Number.isFinite(preparedTokenId) && preparedTokenId > 0
          ? preparedTokenId
          : null;
      if (resolvedTokenId === null && latestOwned.length > 0) {
        resolvedTokenId = latestOwned
          .map((n) => Number(n.tokenId))
          .filter((n) => Number.isFinite(n) && n > 0)
          .sort((a, b) => a - b)[0] ?? null;
      }
      if (resolvedTokenId !== null) {
        const matched = latestOwned.find((n) => Number(n.tokenId) === resolvedTokenId);
        await this.fetchRewardsApi(`/api/games/shellrunners/nft/record`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: this.accountAddress,
            action: mode,
            tokenId: resolvedTokenId,
            score,
            tokenURI: matched?.tokenUri ?? tokenURI,
            metadataCid: payload.payload?.metadataCid ?? null,
            txHash: String(hash),
          }),
        }).catch(() => {});
      }
      await this.fetchUserNfts();
      return true;
    } catch (e) {
      console.error(e);
      notify('danger', (e as Error).message || 'Minting error');
      return false;
    }
  }

  async setForSale(id: number) {
    await this.ensureAddressConfigLoaded();
    const priceInput = prompt('Enter Price:');
    if (!priceInput) {
      notify('danger', 'Invalid Number');
      return;
    }
    const price = parseEther(priceInput);
    try {
      const addresses = this.requireMarketAddresses();
      if (!addresses) return;
      const shellRunners = this.requireShellRunnersAddress();
      if (!shellRunners) return;
      const { shellRunnersMarket } = addresses;
      const approved = await read({
        address: shellRunners,
        abi: shellRunnersAbi,
        functionName: 'isApprovedForAll',
        args: [this.accountAddress as Address, shellRunnersMarket],
      });
      if (!approved) {
        await write({
          address: shellRunners,
          abi: shellRunnersAbi,
          functionName: 'setApprovalForAll',
          args: [shellRunnersMarket, true],
          account: this.accountAddress as Address,
        });
      }
      const listingPrice = await read({
        address: shellRunnersMarket,
        abi: moltBotArenaMarketAbi,
        functionName: 'getListingPrice',
      });
      const nonce = await read({
        address: shellRunnersMarket,
        abi: moltBotArenaMarketAbi,
        functionName: 'listingNonces',
        args: [this.accountAddress as Address],
      });
      const wallet = getWalletClient();
      if (!wallet) {
        throw new Error('Wallet not detected');
      }
      const chainId = await getChainId();
      if (!chainId) {
        throw new Error('Missing chain id');
      }
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 24 * 60 * 60);
      const signature = await wallet.signTypedData({
        account: this.accountAddress as Address,
        domain: {
          name: 'MoltBotArenaMarket',
          version: '1',
          chainId,
          verifyingContract: shellRunnersMarket,
        },
        types: {
          Listing: [
            { name: 'seller', type: 'address' },
            { name: 'nftContract', type: 'address' },
            { name: 'tokenId', type: 'uint256' },
            { name: 'price', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'Listing',
        message: {
          seller: this.accountAddress as Address,
          nftContract: shellRunners,
          tokenId: BigInt(id),
          price,
          nonce,
          deadline,
        },
      });
      await write({
        address: shellRunnersMarket,
        abi: moltBotArenaMarketAbi,
        functionName: 'createMarketItem',
        args: [shellRunners, BigInt(id), price, deadline, signature],
        account: this.accountAddress as Address,
        value: listingPrice,
      });
      notify('success', 'Successfully set for sale');
    } catch (e) {
      console.error(e);
      notify('danger', 'Error trying to sell Shell Runner');
    }
  }
}
