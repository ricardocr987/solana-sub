import { Connection, PublicKey } from '@solana/web3.js';
import { config } from '../config';

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
  lamports: number;
  programAddress: string;
  data: DecodedMint;
};

export async function getMintInfo(mint: string): Promise<MintInfo | null> {
  try {
    const connection = config.QUICKNODE_RPC;
    const mintAddress = new PublicKey(mint);

    // Get mint account info
    const mintResponse = await connection.getAccountInfo(mintAddress);
    
    if (!mintResponse?.data) {
      console.warn('No data for mint');
      return null;
    }

    // Parse mint data manually (basic structure)
    // This is a simplified version - in production you might want to use a proper parser
    const data = mintResponse.data;
    
    // Basic validation - mint accounts are typically 82 bytes
    if (data.length < 82) {
      console.warn('Invalid mint data length');
      return null;
    }

    // Extract basic information
    // Note: This is a simplified parser. For production use, consider using a proper SPL token library
    const isInitialized = data[0] === 1;
    const decimals = data[44];
    
    // Extract supply (8 bytes starting at position 36)
    const supplyBytes = data.slice(36, 44);
    const supply = Buffer.from(supplyBytes).readBigUInt64LE(0).toString();
    
    // Extract mint authority (32 bytes starting at position 4)
    const mintAuthorityBytes = data.slice(4, 36);
    const mintAuthority = new PublicKey(mintAuthorityBytes).toBase58();
    
    // Extract freeze authority (32 bytes starting at position 45)
    const freezeAuthorityBytes = data.slice(45, 77);
    const freezeAuthority = new PublicKey(freezeAuthorityBytes).toBase58();

    return {
      address: mintAddress.toString(),
      executable: mintResponse.executable,
      lamports: mintResponse.lamports,
      programAddress: mintResponse.owner.toString(),
      data: {
        mintAuthorityOption: isInitialized ? 1 : 0,
        mintAuthority: isInitialized ? mintAuthority : '',
        supply,
        decimals,
        isInitialized,
        freezeAuthorityOption: isInitialized ? 1 : 0,
        freezeAuthority: isInitialized ? freezeAuthority : '',
      },
    };
  } catch (error) {
    console.error('Error in getMint:', error);
    return null;
  }
}
