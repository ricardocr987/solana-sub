import { Connection } from '@solana/web3.js';

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

// Environment variables
const QUICKNODE_RPC_URL = process.env.QUICKNODE_RPC_URL;

// RPC Connections
export const QUICKNODE_RPC = new Connection(QUICKNODE_RPC_URL!, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
});

// Configuration object
export const config = {
  QUICKNODE_RPC,
  QUICKNODE_RPC_URL,
  WEBHOOK_TOKEN: process.env.WEBHOOK_TOKEN!,
  RECEIVER: process.env.RECEIVER!,
};
