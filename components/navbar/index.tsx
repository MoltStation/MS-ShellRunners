import Image from 'next/image';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../mobx';

const Navbar = () => {
  const router = useRouter();
  const state = useStore();
  const address = state.accountAddress ?? '';
  const shortAddress =
    address && address.length > 10
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : address;

  const isActive = (href: string) => router.pathname === href;

  return (
    <nav className='sticky top-0 z-50'>
      <div className='arena-container flex flex-wrap items-center justify-between gap-6 py-4 font-primary'>
        <div className='flex items-center gap-3'>
          <button
            className='flex items-center gap-3'
            onClick={() => router.push('/')}>
            <Image
              className='rounded-full border arena-border-soft'
              src='/assets/logo.png'
              alt='Logo'
              height={48}
              width={48}
            />
            <div className='text-left'>
              <div className='text-sm uppercase tracking-[0.28em] arena-text-muted'>
                MoltStation
              </div>
              <div className='text-lg font-semibold text-whiteish'>Core</div>
            </div>
          </button>
        </div>

        <div className='flex flex-wrap items-center gap-4'>
          <Link
            className={`arena-menu-link whitespace-nowrap ${
              isActive('/') ? 'arena-menu-link--highlight' : ''
            }`}
            href='/'>
            ShellRunners
          </Link>
          <Link
            className={`arena-menu-link whitespace-nowrap ${
              isActive('/market') ? 'arena-menu-link--highlight' : ''
            }`}
            href='/market'>
            Market
          </Link>
          <Link
            className={`arena-menu-link whitespace-nowrap ${
              isActive('/profile') ? 'arena-menu-link--highlight' : ''
            }`}
            href='/profile'>
            Profile
          </Link>
        </div>

        <div className='ml-auto flex items-center justify-end'>
          {!state.walletConnected ? (
            <button
              className='arena-menu-link whitespace-nowrap'
              onClick={() => state.connectToWallet()}>
              Connect & Sign
            </button>
          ) : (
            <div className='arena-has-tooltip'>
              <button
                className='arena-menu-link whitespace-nowrap'
                onClick={() => state.disconnectWallet()}>
                Disconnect
              </button>
              <div className='arena-tooltip'>{shortAddress || 'Wallet'}</div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default observer(Navbar);
