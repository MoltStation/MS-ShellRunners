import type { AppProps } from 'next/app';
import { StoreProvider } from '../mobx';
import { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/router';
// import '@fortawesome/fontawesome-svg-core/styles.css'; // import Font Awesome CSS
import '../styles/global.css';
import '../styles/shellrunners.css';
import Navbar from '../components/navbar';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const hideNav = router.pathname === '/game';
  return (
    <StoreProvider>
      <Toaster position='top-right' />
      <div className='arena-shell min-h-screen'>
        {!hideNav && <Navbar />}
        <Component {...pageProps} />
      </div>
    </StoreProvider>
  );
}

export default MyApp;
