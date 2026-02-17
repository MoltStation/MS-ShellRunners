import type { AppProps } from 'next/app';
import { StoreProvider } from '../mobx';
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/react';
// import '@fortawesome/fontawesome-svg-core/styles.css'; // import Font Awesome CSS
import '../styles/global.css';
import '../styles/shellrunners.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <StoreProvider>
      <Toaster position='top-right' />
      <div className='arena-shell'>
        <Component {...pageProps} />
      </div>
      <Analytics />
    </StoreProvider>
  );
}

export default MyApp;
