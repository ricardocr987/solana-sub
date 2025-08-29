import { PublicKey } from '@solana/web3.js';

export type TokenMetadata = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  tags?: string[];
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

export async function getTokenFromJupiterV2(
  mint: string
): Promise<TokenMetadata | null> {
  try {
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

    // Cache the metadata
    setMetadataInCache(mint, tokenMetadata);

    return tokenMetadata;
  } catch (error) {
    console.warn(
      `Failed to fetch metadata from Jupiter v2 for ${mint}:`,
      error
    );
    return null;
  }
}

export async function getTokenMetadata(
  address: string
): Promise<TokenMetadata | null> {
  try {
    // Validate the address format
    try {
      new PublicKey(address);
    } catch {
      console.warn(`Invalid Solana address: ${address}`);
      return null;
    }

    // First try to get from cache
    const cachedMetadata = await getMetadataFromCache(address);
    if (cachedMetadata) {
      return cachedMetadata;
    }

    // If not in cache, fetch from Jupiter v2
    const jupiterMetadata = await getTokenFromJupiterV2(address);
    if (jupiterMetadata) {
      console.log('Found metadata in Jupiter v2 for', address);
      return jupiterMetadata;
    }

    return null;
  } catch (error) {
    console.warn(`Failed to fetch metadata for ${address}:`, error);
    return null;
  }
}

export async function getTokenMetadatas(
  mints: string[]
): Promise<TokenMetadata[]> {
  const metadata = await Promise.all(mints.map(getTokenMetadata));
  return metadata.filter((metadata) => metadata !== null);
}
