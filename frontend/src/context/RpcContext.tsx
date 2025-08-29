import type { Rpc, RpcSubscriptions, SolanaRpcApi, SolanaRpcSubscriptionsApi } from '@solana/kit';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
import { createContext } from 'react';

export const RpcContext = createContext<{
    rpc: Rpc<SolanaRpcApi>; // Limit the API to only those methods found on Mainnet (ie. not `requestAirdrop`)
    rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
}>({
    rpc: createSolanaRpc('https://api.mainnet-beta.solana.com'),
    rpcSubscriptions: createSolanaRpcSubscriptions('wss://api.mainnet-beta.solana.com'),
});
