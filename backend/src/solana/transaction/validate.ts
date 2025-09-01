import { 
  type Address,
  getBase64Encoder,
  getTransactionDecoder,
  getCompiledTransactionMessageDecoder,
  decompileTransactionMessageFetchingLookupTables,
  assertIsInstructionWithData,
  assertIsInstructionWithAccounts,
  type Signature
} from '@solana/kit';
import { 
  identifyTokenInstruction, 
  TokenInstruction,
  parseTransferCheckedInstruction,
  getTransferInstructionDataDecoder
} from '@solana-program/token';
import { getTransferSolInstructionDataDecoder } from '@solana-program/system';
import { addPayment, getPaymentByTransactionHash, upsertSubscription } from '../../db';
import { rpc } from '../rpc';

// Constants
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

interface ValidatedSubscription {
  signature: string;
  signer: string;
  recipient: string;
  amount: number;
  currency: string;
  subscriptionDurationDays: number;
  planType: string;
}

/**
 * Validate a transaction and store subscription payment details
 */
export async function validateTransaction(
  signature: string,
  walletAddress: string,
  amountUsdc: number,
  subscriptionDurationDays: number = 30
): Promise<ValidatedSubscription> {  
  // Check if payment already exists
  const existingPayment = await getPaymentByTransactionHash(signature);
  if (existingPayment) {
    throw new Error('Payment already processed');
  }

  try {
    // Fetch transaction details
    const response = await rpc.getTransaction(signature as Signature, {
      maxSupportedTransactionVersion: 0,
      encoding: 'base64'
    }).send();

    if (!response) {
      throw new Error('Failed to fetch transaction');
    }

    // Decode and validate transaction
    const base64Encoder = getBase64Encoder();
    const transactionBytes = base64Encoder.encode(response.transaction[1]);
    const transactionDecoder = getTransactionDecoder();
    const decodedTransaction = transactionDecoder.decode(transactionBytes);

    // Get transaction signers
    const signers = Object.entries(decodedTransaction.signatures)
      .map(([address, signature]) => ({
        address: address as Address,
        signature: signature?.toString() || null
      }));

    if (signers.length === 0) {
      throw new Error('No signers found in transaction');
    }

    const primarySigner = signers[0];
    if (!primarySigner.signature) {
      throw new Error('Primary signer has not signed the transaction');
    }

    // Decode message and find transfer instruction
    const messageDecoder = getCompiledTransactionMessageDecoder();
    const compiledMessage = messageDecoder.decode(decodedTransaction.messageBytes);
    const message = await decompileTransactionMessageFetchingLookupTables(
      compiledMessage,
      rpc
    );

    const payInstruction = message.instructions[message.instructions.length - 1];
    if (!payInstruction) {
      throw new Error('Missing transfer instruction');
    }

    // Validate instruction type
    assertIsInstructionWithData(payInstruction);
    assertIsInstructionWithAccounts(payInstruction);
    
    const instructionType = identifyTokenInstruction(payInstruction);
    if (instructionType !== TokenInstruction.TransferChecked) {
      throw new Error('Not a transfer checked instruction');
    }

    // Parse instruction data
    const parsedInstruction = parseTransferCheckedInstruction(payInstruction as any);
    const { accounts, data } = parsedInstruction;

    // Validate payment details
    if (accounts.mint.address !== USDC_MINT) {
      throw new Error('Invalid currency - only USDC supported');
    }
    
    if (data.amount <= 0n) {
      throw new Error('Invalid amount');
    }

    // Determine subscription plan type
    const planType = getPlanTypeFromAmount(amountUsdc, subscriptionDurationDays);

    // Create payment record
    const paymentDate = new Date();
    const success = await addPayment({
      transaction_hash: signature,
      wallet_address: walletAddress,
      amount_usdc: amountUsdc,
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
    
    const subscriptionSuccess = await upsertSubscription(walletAddress, subscriptionEndDate);
    if (!subscriptionSuccess) {
      console.warn(`Failed to update subscription for wallet: ${walletAddress}`);
    }

    return {
      signature,
      signer: primarySigner.address.toString(),
      recipient: accounts.destination.address.toString(),
      amount: amountUsdc,
      currency: accounts.mint.address.toString(),
      subscriptionDurationDays,
      planType
    };
  } catch (error) {
    console.error('Error validating transaction:', error);
    throw error;
  }
}

/**
 * Validate a transaction from signature and extract subscription details
 */
export async function validateTransactionFromSignature(signature: string): Promise<ValidatedSubscription> {
  try {
    console.log(`Validating transaction from signature: ${signature}`);
    
    // Get transaction details from Solana
    const parsedTransaction = await rpc.getTransaction(signature as any, {
      commitment: 'confirmed',
      encoding: 'jsonParsed',
      maxSupportedTransactionVersion: 0,
    }).send();
    
    if (!parsedTransaction) {
      throw new Error('Transaction not found or not confirmed');
    }
    
    const tx = parsedTransaction;
    
    // Check if transaction failed
    if (tx.meta?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(tx.meta.err)}`);
    }
    
    // Extract fee payer (wallet address)
    const feePayerIndex = tx.transaction.message.accountKeys.findIndex(
      (key: any) => key.signer === true
    );
    
    if (feePayerIndex === -1) {
      throw new Error('No fee payer found in transaction');
    }
    
    const walletAddress = tx.transaction.message.accountKeys[feePayerIndex].pubkey;
    console.log('Fee payer (wallet address):', walletAddress);
    
    // Find transfer instruction
    const instructions = tx.transaction.message.instructions;
    let transferInstruction = null;
    
    for (const instruction of instructions) {
      if (instruction.programId === TOKEN_PROGRAM || instruction.programId === SYSTEM_PROGRAM) {
        transferInstruction = instruction;
        break;
      }
    }
    
    if (!transferInstruction) {
      throw new Error('No transfer instruction found');
    }
    
    // Extract amount and determine subscription duration
    let amountUsdc = 0;
    let subscriptionDurationDays = 30; // Default to monthly
    
    if (transferInstruction.programId === TOKEN_PROGRAM) {
      // SPL token transfer (USDC)
      try {
        if ('data' in transferInstruction && transferInstruction.data) {
          const data = transferInstruction.data;
          if (data && data.length >= 8) {
            const dataBytes = getBase64Encoder().encode(data);
            const decodedData = getTransferInstructionDataDecoder().decode(dataBytes);
            
            if (decodedData && decodedData.amount) {
              amountUsdc = Number(decodedData.amount) / Math.pow(10, 6);
              console.log(`USDC amount: ${amountUsdc}`);
            } else {
              throw new Error('Failed to decode transfer instruction data');
            }
          }
        } else {
          throw new Error('No data found in transfer instruction');
        }
      } catch (error) {
        console.error('Error decoding USDC transfer instruction:', error);
        throw new Error('Failed to decode USDC transfer instruction');
      }
    } else if (transferInstruction.programId === SYSTEM_PROGRAM) {
      // SOL transfer
      try {
        if ('data' in transferInstruction && transferInstruction.data) {
          const data = transferInstruction.data;
          if (data && data.length >= 8) {
            const dataBytes = getBase64Encoder().encode(data);
            const decodedData = getTransferSolInstructionDataDecoder().decode(dataBytes);
            
            if (decodedData && decodedData.amount) {
              amountUsdc = Number(decodedData.amount) / Math.pow(10, 9);
              console.log(`SOL amount: ${amountUsdc}`);
            } else {
              throw new Error('Failed to decode SOL transfer instruction data');
            }
          }
        } else {
          throw new Error('No data found in SOL transfer instruction');
        }
      } catch (error) {
        console.error('Error decoding SOL transfer instruction:', error);
        throw new Error('Failed to decode SOL transfer instruction');
      }
    }
    
    // Determine subscription duration based on amount
    if (amountUsdc >= 100) {
      subscriptionDurationDays = 365; // Yearly subscription
    } else if (amountUsdc >= 10) {
      subscriptionDurationDays = 30; // Monthly subscription
    } else if (amountUsdc >= 2) {
      subscriptionDurationDays = 30; // Monthly subscription
    }
    
    console.log(`Subscription duration: ${subscriptionDurationDays} days`);
    
    // Validate minimum amount
    if (amountUsdc < 2) {
      throw new Error(`Amount too low: ${amountUsdc}, minimum required: 2`);
    }
    
    // Validate and store the transaction with subscription data
    return await validateTransaction(signature, walletAddress, amountUsdc, subscriptionDurationDays);
    
  } catch (error) {
    console.error('Error validating transaction from signature:', error);
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