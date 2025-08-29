import { VersionedTransactionResponse } from "@solana/web3.js";
import { config } from '../config';

const TX_RETRY_INTERVAL = 2000; // 2 seconds between retries

/**
 * Resends a transaction with optimized settings
 * @param txnBuffer - The transaction buffer to resend
 * @returns The transaction signature
 */
export async function sendTransaction(txnBuffer: Buffer): Promise<string> {
  return await config.QUICKNODE_RPC.sendRawTransaction(txnBuffer, {
    skipPreflight: true, // Skip preflight for faster delivery
    maxRetries: 0, // Disable RPC retry queues
    preflightCommitment: 'confirmed', // Use confirmed commitment for blockhash
  });
}

/**
 * Utility function to handle transaction confirmation retries with resending
 * @param signature - The transaction signature to confirm
 * @param txnBuffer - The transaction buffer to resend if needed
 * @param maxRetries - Maximum number of retry attempts
 * @returns The confirmed signature or empty string if not confirmed
 */
export async function retryConfirmation(
  signature: string, 
  txnBuffer: Buffer
): Promise<string> {
  let retries = 0;
  const maxRetries = 1; // Only retry once as requested

  while (retries <= maxRetries) {
    try {
      if (retries === 0) {
        // First attempt - try to confirm existing signature
        const confirmed = await confirmSignature(signature);
        if (confirmed) return confirmed;
      }
      
      // Retry attempt - resend transaction
      if (retries > 0) {
        console.log(`Retry ${retries}/${maxRetries}: resending transaction for signature ${signature}`);
        await new Promise(resolve => setTimeout(resolve, TX_RETRY_INTERVAL));
        
        // Resend transaction and get new signature
        const newSignature = await sendTransaction(txnBuffer);
        console.log(`New signature after retry: ${newSignature}`);
        
        // Try to confirm the new signature
        const confirmed = await confirmSignature(newSignature);
        if (confirmed) return confirmed;
      }
      
      retries++;
    } catch (error) {
      console.error(`Retry ${retries}/${maxRetries} failed:`, error);
      retries++;
      
      if (retries <= maxRetries) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, TX_RETRY_INTERVAL));
      }
    }
  }

  console.log(`Failed to confirm transaction after ${maxRetries + 1} attempts`);
  return ''; // Return empty string if all attempts failed
}

/**
 * Confirms a single transaction by sending it to the RPC endpoint.
 * The function implements optimized transaction delivery practices:
 * - Uses maxRetries: 0 to avoid RPC retry queues
 * - Includes skipPreflight: true for faster delivery
 * - Uses client-side retry logic with transaction resending
 * - Uses confirmed commitment level for blockhash
 * 
 * @param transaction - The transaction string in base64 format
 * @returns The transaction signature as a string
 */
export async function confirmTransaction(transaction: string): Promise<string> {
  try {
    if (transaction.length === 0) {
      return '';
    }

    console.log('confirmTransaction', transaction);

    const txnBuffer = Buffer.from(transaction, 'base64');
          
    // Send transaction with optimized settings
    const signature = await sendTransaction(txnBuffer);

    console.log('unverified signature', signature);
    
    // Use retryConfirmation to handle retries and resending
    return await retryConfirmation(signature, txnBuffer);
  } catch (error) {
    console.error('Error in confirmTransaction:', error);
    return ''; // Return empty string on error
  }
}

/**
 * Confirms multiple transactions by sending them to the RPC endpoint.
 * This function processes an array of transactions and returns an array of signatures.
 * 
 * @param transactions - Array of transaction strings in base64 format
 * @returns Array of transaction signatures (empty strings for failed transactions)
 */
export async function confirmTransactions(transactions: string[]): Promise<string[]> {
  try {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    console.log(`confirmTransactions: processing ${transactions.length} transactions`);
    
    // Process all transactions concurrently
    const signatures = await Promise.all(
      transactions.map(async (transaction, index) => {
        try {
          console.log(`Processing transaction ${index + 1}/${transactions.length}`);
          return await confirmTransaction(transaction);
        } catch (error) {
          console.error(`Error confirming transaction ${index + 1}:`, error);
          return '';
        }
      })
    );

    console.log(`confirmTransactions: completed processing ${transactions.length} transactions`);
    console.log('Signatures:', signatures);
    
    return signatures;
  } catch (error) {
    console.error('Error in confirmTransactions:', error);
    // Return empty strings for all transactions on error
    return transactions.map(() => '');
  }
}

/**
 * Confirms a transaction signature using onSignature callback
 */
export async function confirmSignature(signature: string): Promise<string | null> {
  const TIMEOUT_DURATION = 8000; // 8 seconds timeout
  console.log(`Starting confirmation for signature: ${signature}`);
  
  return new Promise<string | null>((resolve) => {
    let timeoutId: NodeJS.Timeout;
    
    const handleResult = (result: any, context: any) => {
      console.log(`Confirmation result for ${signature}:`, result);
      if (result.err) {
        console.error(`Transaction failed for ${signature}:`, result.err);
        clearTimeout(timeoutId);
        resolve(null);
      } else {
        console.log(`Transaction confirmed for ${signature}`);
        clearTimeout(timeoutId);
        resolve(signature);
      }
    };

    config.QUICKNODE_RPC.onSignature(signature, handleResult, 'confirmed');
    
    timeoutId = setTimeout(() => {
      // there are cases that even after the timeout, the transaction is confirmed but we dont receive the notification
      console.log(`Timeout reached for signature ${signature} after ${TIMEOUT_DURATION}ms`);
      resolve(null);
    }, TIMEOUT_DURATION);
  });
}

/**
 * Verifies multiple transactions at once using getTransactions
 * @param signatures - Array of transaction signatures to verify
 * @returns Array of verified signatures (null for failed transactions to maintain position)
 */
export async function verifyTransactions(signatures: string[]) {
  const backoffIntervals = [500, 1000, 2000]; // ms
  try {
    let pendingSignatures = signatures.map((sig, idx) => ({ sig, idx }))
      .filter(item => item.sig !== '');
    let fetchedMap: Map<string, VersionedTransactionResponse | null> = new Map();

    console.log('[verifyTransactions] Initial signatures:', signatures);
    console.log('[verifyTransactions] Pending signatures:', pendingSignatures.map(item => item.sig));

    for (let attempt = 0; attempt <= backoffIntervals.length; attempt++) {
      if (pendingSignatures.length === 0) {
        console.log(`[verifyTransactions] All transactions fetched after ${attempt} attempts.`);
        break;
      }
      const sigsToFetch = pendingSignatures.map(item => item.sig);
      console.log(`[verifyTransactions] Attempt ${attempt + 1}, fetching signatures:`, sigsToFetch);
      const fetched = await config.QUICKNODE_RPC.getTransactions(sigsToFetch, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      
      // Create a map of fetched transactions using their signatures as keys
      const fetchedTxMap = new Map<string, VersionedTransactionResponse | null>();
      for (let i = 0; i < sigsToFetch.length; i++) {
        const tx = fetched[i];
        const signature = sigsToFetch[i];
        
        if (tx) {
          // Use the transaction's signature to ensure proper linking
          const txSignature = tx.transaction.signatures[0]; // Get the first signature
          if (txSignature) {
            fetchedTxMap.set(txSignature, tx);
          } else {
            // Fallback to the requested signature if transaction signature is not available
            fetchedTxMap.set(signature, tx);
          }
          
          if (tx.meta?.err) {
            console.log(`[verifyTransactions] Transaction for signature ${signature} has error:`, tx.meta.err);
          } else {
            console.log(`[verifyTransactions] Fetched transaction for signature: ${signature}`);
          }
        } else {
          // Not found, will retry
          console.log(`[verifyTransactions] No transaction found for signature: ${signature}`);
        }
      }
      
      // Update the main fetchedMap with the properly linked transactions
      for (const [sig, tx] of fetchedTxMap) {
        fetchedMap.set(sig, tx);
      }
      
      // Only keep signatures that are still null (not found)
      pendingSignatures = pendingSignatures.filter(item => !fetchedMap.has(item.sig));
      if (pendingSignatures.length > 0 && attempt < backoffIntervals.length) {
        console.log(`[verifyTransactions] Waiting ${backoffIntervals[attempt]}ms before next retry for:`, pendingSignatures.map(item => item.sig));
        await new Promise(res => setTimeout(res, backoffIntervals[attempt]));
      }
    }

    // Create result array maintaining original positions
    // Use null for failed transactions to clearly indicate failure
    const verifiedSignatures = signatures.map((sig, index) => {
      if (sig === '') {
        console.log(`[verifyTransactions] Signature at position ${index} is empty string, returning null.`);
        return null;
      }
      const tx = fetchedMap.get(sig);
      if (!tx) {
        console.log(`[verifyTransactions] No transaction found for signature at position ${index}: ${sig}, returning null.`);
        return null;
      }
      // Check if transaction has a failure error
      if (tx.meta?.err) {
        console.log(`[verifyTransactions] Transaction has failure error for signature at position ${index}: ${sig}, returning null.`);
        return null;
      }
      return sig;
    });

    console.log('[verifyTransactions] Final verifiedSignatures:', verifiedSignatures);
    return verifiedSignatures;
  } catch (error) {
    console.error('Error verifying transactions:', error);
    // Return null for all transactions on error to maintain position mapping
    return signatures.map(() => null);
  }
}
