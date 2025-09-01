import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Button } from './ui/button';
import { Wallet, ChevronRight } from 'lucide-react';
import type { UiWallet, UiWalletAccount } from '@wallet-standard/react';
import { uiWalletAccountsAreSame, useConnect, useDisconnect } from '@wallet-standard/react';
import { useCallback, useMemo } from 'react';
import { useWallet } from '../context/WalletContext';

export function ConnectWallet() {
    const { wallets, connectedWallet, selectedAccount, setConnectedWallet, setSelectedAccount } = useWallet();
    
    // Deduplicate wallets by name and version
    const uniqueWallets = useMemo(() => {
        const walletMap = new Map<string, UiWallet>();
        wallets.forEach((wallet) => {
            const key = `${wallet.name}-${wallet.version}`;
            if (!walletMap.has(key)) {
                walletMap.set(key, wallet);
            }
        });
        return Array.from(walletMap.values());
    }, [wallets]);

    const handleAccountSelect = useCallback((account: UiWalletAccount | undefined, wallet: UiWallet) => {
        if (account) {
            setConnectedWallet(wallet);
            setSelectedAccount(account);
            localStorage.setItem('solana-wallet', wallet.name);
            localStorage.setItem('solana-account', account.address);
        } else {
            setConnectedWallet(null);
            setSelectedAccount(null);
            localStorage.removeItem('solana-wallet');
            localStorage.removeItem('solana-account');
        }
    }, [setConnectedWallet, setSelectedAccount]);

    const handleDisconnect = useCallback((wallet: UiWallet) => {
        setConnectedWallet(null);
        setSelectedAccount(null);
        localStorage.removeItem('solana-wallet');
        localStorage.removeItem('solana-account');
    }, [setConnectedWallet, setSelectedAccount]);

    const handleError = useCallback((err: unknown) => {
        console.error('Wallet error:', err);
    }, []);

    if (uniqueWallets.length === 0) {
        return (
            <Button disabled variant="outline" size="sm" className="h-9 px-3">
                No Wallets
            </Button>
        );
    }

    if (connectedWallet && selectedAccount) {
        return (
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-white font-mono">
                        {selectedAccount.address.slice(0, 4)}...{selectedAccount.address.slice(-4)}
                    </span>
                </div>
                <Button
                    onClick={() => handleDisconnect(connectedWallet)}
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 text-red-400 border-red-400 hover:bg-red-400 hover:text-white"
                >
                    Disconnect
                </Button>
            </div>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button className="h-9 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72 bg-gray-800 border-gray-700">
                <div className="p-2">
                    <h3 className="text-white font-medium mb-3 px-2">Select Wallet</h3>
                    {uniqueWallets.map((wallet) => (
                        <ConnectWalletMenuItem
                            key={`${wallet.name}-${wallet.version}`}
                            wallet={wallet}
                            onAccountSelect={(account) => handleAccountSelect(account, wallet)}
                            onDisconnect={handleDisconnect}
                            onError={handleError}
                        />
                    ))}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

type ConnectWalletMenuItemProps = Readonly<{
    onAccountSelect(account: UiWalletAccount | undefined, wallet: UiWallet): void;
    onDisconnect(wallet: UiWallet): void;
    onError(err: unknown): void;
    wallet: UiWallet;
}>;

function ConnectWalletMenuItem({ onAccountSelect, onDisconnect, onError, wallet }: ConnectWalletMenuItemProps) {
    const [isConnecting, connect] = useConnect(wallet);
    const [isDisconnecting, disconnect] = useDisconnect(wallet);
    const isPending = isConnecting || isDisconnecting;
    const isConnected = wallet.accounts.length > 0;
    const hasMultipleAccounts = wallet.accounts.length > 1;
    const { selectedAccount } = useWallet();

    const handleConnectClick = useCallback(async () => {
        try {
            const existingAccounts = [...wallet.accounts];
            const nextAccounts = await connect();
            // Try to choose the first never-before-seen account.
            for (const nextAccount of nextAccounts) {
                if (!existingAccounts.some(existingAccount => uiWalletAccountsAreSame(nextAccount, existingAccount))) {
                    onAccountSelect(nextAccount, wallet);
                    return;
                }
            }
            // Failing that, choose the first account in the list.
            if (nextAccounts[0]) {
                onAccountSelect(nextAccounts[0], wallet);
            }
        } catch (e) {
            onError(e);
        }
    }, [connect, onAccountSelect, onError, wallet.accounts, wallet]);

    // When not connected, show a simple menu item that connects directly
    if (!isConnected) {
        return (
            <DropdownMenuItem
                disabled={isPending}
                onClick={handleConnectClick}
                className="flex items-center gap-3 p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white cursor-pointer"
            >
                {wallet.icon && (
                    <img src={wallet.icon} alt={wallet.name} className="w-5 h-5" />
                )}
                <span className="text-white text-sm">{wallet.name}</span>
            </DropdownMenuItem>
        );
    }

    // When connected but only has 0 or 1 account, show simple item without submenu
    if (!hasMultipleAccounts) {
        return (
            <DropdownMenuItem
                disabled={isPending}
                className="flex items-center gap-3 p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white cursor-pointer"
            >
                {wallet.icon && (
                    <img src={wallet.icon} alt={wallet.name} className="w-5 h-5" />
                )}
                <span className="text-white text-sm">{wallet.name}</span>
                <div className="ml-auto">
                    <Button
                        onClick={async () => {
                            try {
                                await disconnect();
                                onDisconnect(wallet);
                            } catch (e) {
                                onError(e);
                            }
                        }}
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs text-red-400 border-red-400 hover:bg-red-400 hover:text-white"
                    >
                        Disconnect
                    </Button>
                </div>
            </DropdownMenuItem>
        );
    }

    // When connected and has multiple accounts, show the submenu for account selection and management
    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger
                disabled={isPending}
                className="flex items-center justify-between w-full p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white"
            >
                <div className="flex items-center gap-3">
                    {wallet.icon && (
                        <img src={wallet.icon} alt={wallet.name} className="w-5 h-5" />
                    )}
                    <span className="text-white text-sm">{wallet.name}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-gray-800 border-gray-700">
                <DropdownMenuLabel className="text-gray-300">Accounts</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={selectedAccount?.address}>
                    {wallet.accounts.map(account => (
                        <DropdownMenuRadioItem
                            key={account.address}
                            value={account.address}
                            onSelect={() => {
                                onAccountSelect(account, wallet);
                            }}
                            className="text-gray-300 hover:bg-gray-700 focus:bg-gray-700"
                        >
                            {account.address.slice(0, 8)}...
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator className="bg-gray-600" />
                <DropdownMenuItem
                    onSelect={async (e: Event) => {
                        e.preventDefault();
                        await handleConnectClick();
                    }}
                    className="text-gray-300 hover:bg-gray-700 focus:bg-gray-700"
                >
                    Connect More
                </DropdownMenuItem>
                <DropdownMenuItem
                    onSelect={async (e: Event) => {
                        e.preventDefault();
                        try {
                            await disconnect();
                            onDisconnect(wallet);
                        } catch (e) {
                            onError(e);
                        }
                    }}
                    className="text-red-400 hover:bg-gray-700 focus:bg-gray-700"
                >
                    Disconnect
                </DropdownMenuItem>
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    );
}
