import { 
  createDefaultRpcTransport, 
  createRpc, 
  createSolanaRpcApi,
} from "@solana/rpc";
import { config } from "../config";
// RPC HTTP Transport
const heliusRpcTransport = createDefaultRpcTransport({ 
  url: config.QUICKNODE_RPC_URL 
});

// Create API
const solanaApi = createSolanaRpcApi({ defaultCommitment: 'confirmed' });

// Create RPC client
export const rpc = createRpc({ 
  api: solanaApi, 
  transport: heliusRpcTransport 
});
