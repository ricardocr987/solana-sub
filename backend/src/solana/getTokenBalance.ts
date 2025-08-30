
import { address } from '@solana/kit';
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { config } from '../config';
import { rpc } from './rpc';

// SOL mint address (native SOL)
const SOL_MINT = 'So11111111111111111111111111111111111111112';

export type AssetBalance = {
  mint: string;
  balance: string;
  decimals: number;
  name?: string;
  symbol?: string;
  logoURI?: string;
  interface: string;
  tokenStandard?: string;
};

export type OwnerAssets = {
  total: number;
  items: AssetBalance[];
  cursor?: string;
};

/**
 * Fetches all assets owned by a specific address using Metaplex DAS getAssetsByOwner
 * @param ownerAddress - The address of the owner
 * @param options - Optional parameters for the query
 * @returns Owner assets information or null if failed
 */
export async function getAssetsByOwner(
  ownerAddress: string,
  options: {
    showFungible?: boolean;
    showCollectionMetadata?: boolean;
    limit?: number;
    cursor?: string;
  } = {}
): Promise<OwnerAssets | null> {
  try {
    // Validate the address format
    try {
      address(ownerAddress);
    } catch {
      console.warn(`Invalid Solana address: ${ownerAddress}`);
      return null;
    }

    console.log(`Fetching assets for owner: ${ownerAddress}`);

    const response = await fetch(config.QUICKNODE_RPC_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAssetsByOwner',
        params: {
          ownerAddress,
          options: {
            showFungible: options.showFungible ?? true,
            showCollectionMetadata: options.showCollectionMetadata ?? false,
            limit: options.limit ?? 1000,
            ...(options.cursor && { cursor: options.cursor })
          }
        }
      })
    });

    if (!response.ok) {
      console.warn(`getAssetsByOwner RPC error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.error) {
      console.warn(`getAssetsByOwner RPC error: ${data.error.message}`);
      return null;
    }

    if (!data.result) {
      console.warn(`No result from getAssetsByOwner for ${ownerAddress}`);
      return null;
    }

    const result = data.result;
    console.log(`Found ${result.total} assets for owner ${ownerAddress}`);

    // Process assets to extract balance information
    const items: AssetBalance[] = result.items.map((item: any) => {
      const asset = item.asset;
      
      // Extract basic asset information
      const assetBalance: AssetBalance = {
        mint: asset.id,
        balance: '1', // Default for NFTs
        decimals: 0, // Default for NFTs
        name: asset.metadata?.name,
        symbol: asset.metadata?.symbol,
        logoURI: asset.content?.files?.[0]?.uri || asset.content?.links?.image,
        interface: asset.interface,
        tokenStandard: asset.metadata?.token_standard
      };

      // Handle fungible tokens
      if (asset.token_info && asset.interface === 'FungibleToken') {
        assetBalance.decimals = asset.token_info.decimals || 0;
        // For fungible tokens, we need to get the actual balance from token accounts
        // This would require additional RPC calls to get token account balances
        assetBalance.balance = '0'; // Placeholder - would need getTokenAccountsByOwner
      }

      return assetBalance;
    });

    return {
      total: result.total,
      items,
      cursor: result.cursor || undefined
    };
  } catch (error) {
    console.error(`Failed to fetch assets for owner ${ownerAddress}:`, error);
    return null;
  }
}

/**
 * Gets the balance of a specific token for a user using Metaplex DAS
 * @param userKey - The user's wallet address
 * @param tokenMint - The token mint address
 * @returns Token balance information or null if failed
 */
export async function getTokenBalance(
  userKey: string,
  tokenMint: string
): Promise<{
  balance: string;
  decimals: number;
  uiAmount: number;
  mint: string;
} | null> {
  try {
    // Validate addresses
    try {
      address(userKey);
      address(tokenMint);
    } catch {
      console.warn(`Invalid address format: userKey=${userKey}, tokenMint=${tokenMint}`);
      return null;
    }

    // Handle SOL token
    if (tokenMint === SOL_MINT) {
      const solBalance = await getSolBalance(userKey);
      if (solBalance === null) return null;
      
      return {
        balance: solBalance,
        decimals: 9, // SOL has 9 decimals (lamports)
        uiAmount: parseFloat(solBalance),
        mint: tokenMint
      };
    }

    // For SPL tokens, get comprehensive balance information
    const splBalance = await getSplTokenBalance(userKey, tokenMint);
    if (splBalance === null) return null;
    
    return {
      ...splBalance,
      mint: tokenMint
    };
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return null;
  }
}

/**
 * Gets the balance of a specific token for a user (legacy function for backward compatibility)
 * @param userKey - The user's wallet address
 * @param tokenMint - The token mint address
 * @returns Token balance as string or null if failed
 */
export async function getTokenBalanceString(
  userKey: string,
  tokenMint: string
): Promise<string | null> {
  const result = await getTokenBalance(userKey, tokenMint);
  return result ? result.balance : null;
}

/**
 * Gets the SOL balance for a user
 * @param userKey - The user's wallet address
 * @returns SOL balance as string or null if failed
 */
async function getSolBalance(userKey: string): Promise<string | null> {
  try {
    const userPublicKey = address(userKey);
    
    // Use Solana Kit RPC to get SOL balance
    const solBalance = await rpc.getBalance(userPublicKey as any).send();
    
    if (solBalance === null) {
      console.warn('Failed to get SOL balance for user:', userKey);
      return null;
    }

    // Convert lamports to SOL (9 decimals)
    const solUiAmount = Number(solBalance) / Math.pow(10, 9);
    console.log(`SOL balance for ${userKey}: ${solUiAmount} SOL`);
    
    return solUiAmount.toString();
  } catch (error) {
    console.error('Error fetching SOL balance:', error);
    return null;
  }
}

/**
 * Gets the SPL token balance for a user by deriving the PDA for the associated token account
 * @param userKey - The user's wallet address
 * @param tokenMint - The token mint address
 * @returns Object containing balance and decimals, or null if failed
 */
export async function getSplTokenBalance(userKey: string, tokenMint: string): Promise<{
  balance: string;
  decimals: number;
  uiAmount: number;
} | null> {
  try {
    const userPublicKey = address(userKey);
    const mintPublicKey = address(tokenMint);

    // Get mint info for decimals
    const mintInfo = await rpc.getAccountInfo(mintPublicKey as any, {
      encoding: 'jsonParsed'
    }).send();

    if (!mintInfo || !mintInfo.value) {
      console.warn('No mint info found for token:', tokenMint);
      return null;
    }

    const mintData = mintInfo.value.data as any;
    const decimals = mintData.parsed?.info?.decimals || 0;

    console.log(`Token mint ${tokenMint} has ${decimals} decimals`);

    // Derive the PDA for the associated token account
    const [associatedTokenAccount] = await findAssociatedTokenPda({
      mint: mintPublicKey,
      owner: userPublicKey,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });

    console.log(`Derived PDA for associated token account: ${associatedTokenAccount}`);

    // Get the associated token account info
    const tokenAccountInfo = await rpc.getAccountInfo(associatedTokenAccount, {
      encoding: 'jsonParsed'
    }).send();

    if (!tokenAccountInfo || !tokenAccountInfo.value) {
      console.log(`No associated token account found for mint ${tokenMint} and owner ${userKey}`);
      return {
        balance: '0',
        decimals,
        uiAmount: 0
      };
    }

    const accountData = tokenAccountInfo.value.data as any;
    
    if (!accountData.parsed?.info?.tokenAmount) {
      console.log(`Invalid token account data for mint ${tokenMint}`);
      return {
        balance: '0',
        decimals,
        uiAmount: 0
      };
    }

    const tokenAmount = accountData.parsed.info.tokenAmount;
    const rawAmount = tokenAmount.amount;
    const uiAmount = tokenAmount.uiAmount || 0;

    // Calculate the actual balance in smallest units
    const balance = rawAmount || '0';

    console.log(`SPL token balance for ${userKey} (${tokenMint}):`);
    console.log(`  Raw amount: ${balance}`);
    console.log(`  UI amount: ${uiAmount}`);
    console.log(`  Decimals: ${decimals}`);

    return {
      balance,
      decimals,
      uiAmount
    };
  } catch (error) {
    console.error('Error fetching SPL token balance:', error);
    return null;
  }
}

/**
 * Gets the SPL token balance as a formatted string (legacy function for backward compatibility)
 * @param userKey - The user's wallet address
 * @param tokenMint - The token mint address
 * @returns Token balance as string or null if failed
 */
export async function getSplTokenBalanceString(userKey: string, tokenMint: string): Promise<string | null> {
  const result = await getSplTokenBalance(userKey, tokenMint);
  return result ? result.balance : null;
}

/**
 * Gets the SPL token balance as a UI amount (human-readable)
 * @param userKey - The user's wallet address
 * @param tokenMint - The token mint address
 * @returns Token balance as UI amount or null if failed
 */
export async function getSplTokenBalanceUI(userKey: string, tokenMint: string): Promise<number | null> {
  const result = await getSplTokenBalance(userKey, tokenMint);
  return result ? result.uiAmount : null;
}

/**
 * Gets balances for multiple tokens for a user
 * @param userKey - The user's wallet address
 * @param tokenMints - Array of token mint addresses
 * @returns Array of token balances
 */
export async function getTokenBalances(
  userKey: string,
  tokenMints: string[]
): Promise<Array<{ mint: string; balance: string | null }>> {
  try {
    const balances = await Promise.all(
      tokenMints.map(async (mint) => {
        const balanceInfo = await getTokenBalance(userKey, mint);
        return { 
          mint, 
          balance: balanceInfo ? balanceInfo.balance : null 
        };
      })
    );

    return balances;
  } catch (error) {
    console.error('Error fetching multiple token balances:', error);
    return tokenMints.map(mint => ({ mint, balance: null }));
  }
}

/**
 * Gets comprehensive asset portfolio for a user
 * @param userKey - The user's wallet address
 * @param options - Query options
 * @returns Complete asset portfolio information
 */
export async function getUserPortfolio(
  userKey: string,
  options: {
    showFungible?: boolean;
    showCollectionMetadata?: boolean;
    limit?: number;
  } = {}
): Promise<{
  solBalance: string | null;
  assets: OwnerAssets | null;
  totalAssets: number;
} | null> {
  try {
    // Get SOL balance
    const solBalance = await getSolBalance(userKey);
    
    // Get all assets
    const assets = await getAssetsByOwner(userKey, options);
    
    return {
      solBalance,
      assets,
      totalAssets: assets ? assets.total : 0
    };
  } catch (error) {
    console.error('Error fetching user portfolio:', error);
    return null;
  }
}
