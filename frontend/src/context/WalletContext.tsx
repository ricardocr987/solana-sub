import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useWallets } from '@wallet-standard/react';
import type { UiWallet, UiWalletAccount } from '@wallet-standard/react';

interface WalletContextType {
  wallets: UiWallet[];
  connectedWallet: UiWallet | null;
  selectedAccount: UiWalletAccount | null;
  isConnected: boolean;
  setConnectedWallet: (wallet: UiWallet | null) => void;
  setSelectedAccount: (account: UiWalletAccount | null) => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const wallets = useWallets();
  const [connectedWallet, setConnectedWallet] = useState<UiWallet | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<UiWalletAccount | null>(null);

  // Get connectable wallets (just filter for basic compatibility)
  const connectableWallets = useMemo(() => {
    return Array.from(wallets); // Convert readonly to mutable array
  }, [wallets]);

  // Check if wallet is connected
  const isConnected = useMemo(() => {
    return connectedWallet !== null && selectedAccount !== null;
  }, [connectedWallet, selectedAccount]);

  // Restore wallet connection on mount
  useEffect(() => {
    const savedWalletName = localStorage.getItem('solana-wallet');
    const savedAccountAddress = localStorage.getItem('solana-account');
    
    if (savedWalletName && savedAccountAddress) {
      const wallet = wallets.find(w => w.name === savedWalletName);
      if (wallet) {
        const account = wallet.accounts.find(a => a.address === savedAccountAddress);
        if (account) {
          setConnectedWallet(wallet);
          setSelectedAccount(account);
        }
      }
    }
  }, [wallets]);

  const contextValue: WalletContextType = {
    wallets: connectableWallets,
    connectedWallet,
    selectedAccount,
    isConnected,
    setConnectedWallet,
    setSelectedAccount,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}
