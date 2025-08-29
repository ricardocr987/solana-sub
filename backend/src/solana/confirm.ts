import {
  type Base64EncodedWireTransaction,
  createSolanaRpcSubscriptions,
} from '@solana/kit';
import { config } from '../config';
import { parseSubscriptionTransaction, parseSubscriptionTransactionFromSignature } from './parseSubscription';

// USDC mint address for subscription payments
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
// System program for SOL transfers
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
// Token program for SPL token transfers
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
// Receiver address for subscription payments (should match your backend config)
const RECEIVER_ADDRESS = config.RECEIVER;

/**
 * Confirms a transaction by sending it to the RPC endpoint and waiting for confirmation.
 * The function implements optimized transaction delivery practices:
 * - Uses maxRetries: 0 to avoid RPC retry queues
 * - Includes skipPreflight: true for faster delivery
 * - Uses RPC subscriptions for proper confirmation
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
    
    // Use Solana Kit RPC for sending transactions
    const selectedRpc = config.QUICKNODE_RPC;
    
    const txnBuffer = Buffer.from(transaction, 'base64');
    const base64Transaction = txnBuffer.toString('base64') as Base64EncodedWireTransaction;
    
    // Send transaction using Solana Kit
    const signature = await selectedRpc.sendTransaction(base64Transaction, {
      skipPreflight: true,
      maxRetries: 0n,
      preflightCommitment: 'confirmed',
    }).send();

    console.log('Transaction sent with signature:', signature);
    
    // Wait for confirmation using RPC subscriptions
    const confirmedSignature = await waitForTransactionConfirmation(signature);
    return confirmedSignature;
  } catch (error) {
    console.error('Error in confirmTransaction:', error);
    return ''; // Return empty string on error
  }
}

/**
 * Waits for transaction confirmation using RPC subscriptions
 * @param signature - The transaction signature to confirm
 * @returns The confirmed signature or empty string if failed
 */
async function waitForTransactionConfirmation(signature: string): Promise<string> {
  const TIMEOUT_DURATION = 30000; // 30 seconds timeout
  
  return new Promise<string>((resolve) => {
    let timeoutId: NodeJS.Timeout;
    
    // Create an RPC subscriptions proxy object
    const rpcSubscriptions = createSolanaRpcSubscriptions(config.QUICKNODE_RPC_URL || 'wss://api.devnet.solana.com');
    
    // Use an AbortController to cancel the subscriptions
    const abortController = new AbortController();
    
    // Subscribe to signature notifications
    const signatureNotifications = rpcSubscriptions
      .signatureNotifications(signature as any, { commitment: 'confirmed' })
      .subscribe({ abortSignal: abortController.signal });
    
    // Set timeout
    timeoutId = setTimeout(() => {
      console.log(`Timeout reached for signature ${signature} after ${TIMEOUT_DURATION}ms`);
      abortController.abort();
      resolve('');
    }, TIMEOUT_DURATION);
    
    // Listen to signature notifications
    signatureNotifications
      .then(async (subscription: any) => {
        try {
          for await (const notification of subscription) {
            console.log(`Signature notification for ${signature}:`, notification);
            
            if (notification.value?.err) {
              console.error(`Transaction failed for ${signature}:`, notification.value.err);
              clearTimeout(timeoutId);
              abortController.abort();
              resolve('');
              return;
            } else {
              console.log(`Transaction confirmed for ${signature}`);
              clearTimeout(timeoutId);
              abortController.abort();
              resolve(signature);
              return;
            }
          }
        } catch (error: any) {
          console.error(`Error in signature subscription for ${signature}:`, error);
          clearTimeout(timeoutId);
          abortController.abort();
          resolve('');
        }
      })
      .catch((error: any) => {
        console.error(`Failed to subscribe to signature notifications for ${signature}:`, error);
        clearTimeout(timeoutId);
        abortController.abort();
        resolve('');
      });
  });
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
 * Verifies multiple transactions at once using getParsedTransaction
 * @param signatures - Array of transaction signatures to verify
 * @returns Array of verified signatures (empty strings for failed transactions)
 */
export async function verifyTransactions(signatures: string[]) {
  const backoffIntervals = [500, 1000, 2000]; // ms
  try {
    let pendingSignatures = signatures.map((sig, idx) => ({ sig, idx }))
      .filter(item => item.sig !== '');
    let fetchedMap: Map<string, any> = new Map();

    console.log('[verifyTransactions] Initial signatures:', signatures);
    console.log('[verifyTransactions] Pending signatures:', pendingSignatures.map(item => item.sig));

    for (let attempt = 0; attempt <= backoffIntervals.length; attempt++) {
      if (pendingSignatures.length === 0) {
        console.log(`[verifyTransactions] All transactions fetched after ${attempt} attempts.`);
        break;
      }
      const sigsToFetch = pendingSignatures.map(item => item.sig);
      console.log(`[verifyTransactions] Attempt ${attempt + 1}, fetching signatures:`, sigsToFetch);
      
      // Use Solana Kit RPC for getting parsed transactions
      const fetched = await Promise.all(
        sigsToFetch.map(async sig => {
          try {
            const result = await config.QUICKNODE_RPC.getTransaction(sig as any, {
              commitment: 'confirmed',
              encoding: 'jsonParsed',
              maxSupportedTransactionVersion: 0,
            }).send();
            return result;
          } catch (error) {
            console.error(`Error fetching transaction ${sig}:`, error);
            return null;
          }
        })
      );
      
      // Create a map of fetched transactions using their signatures as keys
      const fetchedTxMap = new Map<string, any>();
      for (let i = 0; i < sigsToFetch.length; i++) {
        const tx = fetched[i];
        const signature = sigsToFetch[i];
        
        if (tx) {
          // Use the transaction's signature to ensure proper linking
          const txSignature = tx.transaction?.signatures?.[0]; // Get the first signature
          if (txSignature) {
            fetchedTxMap.set(txSignature, tx);
          } else {
            // Fallback to the requested signature if transaction signature is not available
            fetchedTxMap.set(signature, tx);
          }
          
          if (tx.meta?.err) {
            console.log(`[verifyTransactions] Transaction has failure error for signature: ${signature}:`, tx.meta.err);
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

    const verifiedSignatures = signatures.map(sig => {
      if (sig === '') {
        console.log(`[verifyTransactions] Signature is empty string, returning empty.`);
        return '';
      }
      const tx = fetchedMap.get(sig);
      if (!tx) {
        console.log(`[verifyTransactions] No transaction found for signature: ${sig}, returning empty.`);
        return '';
      }
      // Check if transaction has a failure error
      if (tx.meta?.err) {
        console.log(`[verifyTransactions] Transaction has failure error for signature: ${sig}, returning empty.`);
        return '';
      }
      return sig;
    });

    console.log('[verifyTransactions] Final verifiedSignatures:', verifiedSignatures);
    return verifiedSignatures;
  } catch (error) {
    console.error('Error verifying transactions:', error);
    return signatures.map(() => '');
  }
}

// Export the parsing functions for use in the API
export { parseSubscriptionTransaction, parseSubscriptionTransactionFromSignature };
