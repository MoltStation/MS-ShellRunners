import { toast } from 'react-hot-toast';

export const NET_ID = 84532;

export const RPC_URL =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  'https://sepolia.base.org';

export enum Order {
  PRICE_ASC,
  PRICE_DSC,
  LATEST,
  OLDEST,
}

type NotifyType = 'danger' | 'success' | 'info' | 'warning';

export function notify(type: NotifyType, data: string) {
  switch (type) {
    case 'danger':
      toast.error(data);
      break;
    case 'success':
      toast.success(data);
      break;
    case 'warning':
    case 'info':
    default:
      toast(data);
  }
}

const DEFAULT_IPFS_GATEWAYS = [
  process.env.NEXT_PUBLIC_IPFS_GATEWAY,
  // Pinata public gateway is typically reliable and avoids DNS issues some users see with Cloudflare.
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
]
  .filter(Boolean)
  .map((v) => String(v).replace(/\/+$/, '') + '/');

export function ipfsToHttp(url: string) {
  if (!url) return url;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('ipfs://')) {
    const path = url.slice('ipfs://'.length).replace(/^\/+/, '');
    return DEFAULT_IPFS_GATEWAYS[0] + path;
  }
  return url;
}

function ipfsCandidates(url: string) {
  if (!url) return [];
  if (url.startsWith('data:')) return [url];

  if (url.startsWith('ipfs://')) {
    const path = url.slice('ipfs://'.length).replace(/^\/+/, '');
    return DEFAULT_IPFS_GATEWAYS.map((gw) => gw + path);
  }

  // If the URL already points to an IPFS gateway, try re-hydrating the CID on alternate gateways.
  const m = url.match(/\/ipfs\/([^/?#]+)(.*)$/i);
  if (m) {
    const cid = m[1];
    const rest = (m[2] ?? '').replace(/^\/+/, '');
    const path = rest ? `${cid}/${rest}` : cid;
    return DEFAULT_IPFS_GATEWAYS.map((gw) => gw + path);
  }

  return [url];
}

async function fetchJsonWithFallback(url: string, timeoutMs = 12000) {
  const candidates = ipfsCandidates(url);
  let lastErr: unknown = null;

  for (const candidate of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(candidate, { signal: controller.signal });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      return await resp.json();
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Throw the last error so callers can decide whether to fallback to a placeholder.
  throw lastErr instanceof Error ? lastErr : new Error('IPFS fetch failed');
}

export async function fetchIpfs(url: string) {
  if (url.startsWith('data:')) {
    // Supports testnet fallbacks where tokenURI is an inline data: JSON.
    // Formats seen: data:application/json;base64,... or data:application/json,...
    const commaIdx = url.indexOf(',');
    if (commaIdx === -1) {
      throw new Error('Invalid data: URI');
    }
    const header = url.slice(0, commaIdx);
    const payload = url.slice(commaIdx + 1);
    const isBase64 = /;base64/i.test(header);
    const decodeBase64Utf8 = (value: string) => {
      // Browser-first decode to avoid relying on Node polyfills in Next.
      const atobFn = (globalThis as any).atob as ((v: string) => string) | undefined;
      if (typeof atobFn === 'function') {
        const bin = atobFn(value);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder('utf-8').decode(bytes);
      }
      // Node fallback (e.g. SSR).
      const BufferCtor = (globalThis as any).Buffer as
        | { from: (v: string, enc: string) => { toString: (enc: string) => string } }
        | undefined;
      if (BufferCtor?.from) {
        return BufferCtor.from(value, 'base64').toString('utf8');
      }
      throw new Error('No base64 decoder available');
    };

    const json = isBase64 ? decodeBase64Utf8(payload) : decodeURIComponent(payload);
    const metadata = JSON.parse(json) as IMetadata;
    if (metadata.image) {
      metadata.image = ipfsToHttp(metadata.image);
    }
    return metadata;
  }

  const metadata = (await fetchJsonWithFallback(url)) as IMetadata;
  if (metadata?.image) {
    metadata.image = ipfsToHttp(metadata.image);
  }
  return metadata;
}

export function sortNfts(globalNfts: IMarketNft[], sortOrder: Order) {
  switch (sortOrder) {
    case Order.PRICE_ASC:
      return globalNfts.sort((a, b) => a.price - b.price);
    case Order.PRICE_DSC:
      return globalNfts.sort((a, b) => b.price - a.price);
    case Order.OLDEST:
      return globalNfts.sort((a, b) => b.tokenId - a.tokenId);
    default:
      return globalNfts.sort((a, b) => a.tokenId - b.tokenId);
  }
}

export const dummyShellRunner1 = {
  tokenId: -1,
  tokenUri:
    'ipfs://bafyreicjwky6t2dcdqpj6r6lx2tl2rgdo5riazknoq4yzgyvkrhyuxyqfm/metadata.json',
  metadata: {
    name: 'Starter Shell Runner',
    description: 'A Shell Runner that is on a journey in the river',
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
      {
        trait_type: 'speed',
        value: 10,
      },
      {
        trait_type: 'breed',
        value: 1,
      },
    ],
    image: '/assets/img/shellrunner.png',
  },
};
export const dummyShellRunner2 = {
  tokenId: 2,
  tokenUri:
    'ipfs://bafyreicjwky6t2dcdqpj6r6lx2tl2rgdo5riazknoq4yzgyvkrhyuxyqfm/metadata.json',
  metadata: {
    name: 'Floppy Shell Runner 2',
    description: 'A Shell Runner that is on a journey in the river',
    componentIndices: {
      eyes: '2',
      hands: '2',
      head: '2',
      legs: '3',
      shell: '4',
      shellOuter: '4',
      tail: '5',
    },
    attributes: [
      {
        trait_type: 'speed',
        value: 10,
      },
      {
        trait_type: 'breed',
        value: 6,
      },
    ],
    image: '/assets/img/shellrunner.png',
  },
};
