import { addPayment, getPaymentByTransactionHash, upsertSubscription } from '../../db';
import { rpc } from '../rpc';
import BigNumber from "bignumber.js";

// Constants
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

interface ValidatedSubscription {
  signature: string;
  signer: string;
  recipient: string;
  amount: number;
  currency: string;
  subscriptionDurationDays: number;
  planType: string;
}

interface PaymentDetails {
  walletAddress: string;
  amountUsdc: number;
  paymentMint: string;
  recipient: string;
}

// Generic transaction type for meta data access
interface TransactionWithMeta {
  meta?: {
    preTokenBalances?: Array<{
      owner: string;
      mint: string;
      uiTokenAmount: {
        amount: string;
        decimals: number;
      };
    }>;
    postTokenBalances?: Array<{
      owner: string;
      mint: string;
      uiTokenAmount: {
        amount: string;
        decimals: number;
      };
    }>;
    preBalances?: readonly bigint[];
    postBalances?: readonly bigint[];
    err?: any;
  };
  transaction?: {
    message?: {
      header?: {
        numRequiredSignatures?: number;
      };
      accountKeys?: Array<{ pubkey: string; signer?: boolean }>;
    };
  };
}

/**
 * Extract payment details from transaction meta data
 */
function extractPaymentDetailsFromMeta(
  tx: TransactionWithMeta | null,
  signature: string
): PaymentDetails | null {
  try {
    if (!tx?.meta) {
      console.log('No transaction meta data available');
      return null;
    }

    // Get message from transaction
    const message = tx.transaction?.message;
    if (!message) return null;

    // Find the first signer from the account keys
    const accountKeys = message.accountKeys || [];
    console.log('Account keys:', accountKeys);
    
    // Find the signer (fee payer) - first account with signer = true
    const signerIndex = accountKeys.findIndex(key => key.signer === true);
    if (signerIndex === -1) {
      console.log('No signer found in transaction');
      return null;
    }

    // Get signer's public key
    const signer = accountKeys[signerIndex]?.pubkey;
    if (!signer) return null;
    
    console.log('Fee payer (wallet address):', signer);
    
    // Get pre and post token balances
    const preBalances = tx.meta.preTokenBalances || [];
    const postBalances = tx.meta.postTokenBalances || [];
    
    // Get pre and post SOL balances
    const preSOLBalances = tx.meta.preBalances || [];
    const postSOLBalances = tx.meta.postBalances || [];
    
    console.log('Pre token balances:', preBalances);
    console.log('Post token balances:', postBalances);
    console.log('Pre SOL balances:', preSOLBalances);
    console.log('Post SOL balances:', postSOLBalances);

    // Map balances by mint to calculate changes
    const balanceMap = new Map<string, {
      mint: string;
      preAmount: BigNumber;
      postAmount: BigNumber;
      difference: BigNumber;
      preAmountRaw: string;
      postAmountRaw: string;
      differenceRaw: string;
      decimals: number;
    }>();
    
    // Process pre-balances for tokens
    preBalances.forEach((balance: any) => {
      if (balance.owner === signer) {
        const existing = balanceMap.get(balance.mint);
        if (existing) {
          existing.preAmountRaw = balance.uiTokenAmount.amount;
          existing.preAmount = new BigNumber(balance.uiTokenAmount.amount)
              .div(new BigNumber(10).pow(balance.uiTokenAmount.decimals));
        } else {
          const preAmountRaw = balance.uiTokenAmount.amount;
          const decimals = balance.uiTokenAmount.decimals;
          
          balanceMap.set(balance.mint, {
            mint: balance.mint,
            preAmount: new BigNumber(preAmountRaw)
                .div(new BigNumber(10).pow(decimals)),
            postAmount: new BigNumber(0),
            difference: new BigNumber(preAmountRaw)
                .div(new BigNumber(10).pow(decimals))
                .negated(),
            preAmountRaw: preAmountRaw,
            postAmountRaw: "0",
            differenceRaw: new BigNumber(preAmountRaw).negated().toString(),
            decimals: decimals
          });
        }
      }
    });

    // Process post-balances for tokens and calculate differences
    postBalances.forEach((balance: any) => {
      if (balance.owner === signer) {
        const existing = balanceMap.get(balance.mint);
        if (existing) {
          // Use raw amounts and decimals for precise calculation
          const postAmountRaw = balance.uiTokenAmount.amount;
          const preAmountRaw = existing.preAmountRaw || "0";
          const decimals = balance.uiTokenAmount.decimals;
          
          // Calculate differences using BigNumber
          const postAmount = new BigNumber(postAmountRaw)
              .div(new BigNumber(10).pow(decimals));
          const preAmount = new BigNumber(preAmountRaw)
              .div(new BigNumber(10).pow(decimals));
          const difference = postAmount.minus(preAmount);
          
          existing.postAmount = postAmount;
          existing.difference = difference;
          existing.preAmountRaw = existing.preAmountRaw || "0";
          existing.postAmountRaw = postAmountRaw;
          existing.differenceRaw = difference.times(new BigNumber(10).pow(decimals)).toString();
          existing.decimals = decimals;
        } else {
          const postAmountRaw = balance.uiTokenAmount.amount;
          const decimals = balance.uiTokenAmount.decimals;
          
          balanceMap.set(balance.mint, {
            mint: balance.mint,
            preAmount: new BigNumber(0),
            postAmount: new BigNumber(postAmountRaw)
                .div(new BigNumber(10).pow(decimals)),
            difference: new BigNumber(postAmountRaw)
                .div(new BigNumber(10).pow(decimals)),
            preAmountRaw: "0",
            postAmountRaw: postAmountRaw,
            differenceRaw: postAmountRaw,
            decimals: decimals
          });
        }
      }
    });

    // Handle SOL balance changes for the signer
    const preSOLAmount = new BigNumber(preSOLBalances[signerIndex]?.toString() || '0')
        .div(new BigNumber(10).pow(9));
    const postSOLAmount = new BigNumber(postSOLBalances[signerIndex]?.toString() || '0')
        .div(new BigNumber(10).pow(9));
    const solDifference = postSOLAmount.minus(preSOLAmount);

    if (!solDifference.isZero()) {
      balanceMap.set("So11111111111111111111111111111111111111112", {
        mint: "So11111111111111111111111111111111111111112",
        preAmount: preSOLAmount,
        postAmount: postSOLAmount,
        difference: solDifference,
        preAmountRaw: preSOLBalances[signerIndex]?.toString() || "0",
        postAmountRaw: postSOLBalances[signerIndex]?.toString() || "0",
        differenceRaw: solDifference.times(new BigNumber(10).pow(9)).toString(),
        decimals: 9
      });
    }

    console.log('Balance map:', Array.from(balanceMap.entries()));

    // Find USDC balance changes specifically
    const usdcBalance = balanceMap.get(USDC_MINT);
    if (!usdcBalance) {
      console.log('No USDC balance changes found');
      return null;
    }

    console.log('USDC balance changes:', usdcBalance);

    // Check if USDC was sent (negative difference)
    if (!usdcBalance.difference.isNegative()) {
      console.log('No USDC payment found (difference is not negative)');
      return null;
    }

    const amountUsdc = usdcBalance.difference.abs().toNumber();
    console.log('USDC payment amount:', amountUsdc);

    // Find recipient - look for the account that received the USDC
    // This is a simplified approach - you might need to analyze instructions for more accuracy
    let recipient = '';
    
    // Look for accounts in the transaction that could be the recipient
    // Usually the second account (index 1) is the recipient in simple transfers
    if (accountKeys.length > 1) {
      recipient = accountKeys[1]?.pubkey || '';
      console.log('Recipient (from account index 1):', recipient);
    }

    // If no recipient found, try to find from token balance changes
    if (!recipient) {
      // Look for accounts that might have received USDC
      postBalances.forEach((balance: any) => {
        if (balance.mint === USDC_MINT && balance.owner !== signer) {
          recipient = balance.owner;
          console.log('Recipient found from token balance:', recipient);
        }
      });
    }

    if (!recipient) {
      console.log('Could not determine recipient');
      return null;
    }

    return {
      walletAddress: signer,
      amountUsdc,
      paymentMint: USDC_MINT,
      recipient
    };

  } catch (error) {
    console.error('Error extracting payment details from meta:', error);
    return null;
  }
}

/**
 * Validate a transaction and store subscription payment details
 * This function now receives the confirmed transaction directly
 */
export async function validateTransaction(
  signature: string,
  confirmedTransaction: any
): Promise<ValidatedSubscription> {  
  // Check if payment already exists
  const existingPayment = await getPaymentByTransactionHash(signature);
  console.log('Existing payment:', existingPayment);
  if (existingPayment) {
    throw new Error('Payment already processed');
  }

  try {
    // Extract payment details from the confirmed transaction
    console.log('Confirmed transaction:', confirmedTransaction);
    const paymentDetails = extractPaymentDetailsFromMeta(confirmedTransaction, signature);
    if (!paymentDetails) {
      throw new Error('Failed to extract payment details from transaction');
    }

    console.log('Payment details extracted:', paymentDetails);

    // Validate minimum amount
    if (paymentDetails.amountUsdc < 2) {
      throw new Error(`Amount too low: ${paymentDetails.amountUsdc}, minimum required: 2`);
    }

    // Determine subscription duration based on amount
    let subscriptionDurationDays = 30; // Default to monthly
    
    if (paymentDetails.amountUsdc >= 100) {
      subscriptionDurationDays = 365; // Yearly subscription
    } else if (paymentDetails.amountUsdc >= 10) {
      subscriptionDurationDays = 30; // Monthly subscription
    } else if (paymentDetails.amountUsdc >= 2) {
      subscriptionDurationDays = 30; // Monthly subscription
    }
    
    console.log(`Subscription duration: ${subscriptionDurationDays} days`);

    // Determine subscription plan type
    const planType = getPlanTypeFromAmount(paymentDetails.amountUsdc, subscriptionDurationDays);

    // Create payment record
    const paymentDate = new Date();
    const success = await addPayment({
      transaction_hash: signature,
      wallet_address: paymentDetails.walletAddress,
      amount_usdc: paymentDetails.amountUsdc,
      payment_date: paymentDate,
      subscription_duration_days: subscriptionDurationDays,
      status: 'confirmed'
    });

    if (!success) {
      throw new Error('Failed to create payment record');
    }

    // Update subscription end date
    const subscriptionEndDate = new Date(paymentDate);
    subscriptionEndDate.setDate(subscriptionEndDate.getDate() + subscriptionDurationDays);
    
    const subscriptionSuccess = await upsertSubscription(paymentDetails.walletAddress, subscriptionEndDate);
    if (!subscriptionSuccess) {
      console.warn(`Failed to update subscription for wallet: ${paymentDetails.walletAddress}`);
    }

    return {
      signature,
      signer: paymentDetails.walletAddress,
      recipient: paymentDetails.recipient,
      amount: paymentDetails.amountUsdc,
      currency: paymentDetails.paymentMint,
      subscriptionDurationDays,
      planType
    };
  } catch (error) {
    console.error('Error validating transaction:', error);
    throw error;
  }
}

/**
 * Helper function to determine subscription plan type from amount and duration
 */
function getPlanTypeFromAmount(amount: number, durationDays: number): string {
  if (durationDays === 30) {
    if (amount === 2) return 'Monthly Pro I';
    if (amount === 10) return 'Monthly Pro II';
  } else if (durationDays === 365) {
    if (amount === 20) return 'Yearly Pro I';
    if (amount === 100) return 'Yearly Pro II';
  }
  return 'Custom Plan';
}