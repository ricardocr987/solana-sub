import { useMemo, useState } from 'react';

import { ChainContext, DEFAULT_CHAIN_CONFIG } from './ChainContext';

const STORAGE_KEY = 'solana-example-react-app:selected-chain';

export function ChainContextProvider({ children }: { children: React.ReactNode }) {
    const [chain, setChain] = useState(() => localStorage.getItem(STORAGE_KEY) ?? 'solana:devnet');
    const contextValue = useMemo<ChainContext>(() => {
        switch (chain) {
            case 'solana:mainnet':
                return {
                    chain: 'solana:mainnet',
                    displayName: 'Mainnet Beta',
                    solanaExplorerClusterName: 'mainnet-beta',
                    solanaRpcSubscriptionsUrl: 'wss://api.mainnet-beta.solana.com',
                    solanaRpcUrl: 'https://api.mainnet-beta.solana.com',
                };
            // falls through
            case 'solana:testnet':
                return {
                    chain: 'solana:testnet',
                    displayName: 'Testnet',
                    solanaExplorerClusterName: 'testnet',
                    solanaRpcSubscriptionsUrl: 'wss://api.testnet.solana.com',
                    solanaRpcUrl: 'https://api.testnet.solana.com',
                };
            case 'solana:devnet':
            default:
                if (chain !== 'solana:devnet') {
                    localStorage.removeItem(STORAGE_KEY);
                    console.error(`Unrecognized chain \`${chain}\``);
                }
                return DEFAULT_CHAIN_CONFIG;
        }
    }, [chain]);
    return (
        <ChainContext.Provider
            value={useMemo(
                () => ({
                    ...contextValue,
                    setChain(chain) {
                        localStorage.setItem(STORAGE_KEY, chain);
                        setChain(chain);
                    },
                }),
                [contextValue],
            )}
        >
            {children}
        </ChainContext.Provider>
    );
}
