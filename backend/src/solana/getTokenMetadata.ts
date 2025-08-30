import { address } from '@solana/kit';
import { config } from '../config';

export type TokenMetadata = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  tags?: string[];
  description?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  collection?: string;
  creators?: Array<{
    address: string;
    share: number;
    verified: boolean;
  }>;
  royalty?: {
    basis_points: number;
    percent: number;
  };
};

// Add metadata cache
const metadataCache: Record<string, TokenMetadata & { timestamp: number }> = {};
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 1 day

async function getMetadataFromCache(mint: string): Promise<TokenMetadata | null> {
  const cached = metadataCache[mint];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached;
  }
  return null;
}

function setMetadataInCache(mint: string, metadata: TokenMetadata): void {
  metadataCache[mint] = {
    ...metadata,
    timestamp: Date.now()
  };
}

/**
 * Fetches token metadata using QuickNode's Metaplex DAS getAsset RPC method
 * @param mint - The mint address of the token
 * @returns Token metadata or null if not found
 */
async function getMetadataFromMetaplexDAS(mint: string): Promise<TokenMetadata | null> {
  try {
    console.log(`Fetching metadata from Metaplex DAS for mint: ${mint}`);
    
    // Use QuickNode's getAsset RPC method with showFungible flag for token info
    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.RPC_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAsset',
        params: {
          id: mint,
          options: {
            showFungible: true,
            showCollectionMetadata: true,
            showUnverifiedCollections: false
          }
        }
      })
    });

    if (!response.ok) {
      console.warn(`Metaplex DAS API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.error) {
      console.warn(`Metaplex DAS RPC error: ${data.error.message}`);
      return null;
    }

    if (!data.result || !data.result.asset) {
      console.warn(`No asset found in Metaplex DAS for ${mint}`);
      return null;
    }

    const asset = data.result.asset;
    console.log(`Asset found: ${asset.interface}, name: ${asset.metadata?.name}`);

    // Extract token info for fungible tokens
    let decimals = 6; // Default for USDC
    let supply = 0;
    
    if (asset.token_info) {
      decimals = asset.token_info.decimals || 6;
      supply = asset.token_info.supply || 0;
    }

    // Build token metadata object
    const tokenMetadata: TokenMetadata = {
      address: mint,
      name: asset.metadata?.name || 'Unknown Token',
      symbol: asset.metadata?.symbol || 'UNKNOWN',
      decimals: decimals,
      logoURI: asset.content?.files?.[0]?.uri || '',
      description: asset.metadata?.description || '',
      attributes: asset.metadata?.attributes || [],
      collection: asset.grouping?.find((g: any) => g.group_key === 'collection')?.group_value,
      creators: asset.creators?.map((creator: any) => ({
        address: creator.address,
        share: creator.share,
        verified: creator.verified
      })),
      royalty: asset.royalty ? {
        basis_points: asset.royalty.basis_points || 0,
        percent: asset.royalty.percent || 0
      } : undefined,
      tags: asset.metadata?.attributes?.map((attr: any) => `${attr.trait_type}: ${attr.value}`) || []
    };

    console.log(`Successfully parsed metadata for ${mint}:`, {
      name: tokenMetadata.name,
      symbol: tokenMetadata.symbol,
      decimals: tokenMetadata.decimals,
      collection: tokenMetadata.collection
    });

    return tokenMetadata;
  } catch (error) {
    console.warn(`Failed to fetch metadata from Metaplex DAS for ${mint}:`, error);
    return null;
  }
}

/**
 * Fallback to Jupiter V2 API if Metaplex DAS fails
 * @param mint - The mint address of the token
 * @returns Token metadata or null if not found
 */
async function getMetadataFromJupiterV2(mint: string): Promise<TokenMetadata | null> {
  try {
    console.log(`Fallback: Fetching metadata from Jupiter V2 for mint: ${mint}`);
    
    const response = await fetch(
      `https://lite-api.jup.ag/tokens/v2/search?query=${mint}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(`Jupiter API error: ${response.status}`);
      return null;
    }

    const data = await response.json() as any[];

    if (!data || data.length === 0) {
      console.warn(`No metadata found in Jupiter v2 for ${mint}`);
      return null;
    }

    const token = data[0];
    const tokenMetadata: TokenMetadata = {
      address: token.id,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      logoURI: token.icon || '',
      tags: token.tags,
    };

    console.log(`Fallback metadata found for ${mint}:`, {
      name: tokenMetadata.name,
      symbol: tokenMetadata.symbol,
      decimals: tokenMetadata.decimals
    });

    return tokenMetadata;
  } catch (error) {
    console.warn(`Failed to fetch fallback metadata from Jupiter v2 for ${mint}:`, error);
    return null;
  }
}

export async function getTokenMetadata(
  mintAddress: string
): Promise<TokenMetadata | null> {
  try {
    // Validate the address format using Solana Kit
    try {
      address(mintAddress);
    } catch {
      console.warn(`Invalid Solana address: ${mintAddress}`);
      return null;
    }

    // First try to get from cache
    const cachedMetadata = await getMetadataFromCache(mintAddress);
    if (cachedMetadata) {
      console.log(`Returning cached metadata for ${mintAddress}`);
      return cachedMetadata;
    }

    // Try Metaplex DAS first (primary source)
    const dasMetadata = await getMetadataFromMetaplexDAS(mintAddress);
    if (dasMetadata) {
      // Cache the metadata
      setMetadataInCache(mintAddress, dasMetadata);
      console.log(`Successfully fetched and cached metadata from Metaplex DAS for ${mintAddress}`);
      return dasMetadata;
    }

    // Fallback to Jupiter V2 if Metaplex DAS fails
    console.log(`Metaplex DAS failed, trying Jupiter V2 fallback for ${mintAddress}`);
    const jupiterMetadata = await getMetadataFromJupiterV2(mintAddress);
    if (jupiterMetadata) {
      // Cache the metadata
      setMetadataInCache(mintAddress, jupiterMetadata);
      console.log(`Successfully fetched and cached fallback metadata from Jupiter V2 for ${mintAddress}`);
      return jupiterMetadata;
    }

    console.warn(`No metadata found for ${mintAddress} from any source`);
    return null;
  } catch (error) {
    console.warn(`Failed to fetch metadata for ${mintAddress}:`, error);
    return null;
  }
}

export async function getTokenMetadatas(
  mints: string[]
): Promise<TokenMetadata[]> {
  const metadata = await Promise.all(mints.map(getTokenMetadata));
  return metadata.filter((metadata) => metadata !== null);
}

/**
 * Get detailed asset information including ownership, compression, and more
 * @param mint - The mint address of the asset
 * @returns Full asset information or null if not found
 */
export async function getAssetDetails(mint: string): Promise<any | null> {
  try {
    // Validate the address format
    try {
      address(mint);
    } catch {
      console.warn(`Invalid Solana address: ${mint}`);
      return null;
    }

    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.RPC_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAsset',
        params: {
          id: mint,
          options: {
            showFungible: true,
            showCollectionMetadata: true,
            showUnverifiedCollections: true
          }
        }
      })
    });

    if (!response.ok) {
      console.warn(`getAsset RPC error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.error) {
      console.warn(`getAsset RPC error: ${data.error.message}`);
      return null;
    }

    return data.result?.asset || null;
  } catch (error) {
    console.warn(`Failed to fetch asset details for ${mint}:`, error);
    return null;
  }
}
