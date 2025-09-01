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
 * Confirms a transaction signature using retry-based polling approach
 */
async function confirmSignature(signature: Signature): Promise<string> {
  const MAX_RETRIES = 3;
  const RETRY_INTERVAL = 500; // 500ms between retries
  const TIMEOUT_DURATION = 2000; // 2 seconds total timeout
  
  console.log(`Starting confirmation for signature: ${signature}`);
  
  return new Promise<string>((resolve, reject) => {
    let timeoutId: NodeJS.Timeout;
    let retryCount = 0;
    let isResolved = false;
    
    // Cleanup function to clear timers
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
    
    // Check transaction confirmation with retry logic
    const checkConfirmation = async () => {
      if (isResolved) return;
      
      try {
        console.log(`Checking confirmation for ${signature} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        
        const tx = await rpc.getTransaction(signature, {
          commitment: 'confirmed',
          encoding: 'jsonParsed',
          maxSupportedTransactionVersion: 0,
        }).send();
        
        if (tx) {
          if (tx.meta?.err) {
            // Transaction failed on-chain
            const errorMessage = `Transaction failed on-chain: ${JSON.stringify(tx.meta.err)}`;
            console.error(`Transaction failed for ${signature}:`, tx.meta.err);
            isResolved = true;
            cleanup();
            reject(new Error(errorMessage));
          } else {
            // Transaction confirmed successfully
            console.log(`Transaction confirmed for ${signature}`);
            isResolved = true;
            cleanup();
            resolve(signature);
          }
        } else {
          // Transaction not found yet
          retryCount++;
          
          if (retryCount >= MAX_RETRIES) {
            const errorMessage = `Transaction not found after ${MAX_RETRIES} attempts: ${signature}`;
            console.error(errorMessage);
            isResolved = true;
            cleanup();
            reject(new Error(errorMessage));
          } else {
            // Schedule next retry
            setTimeout(checkConfirmation, RETRY_INTERVAL);
          }
        }
      } catch (error) {
        // RPC error occurred
        retryCount++;
        
        if (retryCount >= MAX_RETRIES) {
          const errorMessage = `Failed to confirm transaction after ${MAX_RETRIES} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMessage);
          isResolved = true;
          cleanup();
          reject(new Error(errorMessage));
        } else {
          // Schedule next retry
          setTimeout(checkConfirmation, RETRY_INTERVAL);
        }
      }
    };
    
    // Set overall timeout
    timeoutId = setTimeout(() => {
      if (!isResolved) {
        const errorMessage = `Transaction confirmation timeout after ${TIMEOUT_DURATION}ms: ${signature}`;
        console.error(errorMessage);
        isResolved = true;
        cleanup();
        reject(new Error(errorMessage));
      }
    }, TIMEOUT_DURATION);
    
    // Start the first check
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

    // Confirm the transaction with proper error handling
    try {
      return await confirmSignature(signature as Signature);
    } catch (confirmationError) {
      console.error(`Transaction confirmation failed for ${signature}:`, confirmationError);
      
      // Update payment status to failed
      await updatePaymentStatus(signature, 'failed');
      
      // Re-throw the confirmation error with more context
      throw new Error(
        confirmationError instanceof Error 
          ? `Confirmation failed: ${confirmationError.message}`
          : 'Transaction confirmation failed'
      );
    }
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