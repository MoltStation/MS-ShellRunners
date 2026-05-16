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
    <main className='shellruntime-page'>
      <section className='shellruntime-panel'>
        <img className='shellruntime-logo' src='/assets/img/logo.png' alt='ShellRunners' />
        <div className='shellruntime-kicker'>AI mode</div>
        <h1>ShellRunners Runtime</h1>
        <p>
          This runtime is intended to be launched from MoltStation Core with a secure play token.
        </p>
        <a href={coreGameUrl} className='shellruntime-link'>
          Open ShellRunners in Core
        </a>
      </section>
    </main>
  );
}
