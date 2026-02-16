import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useMemo } from 'react';

import EmbeddedPhaserPlay from './EmbeddedPhaserPlay';

const LegacyGame = dynamic(() => import('../game'), { ssr: false });

export default function ShellRunnersRuntimeEntry() {
  const router = useRouter();

  const sessionId = useMemo(() => {
    const raw = router.query?.sessionId;
    return String(Array.isArray(raw) ? raw[0] : raw || '').trim();
  }, [router.query?.sessionId]);

  const isEmbedded = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.top !== window.self;
  }, []);

  // Embedded play uses WS + token (postMessage) and does NOT require wallet access inside the iframe.
  // Standalone runtime keeps the legacy Phaser client (wallet + on-chain snapshot/minting).
  if (isEmbedded && sessionId) {
    return <EmbeddedPhaserPlay />;
  }

  return <LegacyGame />;
}
