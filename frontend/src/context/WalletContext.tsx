import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { type UiWallet, type UiWalletAccount, useWallets, useConnect, useDisconnect } from '@wallet-standard/react';
import { StandardConnect, StandardDisconnect } from '@wallet-standard/core';

interface WalletContextType {
  wallets: UiWallet[];
  connectedWallet: UiWallet | null;
  selectedAccount: UiWalletAccount | null;
  isConnected: boolean;
  connect: (wallet: UiWallet) => Promise<void>;
  disconnect: () => Promise<void>;
  selectAccount: (account: UiWalletAccount | null) => void;
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

  // Get connectable wallets
  const connectableWallets = useMemo(() => {
    return wallets.filter(wallet => 
      wallet.features.includes(StandardConnect) && 
      wallet.features.includes(StandardDisconnect)
    );
  }, [wallets]);

  // Check if wallet is connected
  const isConnected = useMemo(() => {
    return connectedWallet !== null && selectedAccount !== null;
  }, [connectedWallet, selectedAccount]);

  // Connect to a wallet
  const connect = async (wallet: UiWallet) => {
    try {
      const [_, connectFn] = useConnect(wallet);
      const accounts = await connectFn();
      
      if (accounts.length > 0) {
        setConnectedWallet(wallet);
        setSelectedAccount(accounts[0] ?? null);
        
        // Save to localStorage
        localStorage.setItem('solana-wallet', wallet.name);
        localStorage.setItem('solana-account', accounts[0]?.address ?? '');
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  };

  // Disconnect wallet
  const disconnect = async () => {
    if (connectedWallet) {
      try {
        const [_, disconnectFn] = useDisconnect(connectedWallet);
        await disconnectFn();
      } catch (error) {
        console.error('Failed to disconnect wallet:', error);
      }
    }
    
    setConnectedWallet(null);
    setSelectedAccount(null);
    
    // Clear localStorage
    localStorage.removeItem('solana-wallet');
    localStorage.removeItem('solana-account');
  };

  // Select account
  const selectAccount = (account: UiWalletAccount | null) => {
    setSelectedAccount(account);
    if (account) {
      localStorage.setItem('solana-account', account.address);
    } else {
      localStorage.removeItem('solana-account');
    }
  };

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
    connect,
    disconnect,
    selectAccount,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}
