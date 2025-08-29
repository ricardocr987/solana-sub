import { useState } from 'react';
import { Button } from '../ui/button';
import { useWallet } from '../../context/WalletContext';
import type { UiWallet, UiWalletAccount } from '@wallet-standard/react';
import { Wallet, LogOut, ChevronDown } from 'lucide-react';

export function WalletConnection() {
  const { wallets, connectedWallet, selectedAccount, isConnected, connect, disconnect } = useWallet();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async (wallet: UiWallet) => {
    setIsConnecting(true);
    try {
      await connect(wallet);
    } catch (error) {
      console.error('Failed to connect:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  if (isConnected && selectedAccount) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">
          {selectedAccount.address.slice(0, 8)}...{selectedAccount.address.slice(-8)}
        </span>
        <Button onClick={handleDisconnect} variant="outline" size="sm">
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Button
        onClick={() => setIsConnecting(!isConnecting)}
        disabled={isConnecting}
        className="flex items-center gap-2"
      >
        <Wallet className="w-4 h-4" />
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        <ChevronDown className={cn(
          "w-4 h-4 transition-transform",
          isConnecting && "rotate-180"
        )} />
      </Button>
      
      {isConnecting && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50">
          <div className="p-4">
            <h3 className="text-sm font-medium text-white mb-3">
              Select Wallet
            </h3>
            <div className="space-y-2">
              {wallets.map((wallet) => (
                <button
                  key={wallet.name}
                  onClick={() => handleConnect(wallet)}
                  className="w-full flex items-center gap-3 p-3 text-left rounded-lg hover:bg-gray-700 transition-colors"
                >
                  {wallet.icon && (
                    <img
                      src={wallet.icon}
                      alt={wallet.name}
                      className="w-8 h-8 rounded"
                    />
                  )}
                  <div>
                    <div className="font-medium text-white">
                      {wallet.name}
                    </div>
                    <div className="text-sm text-gray-400">
                      {wallet.version}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {wallets.length === 0 && (
              <div className="text-center py-4 text-gray-400">
                No wallets found. Please install a Solana wallet extension like Phantom or Solflare.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
