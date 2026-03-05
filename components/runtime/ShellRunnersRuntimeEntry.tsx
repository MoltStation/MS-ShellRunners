import { useRouter } from 'next/router';
import { useMemo } from 'react';

import EmbeddedPhaserPlay from './EmbeddedPhaserPlay';

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
  // Standalone runtime should not open the legacy wallet UX on the game subdomain.
  if (isEmbedded && sessionId) {
    return <EmbeddedPhaserPlay />;
  }

  const coreBase = String(
    process.env.NEXT_PUBLIC_CORE_LANDING_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '')
  ).trim();
  const coreGameUrl = `${coreBase.replace(/\/+$/, '')}/games/shellrunners`;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#05060a',
        color: '#d7f7ff',
        fontFamily: 'monospace',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}>
      <section
        style={{
          width: '100%',
          maxWidth: 760,
          border: '1px solid rgba(215,247,255,0.2)',
          borderRadius: 16,
          background: 'rgba(10,12,18,0.65)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 12px 30px rgba(0,0,0,0.55)',
          padding: 24,
        }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>ShellRunners Runtime</h1>
        <p style={{ margin: '12px 0 0', opacity: 0.9 }}>
          This runtime is intended to be launched from MoltStation Core with a secure play token.
        </p>
        <a
          href={coreGameUrl}
          style={{
            marginTop: 18,
            display: 'inline-block',
            borderRadius: 10,
            padding: '10px 14px',
            border: '1px solid rgba(215,247,255,0.24)',
            color: '#d7f7ff',
            textDecoration: 'none',
            background: 'rgba(5,6,10,0.35)',
          }}>
          Open ShellRunners in Core
        </a>
      </section>
    </main>
  );
}
