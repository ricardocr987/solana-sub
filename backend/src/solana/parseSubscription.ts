import {
  getBase64Encoder,
  getTransactionDecoder,
  getCompiledTransactionMessageDecoder,
  decompileTransactionMessage,
  address,
} from '@solana/kit';
import { 
  getTransferInstructionDataDecoder, 
  TOKEN_PROGRAM_ADDRESS 
} from '@solana-program/token';
import { getTransferSolInstructionDataDecoder } from '@solana-program/system';
import { config } from '../config';

// USDC mint address for subscription payments
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
// System program for SOL transfers
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
// Token program for SPL token transfers
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
// Receiver address for subscription payments (should match your backend config)
const RECEIVER_ADDRESS = config.RECEIVER;

export interface ParsedSubscriptionTransaction {
  walletAddress: string;
  amountUsdc: number;
  subscriptionDurationDays: number;
  transactionHash?: string;
}

/**
 * Parses a subscription transaction to extract payment details using proper Solana Kit transaction decoding
 * @param transaction - Base64 encoded transaction
 * @returns Parsed subscription details or null if invalid
 */
export async function parseSubscriptionTransaction(transaction: string): Promise<ParsedSubscriptionTransaction | null> {
  try {
    console.log('Parsing subscription transaction...');
    
    // Get the base64 encoder and transaction decoder
    const base64Encoder = getBase64Encoder();
    const transactionDecoder = getTransactionDecoder();
    const compiledTransactionMessageDecoder = getCompiledTransactionMessageDecoder();
    
    // Decode the transaction
    const transactionBytes = base64Encoder.encode(transaction);
    const decodedTx = transactionDecoder.decode(transactionBytes);
    
    // Decode the transaction message
    const message = compiledTransactionMessageDecoder.decode(decodedTx.messageBytes);
    
    // Decompile the transaction message to extract instructions
    const decompiledMessage = decompileTransactionMessage(message);
    
    if (!decompiledMessage) {
      console.log('Failed to decompile transaction message');
      return null;
    }
    
    // Extract fee payer (wallet address)
    const walletAddress = decompiledMessage.feePayer.address;
    console.log('Fee payer (wallet address):', walletAddress);
    
    // Look for transfer instruction (should be after compute budget instructions)
    const instructions = decompiledMessage.instructions;
    console.log(`Found ${instructions.length} instructions in transaction`);
    
    // Find the transfer instruction (typically at index 2 after compute budget instructions)
    let transferInstruction = null;
    let transferInstructionIndex = -1;
    
    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i];
      console.log(`Instruction ${i}: program ${instruction.programAddress}`);
      
      if (instruction.programAddress === TOKEN_PROGRAM || instruction.programAddress === SYSTEM_PROGRAM) {
        transferInstruction = instruction;
        transferInstructionIndex = i;
        break;
      }
    }
    
    if (!transferInstruction) {
      console.log('No transfer instruction found');
      return null;
    }
    
    console.log(`Transfer instruction found at index ${transferInstructionIndex}`);
    
    // Validate receiver address
    if (transferInstruction.accounts && transferInstruction.accounts.length > 1) {
      // For SPL token transfers, the destination account is typically the 2nd account
      // For SOL transfers, the destination account is typically the 2nd account
      const destinationAccount = transferInstruction.accounts[1]; // Index 1 is usually destination
      
      if (destinationAccount && destinationAccount.address !== RECEIVER_ADDRESS) {
        console.log(`Invalid receiver address: ${destinationAccount.address}, expected: ${RECEIVER_ADDRESS}`);
        return null;
      }
      
      console.log(`Receiver address validated: ${destinationAccount?.address}`);
    }
    
    // Extract amount and determine subscription duration
    let amountUsdc = 0;
    let subscriptionDurationDays = 30; // Default to monthly
    
    if (transferInstruction.programAddress === TOKEN_PROGRAM) {
      // SPL token transfer (USDC)
      try {
        if (!transferInstruction.data) {
          console.log('No data found in SPL token transfer instruction');
          return null;
        }
        
        // Decode the transfer instruction data
        const decodedData = getTransferInstructionDataDecoder().decode(transferInstruction.data);
        
        if (decodedData && decodedData.amount) {
          // Check if this is actually a USDC transfer by looking at the mint
          // We need to find the mint account in the instruction accounts
          if (transferInstruction.accounts && transferInstruction.accounts.length > 2) {
            // The mint account is usually referenced in the instruction
            // For USDC transfers, we need to validate the mint address
            // This is a simplified check - in production you'd want to verify the actual mint
            console.log('Processing SPL token transfer - assuming USDC for now');
            
            // Parse the amount from decoded data
            const amount = decodedData.amount;
            amountUsdc = Number(amount) / Math.pow(10, 6); // Convert from smallest unit to USDC
            
            console.log(`USDC amount: ${amountUsdc} (raw: ${amount})`);
          } else {
            console.log('Insufficient accounts for SPL token transfer');
            return null;
          }
        } else {
          console.log('Failed to decode SPL token transfer instruction data');
          return null;
        }
      } catch (error) {
        console.error('Error decoding SPL token transfer instruction:', error);
        return null;
      }
    } else if (transferInstruction.programAddress === SYSTEM_PROGRAM) {
      // SOL transfer
      try {
        if (!transferInstruction.data) {
          console.log('No data found in SOL transfer instruction');
          return null;
        }
        
        // Decode the SOL transfer instruction data
        const decodedData = getTransferSolInstructionDataDecoder().decode(transferInstruction.data);
        
        if (decodedData && decodedData.amount) {
          amountUsdc = Number(decodedData.amount) / Math.pow(10, 9); // Convert from lamports to SOL
          
          console.log(`SOL amount: ${amountUsdc} (raw: ${decodedData.amount})`);
        } else {
          console.log('Failed to decode SOL transfer instruction data');
          return null;
        }
      } catch (error) {
        console.error('Error decoding SOL transfer instruction:', error);
        return null;
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
      console.log(`Amount too low: ${amountUsdc}, minimum required: 2`);
      return null;
    }
    
    return {
      walletAddress,
      amountUsdc,
      subscriptionDurationDays,
    };
  } catch (error) {
    console.error('Error parsing subscription transaction:', error);
    return null;
  }
}

/**
 * Parses a subscription transaction from signature using getParsedTransaction
 * @param signature - The transaction signature to parse
 * @returns Parsed subscription details or null if invalid
 */
export async function parseSubscriptionTransactionFromSignature(signature: string): Promise<ParsedSubscriptionTransaction | null> {
  try {
    console.log(`Parsing transaction from signature: ${signature}`);
    
    // Use getTransaction with jsonParsed encoding to get detailed transaction information
    const parsedTransaction = await config.QUICKNODE_RPC.getTransaction(signature as any, {
      commitment: 'confirmed',
      encoding: 'jsonParsed',
      maxSupportedTransactionVersion: 0,
    }).send();
    
    if (!parsedTransaction) {
      console.log('Transaction not found or not confirmed');
      return null;
    }
    
    const tx = parsedTransaction;
    
    // Check if transaction failed
    if (tx.meta?.err) {
      console.log('Transaction failed:', tx.meta.err);
      return null;
    }
    
    // Extract fee payer (wallet address) from account keys
    const feePayerIndex = tx.transaction.message.accountKeys.findIndex(
      (key: any) => key.signer === true
    );
    
    if (feePayerIndex === -1) {
      console.log('No fee payer found in transaction');
      return null;
    }
    
    const walletAddress = tx.transaction.message.accountKeys[feePayerIndex].pubkey;
    console.log('Fee payer (wallet address):', walletAddress);
    
    // Parse instructions to find transfer details
    const instructions = tx.transaction.message.instructions;
    console.log(`Found ${instructions.length} instructions in transaction`);
    
    // Find the transfer instruction
    let transferInstruction = null;
    let transferInstructionIndex = -1;
    
    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i];
      console.log(`Instruction ${i}: program ${instruction.programId}`);
      
      if (instruction.programId === TOKEN_PROGRAM || instruction.programId === SYSTEM_PROGRAM) {
        transferInstruction = instruction;
        transferInstructionIndex = i;
        break;
      }
    }
    
    if (!transferInstruction) {
      console.log('No transfer instruction found');
      return null;
    }
    
    console.log(`Transfer instruction found at index ${transferInstructionIndex}`);
    
    // Validate receiver address
    if ('accounts' in transferInstruction && transferInstruction.accounts && transferInstruction.accounts.length > 1) {
      const destinationAccountIndex = Number(transferInstruction.accounts[1]);
      const destinationAccount = tx.transaction.message.accountKeys[destinationAccountIndex];
      
      if (destinationAccount.pubkey !== RECEIVER_ADDRESS) {
        console.log(`Invalid receiver address: ${destinationAccount.pubkey}, expected: ${RECEIVER_ADDRESS}`);
        return null;
      }
      
      console.log(`Receiver address validated: ${destinationAccount.pubkey}`);
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
            // Convert base64 data to bytes
            const dataBytes = getBase64Encoder().encode(data);
            
            // Decode the transfer instruction data
            const decodedData = getTransferInstructionDataDecoder().decode(dataBytes);
            
            if (decodedData && decodedData.amount) {
              if ('accounts' in transferInstruction && transferInstruction.accounts && transferInstruction.accounts.length > 1) {
                const mintAccountIndex = Number(transferInstruction.accounts[1]);
                const mintAccount = tx.transaction.message.accountKeys[mintAccountIndex];
                
                // Check if this is actually a USDC transfer
                if (mintAccount && mintAccount.pubkey === USDC_MINT) {
                  console.log('USDC mint validated:', mintAccount.pubkey);
                  
                  // Parse the amount from decoded data
                  const amount = decodedData.amount;
                  amountUsdc = Number(amount) / Math.pow(10, 6); // Convert from smallest unit to USDC
                  
                  console.log(`USDC amount: ${amountUsdc} (raw: ${amount})`);
                } else {
                  console.log(`Invalid mint address: ${mintAccount?.pubkey}, expected USDC: ${USDC_MINT}`);
                  return null;
                }
              } else {
                console.log('No accounts found in transfer instruction');
                return null;
              }
            } else {
              console.log('Failed to decode transfer instruction data');
              return null;
            }
          }
        } else {
          console.log('No data found in transfer instruction');
          return null;
        }
      } catch (error) {
        console.error('Error decoding USDC transfer instruction:', error);
        return null;
      }
    } else if (transferInstruction.programId === SYSTEM_PROGRAM) {
      // SOL transfer
      try {
        if ('data' in transferInstruction && transferInstruction.data) {
          const data = transferInstruction.data;
          if (data && data.length >= 8) {
            // Decode the SOL transfer instruction data
            const dataBytes = getBase64Encoder().encode(data);
            const decodedData = getTransferSolInstructionDataDecoder().decode(dataBytes);
            
            if (decodedData && decodedData.amount) {
              amountUsdc = Number(decodedData.amount) / Math.pow(10, 9); // Convert from lamports to SOL
              console.log(`SOL amount: ${amountUsdc} (raw: ${decodedData.amount} lamports)`);
            } else {
              console.log('Failed to decode SOL transfer instruction data');
              return null;
            }
          }
        } else {
          console.log('No data found in SOL transfer instruction');
          return null;
        }
      } catch (error) {
        console.error('Error decoding SOL transfer instruction:', error);
        return null;
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
      console.log(`Amount too low: ${amountUsdc}, minimum required: 2`);
      return null;
    }
    
    return {
      walletAddress,
      amountUsdc,
      subscriptionDurationDays,
      transactionHash: signature,
    };
  } catch (error) {
    console.error('Error parsing subscription transaction from signature:', error);
    return null;
  }
}
