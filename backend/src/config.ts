import { createSolanaRpc } from '@solana/kit';

const requiredEnvVariables = [
  'QUICKNODE_RPC_URL',
  'WEBHOOK_TOKEN',
  'RECEIVER',
];

requiredEnvVariables.forEach((variable) => {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable: ${variable}`);
  }
});

const QUICKNODE_RPC_URL = process.env.QUICKNODE_RPC_URL!;
export const QUICKNODE_RPC = createSolanaRpc(QUICKNODE_RPC_URL);

export const config = {
  QUICKNODE_RPC,
  QUICKNODE_RPC_URL,
  WEBHOOK_TOKEN: process.env.WEBHOOK_TOKEN!,
  RECEIVER: process.env.RECEIVER!,
};
