const requiredEnvVariables = [
  'QUICKNODE_RPC_URL',
  'RECEIVER',
];

requiredEnvVariables.forEach((variable) => {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable: ${variable}`);
  }
});

const QUICKNODE_RPC_URL = process.env.QUICKNODE_RPC_URL!;

export const config = {
  QUICKNODE_RPC_URL,
  RECEIVER: process.env.RECEIVER!,
};
