import type { FC, ReactNode } from 'react';
import { ChainContextProvider } from './ChainContextProvider';
import { RpcContextProvider } from './RpcContextProvider';
import { WalletProvider } from './WalletContext';

export const SolanaProvider: FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <ChainContextProvider>
            <WalletProvider>
                <RpcContextProvider>
                    {children}
                </RpcContextProvider>
            </WalletProvider>
        </ChainContextProvider>
    );
};
