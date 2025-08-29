import { createContext } from 'react';

export type ChainContext = Readonly<{
    chain: `solana:${string}`;
    displayName: string;
    setChain?(chain: `solana:${string}`): void;
    solanaExplorerClusterName: 'devnet' | 'mainnet-beta' | 'testnet';
    solanaRpcSubscriptionsUrl: string;
    solanaRpcUrl: string;
}>;

export const DEFAULT_CHAIN_CONFIG = Object.freeze({
    chain: 'solana:mainnet-beta',
    displayName: 'Mainnet',
    solanaExplorerClusterName: 'mainnet-beta',
    solanaRpcSubscriptionsUrl: 'wss://api.mainnet-beta.solana.com',
    solanaRpcUrl: 'https://api.mainnet-beta.solana.com',
});

export const ChainContext = createContext<ChainContext>(DEFAULT_CHAIN_CONFIG);
