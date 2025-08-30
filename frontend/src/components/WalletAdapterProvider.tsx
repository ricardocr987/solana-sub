import { useEffect } from 'react';
import { registerWallet } from '@wallet-standard/core';

interface WalletAdapterProviderProps {
  children: React.ReactNode;
}

export function WalletAdapterProvider({ children }: WalletAdapterProviderProps) {
  useEffect(() => {
    // For now, we'll let the wallet standard handle wallet registration automatically
    // The wallet adapters will be registered when they're imported
    console.log('WalletAdapterProvider mounted');
  }, []);

  return <>{children}</>;
}
