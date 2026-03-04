import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  toHex,
} from 'viem';
import { base, baseSepolia } from 'viem/chains';

const ENV_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_MOLTBOT_CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID ?? 8453
);
const ACTIVE_CHAIN = ENV_CHAIN_ID === 84532 ? baseSepolia : base;
const DEFAULT_RPC_URL = ACTIVE_CHAIN.id === 8453 ? 'https://mainnet.base.org' : 'https://sepolia.base.org';
const DEFAULT_EXPLORER_URL =
  ACTIVE_CHAIN.id === 8453 ? 'https://basescan.org' : 'https://sepolia.basescan.org';
const RPC_URL =
  (ACTIVE_CHAIN.id === 8453
    ? process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL
    : process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL) ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  DEFAULT_RPC_URL;

let cachedPublicClient: any = null;
let cachedWalletClient: any = null;

export const getPublicClient = () => {
  if (!cachedPublicClient) {
    cachedPublicClient = createPublicClient({
      chain: ACTIVE_CHAIN,
      transport: http(RPC_URL),
    });
  }
  return cachedPublicClient;
};

export const getWalletClient = () => {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  if (!cachedWalletClient) {
    cachedWalletClient = createWalletClient({
      chain: ACTIVE_CHAIN,
      transport: custom(window.ethereum),
    });
  }
  return cachedWalletClient;
};

export const getChainId = async () => {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  const wallet = getWalletClient();
  if (!wallet) return null;
  return wallet.getChainId();
};

export const switchToBaseSepolia = async () => {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('Wallet not detected');
  }
  const chainId = toHex(ACTIVE_CHAIN.id);
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
  } catch (err) {
    const error = err as { code?: number };
    if (error?.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId,
            chainName: ACTIVE_CHAIN.name,
            rpcUrls: [RPC_URL],
            nativeCurrency: ACTIVE_CHAIN.nativeCurrency,
            blockExplorerUrls: [DEFAULT_EXPLORER_URL],
          },
        ],
      });
      return;
    }
    throw err;
  }
};

export const read = (params: unknown): Promise<any> => {
  const client = getPublicClient();
  return client.readContract(params as any) as Promise<any>;
};

export const write = async (params: unknown): Promise<any> => {
  const wallet = getWalletClient();
  if (!wallet) {
    throw new Error('Wallet not detected');
  }
  return wallet.writeContract(params as any) as Promise<any>;
};
