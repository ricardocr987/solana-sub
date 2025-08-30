import { rpc } from '../rpc';
import { updatePaymentStatus } from '../../db';
import { getBase64Encoder, getTransactionDecoder, getCompiledTransactionMessageDecoder, decompileTransactionMessageFetchingLookupTables, getBase64EncodedWireTransaction, FullySignedTransaction, TransactionWithBlockhashLifetime, Base64EncodedWireTransaction, getBase58Encoder } from '@solana/kit';
import { type Signature } from '@solana/keys';

/**
 * Sends a raw transaction with optimized RPC settings
 */
async function sendRawTransaction(wireTransaction: Base64EncodedWireTransaction): Promise<string> {
  return await rpc.sendTransaction(wireTransaction, {
    encoding: 'base64',
    skipPreflight: true, // Skip preflight for faster delivery
    maxRetries: 0n, // Disable RPC retry queues
    preflightCommitment: 'confirmed', // Use confirmed commitment for blockhash
  }).send();
}

/**
 * Confirms a transaction signature using polling approach
 */
async function confirmSignature(signature: Signature): Promise<string> {
  const TIMEOUT_DURATION = 8000; // 8 seconds timeout
  console.log(`Starting confirmation for signature: ${signature}`);
  
  return new Promise<string>((resolve) => {
    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;
    let isResolved = false; // Prevent multiple resolutions
    
    // Cleanup function to clear all timers
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
    
    // Simple polling approach for confirmation
    const checkConfirmation = async () => {
      // Don't check if already resolved
      if (isResolved) return;
      
      try {
        const tx = await rpc.getTransaction(signature, {
          commitment: 'confirmed',
          encoding: 'jsonParsed',
          maxSupportedTransactionVersion: 0,
        }).send();
        
        if (tx && !tx.meta?.err) {
          console.log(`Transaction confirmed for ${signature}`);
          isResolved = true;
          cleanup();
          resolve(signature);
        } else if (tx?.meta?.err) {
          console.error(`Transaction failed for ${signature}:`, tx.meta.err);
          isResolved = true;
          cleanup();
          resolve('');
        }
      } catch (error) {
        // Transaction not found yet, continue polling
        console.log(`Transaction ${signature} not yet confirmed, continuing...`);
      }
    };
    
    // Check every 500ms
    intervalId = setInterval(checkConfirmation, 500);
    
    timeoutId = setTimeout(() => {
      if (!isResolved) {
        console.log(`Timeout reached for signature ${signature} after ${TIMEOUT_DURATION}ms`);
        isResolved = true;
        cleanup();
        resolve('');
      }
    }, TIMEOUT_DURATION);
    
    // Initial check
    checkConfirmation();
  });
}

/**
 * Sends and confirms a transaction with optimized settings
 */
export async function sendTransaction(transaction: string): Promise<string> {
  try {
    const signature = await sendRawTransaction(transaction as Base64EncodedWireTransaction);
    console.log(`Transaction sent with signature: ${signature}`);

    // Confirm the transaction
    return await confirmSignature(signature as Signature);
  } catch (error) {
    console.error('Transaction failed:', error);
    
    // If we have a signature from error object, update status
    if (error && typeof error === 'object' && 'signature' in error) {
      const signature = (error as { signature: string }).signature;
      await updatePaymentStatus(signature, 'failed');
    }
    
    throw new Error(
      error instanceof Error 
        ? error.message 
        : 'Transaction failed'
    );
  }
}