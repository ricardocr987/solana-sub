export function getCurrentChain(): `solana:${string}` {
  const network = process.env.NEXT_PUBLIC_NETWORK_ENV?.toLowerCase() || "devnet";
  
  switch (network) {
    case "mainnet":
      return "solana:mainnet";
    case "testnet":
      return "solana:testnet";
    case "devnet":
    default:
      return "solana:devnet";
  }
}
