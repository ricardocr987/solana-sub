import { createSolanaRpc, type SolanaRpcApi, type Rpc } from "@solana/kit";

export function createRpcConnection(): Rpc<SolanaRpcApi> {
  const endpoint = getRpcEndpoint();
  if (!endpoint) {
    throw new Error("RPC endpoint not configured");
  }
  
  try {
    return createSolanaRpc(endpoint);
  } catch (error) {
    throw new Error(
      `Failed to create Solana RPC connection: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function getRpcEndpoint(): string {
  const currentNetwork = process.env.PUBLIC_NETWORK_ENV?.toLowerCase() || "mainnet";
  
  switch (currentNetwork) {
    case "mainnet":
      return process.env.MAINNET_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com";
    case "testnet":
      return process.env.TESTNET_RPC_ENDPOINT || "https://api.testnet.solana.com";
    case "devnet":
    default:
      return process.env.DEVNET_RPC_ENDPOINT || "https://api.devnet.solana.com";
  }
}
