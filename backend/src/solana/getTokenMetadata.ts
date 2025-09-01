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

    // Fallback to Jupiter V2
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