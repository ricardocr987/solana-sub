import { decodeMint } from '@solana-program/token';
import { rpc } from './rpc';
import type { EncodedAccount } from '@solana/accounts';
import { ReadonlyUint8Array, address, Lamports } from '@solana/kit';

export type DecodedMint = {
    mintAuthorityOption: number;
    mintAuthority: string;
    supply: string;
    decimals: number;
    isInitialized: boolean;
    freezeAuthorityOption: number;
    freezeAuthority: string;
};

export type MintInfo = {
    address: string;
    executable: boolean;
    lamports: Lamports;
    programAddress: string;
    data: DecodedMint;
};

export async function getMintInfo(mint: string): Promise<MintInfo | null> {
    try {
      const mintAddress = address(mint);
      const { value: mintResponse } = await rpc
        .getAccountInfo(mintAddress, { encoding: 'base64' })
        .send();
  
      if (!mintResponse?.data) {
        console.warn('No data for mint');
        return null;
      }
  
      const [base64Data] = mintResponse.data;
      if (!base64Data) {
        console.warn('Invalid base64 data for mint');
        return null;
      }
  
      const rawData = Buffer.from(base64Data, 'base64');
      const encodedAccount: EncodedAccount<string> = {
        address: mintAddress,
        data: new Uint8Array(rawData) as ReadonlyUint8Array,
        executable: mintResponse.executable,
        lamports: mintResponse.lamports,
        programAddress: mintResponse.owner,
        space: 0n,
      };
  
      const decodedMintData = decodeMint(encodedAccount);
  
      return {
        address: mintAddress.toString(),
        executable: mintResponse.executable,
        lamports: mintResponse.lamports,
        programAddress: mintResponse.owner,
        data: {
          mintAuthorityOption: decodedMintData.data.mintAuthority ? 1 : 0,
          mintAuthority: decodedMintData.data.mintAuthority?.toString() || '',
          supply: decodedMintData.data.supply.toString(),
          decimals: decodedMintData.data.decimals,
          isInitialized: decodedMintData.data.isInitialized,
          freezeAuthorityOption: decodedMintData.data.freezeAuthority ? 1 : 0,
          freezeAuthority: decodedMintData.data.freezeAuthority?.toString() || '',
        },
      };
    } catch (error) {
      console.error('Error in getMint:', error);
      return null;
    }
  }
  