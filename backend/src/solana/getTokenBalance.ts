import {
  Connection,
  PublicKey,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
  AccountLayout,
  NATIVE_MINT,
} from '@solana/spl-token';
import { config } from '../config';

// SOL mint address
const SOL_MINT = NATIVE_MINT.toBase58();

export async function getTokenBalance(
  userKey: string,
  tokenMint: string
): Promise<string | null> {
  try {
    const connection = config.QUICKNODE_RPC;
    const userPublicKey = new PublicKey(userKey);
    const mintPublicKey = new PublicKey(tokenMint);

    // Handle SOL token
    if (tokenMint === SOL_MINT) {
      const solBalance = await connection.getBalance(userPublicKey);
      const solUiAmount = solBalance / Math.pow(10, 9); // Convert lamports to SOL
      return solUiAmount.toString();
    }

    // Get mint info for decimals
    const mintInfo = await connection.getParsedAccountInfo(mintPublicKey);
    if (!mintInfo.value) {
      console.warn('No mint info found for token:', tokenMint);
      return null;
    }

    const mintData = mintInfo.value.data as any;
    const decimals = mintData.parsed?.info?.decimals || 0;

    // Get associated token account address
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mintPublicKey,
      userPublicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    try {
      // Get token account info
      const tokenAccountInfo = await getAccount(connection, associatedTokenAddress);
      
      if (!tokenAccountInfo) {
        return '0'; // No token account means 0 balance
      }

      // Parse the account data
      const accountData = AccountLayout.decode((tokenAccountInfo as any).data);
      const amount = Number(accountData.amount);
      const uiAmount = amount / Math.pow(10, decimals);

      return uiAmount.toString();
    } catch (error) {
      // If account doesn't exist, return 0
      if (error instanceof Error && error.message.includes('TokenAccountNotFoundError')) {
        return '0';
      }
      throw error;
    }
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return null;
  }
}
