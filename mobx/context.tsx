import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect } from 'react';
import { GlobalStore } from './store';

const StoreContext = createContext<GlobalStore>({} as GlobalStore);
const globalStore = new GlobalStore();

export const StoreProvider = ({ children }: PropsWithChildren) => {
  useEffect(() => {
    globalStore.autoConnectWallet();
  }, []);

  return (
    <StoreContext.Provider value={globalStore}>{children}</StoreContext.Provider>
  );
};

export const useStore = () => useContext(StoreContext);
