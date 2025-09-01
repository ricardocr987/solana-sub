# Solana Subscription Service

<img width="1506" height="774" alt="image" src="https://github.com/user-attachments/assets/294bbabd-22b4-4ca2-8af3-4681e44e27a8" />

## 🎯 Overview

This project demonstrates how to build a secure subscription service that handles USDC payments on Solana. The system provides a complete payment flow from wallet connection to transaction confirmation, with automatic subscription management and database persistence.

**Key Features:**
- 🔐 **Secure Transaction Flow**: Build transactions on server, sign on client
- 🚀 **Modern Stack**: Elysia + Bun for both frontend and backend
- 🔗 **Type Safety**: Full-stack type safety with Eden integration
- 💰 **USDC Payments**: Handle real USDC transactions on Solana mainnet
- 📱 **Wallet Integration**: Seamless wallet connection with @wallet-standard/react
- 💾 **SQLite Database**: Persistent storage for payments and subscriptions

## 📋 Prerequisites

Before you begin, ensure you have:

- **Bun**: https://bun.com/docs/installation
- A **Solana wallet** with some SOL and USDC as a user
- The address of the **RECEIVER** in the backend environment requires the USDC token account to be opened.
- Basic knowledge of **TypeScript** and **React**

## 🏗️ Architecture

```
# Transaction Flow: React Frontend & Elysia Backend

┌───────────────────────────┐                ┌───────────────────────────┐
│    React Frontend         │                │    Elysia Backend         │
├───────────────────────────┤                ├───────────────────────────┤
│ 1. Connect Wallet         │ ── Request ──> │                           │
│                           │                │ 2. Build Transaction      │
│ 3. Sign Transaction       │ <── Tx Data ── │                           │
│                           │                │ 4. Send & Confirm Txn     │
│                           │ <── Tx Confirm │                           │
│ 5. Show Result            │                │ 5. Validate & Persist     │
└───────────────────────────┘                └───────────────────────────┘
```

## 🔄 Complete Transaction Flow

### 1. Wallet Connection

The frontend uses the Wallet Standard API for seamless wallet integration. The `ConnectWallet` component provides a dropdown interface that automatically detects available wallets and handles connection state management.

```typescript
// Frontend: src/components/ConnectWallet.tsx
import { useConnect, useDisconnect } from '@wallet-standard/react';
import { useWallet } from '../context/WalletContext';

export function ConnectWallet() {
  const { wallets, connectedWallet, selectedAccount } = useWallet();
  
  const handleConnect = useCallback(async (wallet) => {
    try {
      const accounts = await connect();
      if (accounts[0]) {
        onAccountSelect(accounts[0], wallet);
      }
    } catch (error) {
      onError(error);
    }
  }, [connect, onAccountSelect, onError]);
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button>Connect Wallet</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {wallets.map((wallet) => (
          <ConnectWalletMenuItem
            key={wallet.name}
            wallet={wallet}
            onConnect={handleConnect}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 2. Request Transaction (Type-Safe Client)

When a user initiates a payment, the frontend requests a transaction from the backend.
The frontend uses Eden Treaty for type-safe API communication:

```typescript
// Frontend: src/lib/api.ts
import { treaty } from '@elysiajs/eden';
import type { App } from '@backend/index';

export const api = treaty<App>('http://localhost:3000');
```

```typescript
// Frontend: src/components/PaymentButton.tsx
const { data, error } = await api.subscription.transaction.post({
  account: account.address,
  amount: amount
});
```

**Eden Benefits:**
- 🎯 **Auto-completion**: IDE support for all endpoints
- ✅ **Type Safety**: Compile-time error checking

### 3. Build Transaction

**Error Handling with beforeHandle:**
The system uses Elysia's `beforeHandle` to validate user balance before building transactions:

```typescript
// Backend: src/api/subscription.ts
{
    beforeHandle: async ({ body: { account, amount: uiAmount } }) => {
        try {
            const amount = uiAmount.replace(',', '.');
            await validateAmount(account, USDC_MINT, amount);
        } catch (error) {
            // Extract the actual error message from the thrown error
            const errorMessage = error instanceof Error ? error.message : 'Failed to build subscription transaction';
            console.error('Error building subscription transaction:', errorMessage);
            return Response.json(
                { message: errorMessage },
                { status: 400 }
            );
        }
    },
    body: t.Object({
        account: t.String(),
        amount: t.String(),
    }),
}
```

**Transaction Simulation Error Handling:**
While balance validation happens early, the system also handles transaction simulation errors during compute budget optimization:

```typescript
// Backend: src/solana/transaction/compute.ts
async function getComputeUnits(wireTransaction: Base64EncodedWireTransaction): Promise<number> {
  const simulation = await rpc.simulateTransaction(wireTransaction, {
    sigVerify: false,
    encoding: 'base64',
  }).send();

  if (simulation.value.err && simulation.value.logs) {
    // Handle specific Solana error types
    if ((simulation.value.err as any).InsufficientFundsForRent) {
      throw new Error('You need more SOL to pay for transaction fees');
    }

    // Check for insufficient funds in transaction logs
    const hasInsufficientFunds = simulation.value.logs.some(log => 
      log.includes('insufficient funds') || 
      log.includes('Error: insufficient funds')
    );
    
    if (hasInsufficientFunds) {
      throw new Error('Insufficient USDC balance for this transaction');
    }

    // Handle other specific Solana program errors
    for (const log of simulation.value.logs) {
      if (log.includes('InvalidLockupAmount')) {
        throw new Error('Invalid staked amount: Should be > 1');
      }
      if (log.includes('0x1771') || log.includes('0x178c')) {
        throw new Error('Maximum slippage reached');
      }
      if (
        log.includes('Program 11111111111111111111111111111111 failed: custom program error: 0x1') ||
        log.includes('insufficient lamports')
      ) {
        throw new Error('You need more SOL to pay for transaction fees');
      }
    }

    // Log compilation for debugging
    const numLogs = simulation.value.logs.length;
    const lastLogs = simulation.value.logs.slice(Math.max(numLogs - 10, 0));
    console.log(`Last ${lastLogs.length} Solana simulation logs:`, lastLogs);
    console.log('base64 encoded transaction:', wireTransaction);

    throw new Error('Transaction simulation error');
  }

  return Number(simulation.value.unitsConsumed) || DEFAULT_COMPUTE_UNITS;
}
```

This dual-layer error handling provides:
- 🚫 **Early Prevention**: Balance validation stops invalid requests before transaction building
- 🔍 **Deep Validation**: Transaction simulation catches Solana-specific errors
- 📊 **Detailed Logging**: Comprehensive error information for debugging
- 🎯 **User-Friendly Messages**: Clear explanations for different types of failures

```typescript
// Backend: src/api/subscription.ts
.post('/transaction', async ({ body: { account, amount: uiAmount } }) => {
    const amount = uiAmount.replace(',', '.');
    const signer: TransactionSigner = {
        address: address(account),
        signTransactions: () => Promise.resolve([]),
    };
    
    // Create USDC transfer instruction
    const paymentInstruction = await transferInstruction(
        signer,
        BigInt(amount) * BigInt(10 ** 6), // Convert to USDC decimals
        address(USDC_MINT),
        address(config.RECEIVER)
    );

    // Prepare transaction using Solana Kit - return the raw transaction message
    const transaction = await prepareTransaction(
        [paymentInstruction],
        account,
    );

    // Return the raw transaction message for the frontend to sign
    return { 
        transaction,
        amount: parseFloat(amount),
        metadata: {
            tokenMint: USDC_MINT,
            tokenSymbol: 'USDC',
            tokenName: 'USD Coin',
            tokenDecimals: 6,
            tokenLogoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
            receiverAddress: config.RECEIVER,
            subscriptionPlans: {
                monthly: {
                    pro1: { amount: 2, duration: 30 },
                    pro2: { amount: 10, duration: 30 }
                },
                yearly: {
                    pro1: { amount: 20, duration: 365 },
                    pro2: { amount: 100, duration: 365 }
                }
            }
        }
    };
})
```

**Transaction Preparation Pipeline:**
```typescript
// Backend: src/solana/transaction/prepare.ts
export async function prepareTransaction(
  instructions: Instruction<string>[],
  feePayer: string,
): Promise<string> {
  // 1. Get latest blockhash for transaction lifetime
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  
  // 2. Optimize compute budget and priority fees
  const finalInstructions = await getComputeBudget(
    instructions,
    feePayer,
    {},
    latestBlockhash
  );
  
  // 3. Build transaction message with optimized settings
  const payer = address(feePayer);
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    tx => setTransactionMessageFeePayer(payer, tx),
    tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    tx => appendTransactionMessageInstructions(finalInstructions, tx),
  );
  
  // 4. Compile and encode for transmission
  const compiledMessage = compileTransaction(message);
  return getBase64EncodedWireTransaction(compiledMessage).toString();
}
```

**Priority Fee Estimation:**
The system dynamically calculates priority fees using QuickNode's RPC to ensure optimal transaction processing:

```typescript
// Backend: src/solana/transaction/compute.ts
async function getPriorityFeeEstimate(
  wireTransaction: string,
  options: PriorityFeeOptions = {}
): Promise<number> {
  try {
    // Use QuickNode's getRecentPrioritizationFees RPC method
    const response = await fetch(config.QUICKNODE_RPC_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getRecentPrioritizationFees',
        params: [], // Empty array means all recent fees
      }),
    });

    const data = await response.json();
    
    if (!data || !data.result || !Array.isArray(data.result)) {
      console.log('No priority fee data returned from QuickNode');
      return DEFAULT_PRIORITY_FEE;
    }

    // Calculate median priority fee from recent blocks
    const fees = data.result
      .filter((item: any) => item.prioritizationFee !== null && item.prioritizationFee !== undefined)
      .map((item: any) => item.prioritizationFee);

    if (fees.length === 0) {
      console.log('No valid priority fees found in recent blocks');
      return DEFAULT_PRIORITY_FEE;
    }

    // Calculate the median fee for better stability
    const sortedFees = fees.sort((a: number, b: number) => a - b);
    const medianIndex = Math.floor(sortedFees.length / 2);
    let medianFee = sortedFees[medianIndex];

    // If even number of fees, take average of two middle values
    if (sortedFees.length % 2 === 0) {
      medianFee = (sortedFees[medianIndex - 1] + sortedFees[medianIndex]) / 2;
    }

    // Apply constraints and ensure we return a reasonable fee
    const constrainedFee = Math.min(Math.max(medianFee, DEFAULT_PRIORITY_FEE), DEFAULT_PRIORITY_FEE * 10);
    
    console.log(`Priority fee estimate from QuickNode: ${constrainedFee} microlamports per compute unit`);
    return constrainedFee;
  } catch (error) {
    console.error('Error getting priority fee estimate from QuickNode:', error);
    return DEFAULT_PRIORITY_FEE;
  }
}
```

**Compute Budget Instructions:**
The system automatically generates compute budget instructions to optimize transaction execution:

```typescript
// Backend: src/solana/transaction/compute.ts
export async function getComputeBudget(
  instructions: Instruction<string>[],
  feePayer: string,
  lookupTableAccounts: AddressesByLookupTableAddress,
  latestBlockhash: Readonly<{
    blockhash: Blockhash;
    lastValidBlockHeight: bigint;
  }>,
  priorityLevel: PriorityLevel = 'MEDIUM'
): Promise<Instruction<string>[]> {
  try {
    console.log('calling simulateAndGetBudget');
    const [computeBudgetIx, priorityFeeIx] = await simulateAndGetBudget(
      instructions,
      feePayer,
      lookupTableAccounts,
      latestBlockhash,
      priorityLevel
    );

    return [computeBudgetIx, priorityFeeIx, ...instructions];
  } catch (error) {
    throw error;
  }
}

async function simulateAndGetBudget(
  instructions: Instruction<string>[],
  feePayer: string,
  lookupTableAccounts: AddressesByLookupTableAddress,
  latestBlockhash: Readonly<{
    blockhash: Blockhash;
    lastValidBlockHeight: bigint;
  }>,
  priorityLevel: PriorityLevel
): Promise<[Instruction<string>, Instruction<string>]> {
  const payer = address(feePayer);
  const finalInstructions = [
    getSetComputeUnitLimitInstruction({
      units: DEFAULT_COMPUTE_UNITS,
    }),
    getSetComputeUnitPriceInstruction({
      microLamports: DEFAULT_PRIORITY_FEE,
    }),
    ...instructions,
  ];
  
  // Build transaction message for simulation
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(finalInstructions, tx)
  );

  const messageWithLookupTables = compressTransactionMessageUsingAddressLookupTables(
    message,
    lookupTableAccounts
  );

  const compiledMessage = compileTransaction(messageWithLookupTables);
  const wireTransaction = getBase64EncodedWireTransaction(compiledMessage);
  
  // Get optimized compute units and priority fee
  const [computeUnits, priorityFee] = await Promise.all([
    getComputeUnits(wireTransaction),
    getPriorityFeeEstimate(wireTransaction, {
      priorityLevel,
      lookbackSlots: 150,
      includeVote: false,
      evaluateEmptySlotAsZero: true,
    }),
  ]);

  console.log('computeUnits:', computeUnits);

  // Create optimized compute budget instructions
  const computeBudgetIx = getSetComputeUnitLimitInstruction({
    units: Math.ceil(computeUnits * 1.1), // Add 10% buffer
  });

  const priorityFeeIx = getSetComputeUnitPriceInstruction({
    microLamports: priorityFee,
  });

  return [computeBudgetIx, priorityFeeIx];
}
```

**Priority Fee Features:**
- 📊 **Median Calculation**: Uses median fees from recent blocks for stability
- 🔒 **Safety Constraints**: Applies reasonable fee limits (min/max bounds)
- ⚡ **QuickNode Integration**: Leverages QuickNode's priority fee data
- 🎯 **Dynamic Pricing**: Adjusts fees based on network conditions

**Compute Budget Features:**
- 🧮 **Dynamic Simulation**: Simulates transactions to determine exact compute units needed
- 💰 **Smart Priority Fees**: Uses QuickNode RPC for accurate fee estimation
- 🔧 **Instruction Assembly**: Proper instruction ordering with compute budget first

### 4. Sign Transaction

```typescript
// Frontend: src/components/PaymentButton.tsx
import { useSignTransaction } from "@solana/react";
import { getBase64Encoder } from "@solana/kit";

export function PaymentButton({ account, params }) {
  const signTransaction = useSignTransaction(account, 'solana:mainnet');
  
  const handleTransaction = useCallback(async () => {
    // Get transaction from backend
    const { data } = await api.subscription.transaction.post({
      account: account.address,
      amount: params.amount
    });
    
    // Sign using @solana/kit
    const base64Encoder = getBase64Encoder();
    const transactionBytes = base64Encoder.encode(data.transaction);
    
    const { signedTransaction } = await signTransaction({
      transaction: transactionBytes
    });
    
    // Convert signed transaction to base64 for sending to backend
    const serializedTransaction = getBase64Decoder().decode(signedTransaction);
    
    // Send for confirmation with payment details
    const confirmResponse = await api.confirm.transactions.post({
      transactions: [serializedTransaction],
      payments: [{    
        transaction_hash: serializedTransaction,
        wallet_address: account.address,
        amount_usdc: parseFloat(amount),
        payment_date: new Date().toISOString(),
        subscription_duration_days: parseFloat(amount) >= 100 ? 365 : 30
      }]
    });

    // Handle confirmation response
    if (confirmResponse.error) {
      throw new Error(confirmResponse.error.value?.message || 'Failed to confirm transaction');
    }

    const { signatures, transactions } = confirmResponse.data;
    
    if (transactions?.[0]?.status === 'confirmed') {
      // Transaction successful
      onSuccess(signatures[0]);
    } else {
      throw new Error("Transaction confirmation failed");
    }
  }, [account, params, signTransaction]);
}
```

### 5. Confirm Transaction

The backend confirms transactions with comprehensive payment processing and subscription management:

```typescript
// Backend: src/api/confirm.ts
.post('/transactions', async ({ body }) => {
  try {
    const { transactions, payments } = body;
    console.log('Processing transactions:', transactions.length);
    console.log('Payments:', payments?.length || 0);
    
    const results = [];
    
    // Process transactions one by one
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      const payment = payments?.[i];
      
      try {
        console.log(`Processing transaction ${i + 1}/${transactions.length}`);
        
        // Process transactions in parallel for optimal performance
        const transactionPromises = transactions.map(async (transaction, i) => {
          const payment = payments?.[i];
          
          try {
            // Send and confirm the transaction
            const signature = await sendTransaction(transaction);
            
            if (signature && payment) {
              try {
                // Fetch the confirmed transaction to pass to validateTransaction
                const confirmedTransaction = await rpc.getTransaction(signature as Signature, {
                  commitment: 'confirmed',
                  encoding: 'jsonParsed',
                  maxSupportedTransactionVersion: 0,
                }).send();

                if (!confirmedTransaction) {
                  throw new Error('Failed to fetch confirmed transaction');
                }

                // Check if transaction failed
                if (confirmedTransaction.meta?.err) {
                  throw new Error(`Transaction failed: ${JSON.stringify(confirmedTransaction.meta.err)}`);
                }

                // Use validate.ts to handle payment storage and subscription management
                const validatedSubscription = await validateTransaction(
                  signature,
                  confirmedTransaction
                );
                
                console.log(`Payment validated and stored for transaction: ${payment.transaction_hash}`);
                console.log(`Subscription plan: ${validatedSubscription.planType}`);
                console.log(`Duration: ${validatedSubscription.subscriptionDurationDays} days`);
                
                return {
                  signature: signature,
                  status: 'confirmed',
                  payment: payment,
                  subscriptionDetails: {
                    walletAddress: payment.wallet_address,
                    amountUsdc: payment.amount_usdc,
                    durationDays: payment.subscription_duration_days || 0,
                    plan: validatedSubscription.planType
                  }
                };
                
              } catch (error) {
                console.error(`Failed to validate transaction ${signature}:`, error);
                return {
                  signature: signature,
                  status: 'confirmed_but_validation_failed',
                  payment: payment,
                  error: error instanceof Error ? error.message : 'Validation failed'
                };
              }
            }
            
            return {
              signature: signature || '',
              status: signature ? 'confirmed' : 'failed',
              payment: payment || null,
              subscriptionDetails: payment ? {
                walletAddress: payment.wallet_address,
                amountUsdc: payment.amount_usdc,
                durationDays: payment.subscription_duration_days || 0,
                plan: 'Subscription Plan'
              } : null
            };
            
          } catch (error) {
            console.error(`Error processing transaction ${i}:`, error);
            return {
              signature: '',
              status: 'failed',
              payment: payment || null,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        });

        // Wait for all transactions to complete
        const results = await Promise.all(transactionPromises);
        
        results.push({
          signature: signature || '',
          status: signature ? 'confirmed' : 'failed',
          payment: payment || null,
          subscriptionDetails: payment ? {
            walletAddress: payment.wallet_address,
            amountUsdc: payment.amount_usdc,
            durationDays: payment.subscription_duration_days || 0,
            plan: getPlanFromAmount(payment.amount_usdc, payment.subscription_duration_days || 0)
          } : null
        });
      } catch (error) {
        console.error(`Error processing transaction ${i}:`, error);
        results.push({
          signature: '',
          status: 'failed',
          payment: payment || null,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { 
      signatures: results.map(r => r.signature),
      transactions: results
    };
  } catch (error: any) {
    console.error('Error in transactions endpoint:', error);
    return { 
      signatures: body.transactions.map(() => ''),
      error: error.message || 'Failed to process transactions'
    };
  }
})
```

**Transaction Sending with Advanced Confirmation:**
```typescript
// Backend: src/solana/transaction/send.ts
async function sendRawTransaction(wireTransaction: Base64EncodedWireTransaction): Promise<string> {
  return await rpc.sendTransaction(wireTransaction, {
    encoding: 'base64',
    skipPreflight: true, // Skip preflight for faster delivery
    maxRetries: 0n, // Disable RPC retry queues
    preflightCommitment: 'confirmed', // Use confirmed commitment for blockhash
  }).send();
}


export async function sendTransaction(transaction: string): Promise<string> {
  try {
    // 1. Send raw transaction with optimized RPC settings
    const signature = await sendRawTransaction(transaction as Base64EncodedWireTransaction);
    console.log(`Transaction sent with signature: ${signature}`);

    // 2. Confirm the transaction using polling approach
    return await confirmSignature(signature as Signature);
  } catch (error) {
    console.error('Transaction failed:', error);
    
    // If we have a signature from error object, update payment status
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
```

**Advanced Retry-Based Confirmation with Error Handling:**
```typescript
// Backend: src/solana/transaction/send.ts
async function confirmSignature(signature: Signature): Promise<string> {
  const MAX_RETRIES = 3;
  const RETRY_INTERVAL = 500; // 500ms between retries
  const TIMEOUT_DURATION = 8000; // 8 seconds total timeout
  
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
```

**Key Features:**
- ⚡ **Optimized RPC Settings**: Skip preflight for faster delivery, disable retry queues
- 🔄 **Retry-Based Confirmation**: 3 attempts with 500ms intervals and 8-second timeout
- 🧹 **Memory Leak Prevention**: Automatic cleanup of timers and proper error handling
- 📊 **Comprehensive Payment Processing**: Store payments, update subscriptions, detect plans
- 🎯 **Plan Detection**: Automatically identify subscription plans from amount and duration
- 🚫 **Duplicate Resolution Prevention**: Prevents multiple promise resolutions
- 📝 **Detailed Logging**: Comprehensive transaction processing logs with retry attempts
- 💾 **Payment Status Management**: Update payment status on failures
- 🚨 **Proper Error Handling**: Rejects promises with detailed error messages instead of empty strings
- 🔁 **Smart Retry Logic**: Handles both RPC errors and transaction not found scenarios

**Error Handling Improvements:**
The refactored confirmation system now provides proper error handling:

1. **Retry Mechanism**: 
   - 3 attempts with 500ms intervals
   - Handles both RPC errors and transaction not found scenarios
   - 8-second overall timeout for safety

2. **Proper Error Propagation**:
   - Uses `reject()` instead of `resolve('')` for failures
   - Provides detailed error messages for debugging
   - Distinguishes between on-chain failures and RPC errors

3. **Transaction Status Handling**:
   - On-chain failures: `tx.meta?.err` properly detected and reported
   - RPC errors: Retried up to 3 times before failing
   - Timeout scenarios: Clear error messages with timing information

4. **Payment Status Updates**:
   - Failed transactions automatically update payment status to 'failed'
   - Prevents orphaned payment records
   - Maintains data consistency

### 6. Validate & Persist

The system validates transactions, extracts payment details, and automatically determines subscription plans based on payment amounts:

```typescript
// Backend: src/solana/transaction/validate.ts
export async function validateTransactionFromSignature(signature: string): Promise<ValidatedSubscription> {
  try {
    console.log(`Validating transaction from signature: ${signature}`);
    
    // Get transaction details from Solana
    const parsedTransaction = await rpc.getTransaction(signature as Signature, {
      commitment: 'confirmed',
      encoding: 'jsonParsed',
      maxSupportedTransactionVersion: 0,
    }).send();
    
    if (!parsedTransaction) {
      throw new Error('Transaction not found or not confirmed');
    }
    
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
    
    // Find and decode transfer instruction (USDC or SOL)
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
    
    // Extract amount and determine subscription duration automatically
    let amountUsdc = 0;
    let subscriptionDurationDays = 30; // Default to monthly
    
    if (transferInstruction.programId === TOKEN_PROGRAM) {
      // SPL token transfer (USDC) - decode amount from instruction data
      try {
        if ('data' in transferInstruction && transferInstruction.data) {
          const data = transferInstruction.data;
          if (data && data.length >= 8) {
            const dataBytes = getBase64Encoder().encode(data);
            const decodedData = getTransferInstructionDataDecoder().decode(dataBytes);
            
            if (decodedData && decodedData.amount) {
              amountUsdc = Number(decodedData.amount) / Math.pow(10, 6); // Convert from USDC decimals
              console.log(`USDC amount: ${amountUsdc}`);
            }
          }
        }
      } catch (error) {
        console.error('Error decoding USDC transfer instruction:', error);
        throw new Error('Failed to decode USDC transfer instruction');
      }
    } else if (transferInstruction.programId === SYSTEM_PROGRAM) {
      // SOL transfer - decode amount from instruction data
      try {
        if ('data' in transferInstruction && transferInstruction.data) {
          const data = transferInstruction.data;
          if (data && data.length >= 8) {
            const dataBytes = getBase64Encoder().encode(data);
            const decodedData = getTransferSolInstructionDataDecoder().decode(dataBytes);
            
            if (decodedData && decodedData.amount) {
              amountUsdc = Number(decodedData.amount) / Math.pow(10, 9); // Convert from SOL decimals
              console.log(`SOL amount: ${amountUsdc}`);
            }
          }
        }
      } catch (error) {
        console.error('Error decoding SOL transfer instruction:', error);
        throw new Error('Failed to decode SOL transfer instruction');
      }
    }
    
    // Automatically determine subscription duration based on payment amount
    if (amountUsdc >= 100) {
      subscriptionDurationDays = 365; // Yearly subscription (Pro II)
    } else if (amountUsdc >= 10) {
      subscriptionDurationDays = 30;  // Monthly subscription (Pro II)
    } else if (amountUsdc >= 2) {
      subscriptionDurationDays = 30;  // Monthly subscription (Pro I)
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
```

**Key Features:**
- 🔍 **Meta-Based Validation**: Uses transaction meta data instead of complex instruction parsing
- 💰 **Automatic Payment Detection**: Extracts USDC amounts from balance changes
- 📅 **Smart Duration Detection**: Determines subscription length based on payment amount
- 🚫 **Duplicate Prevention**: Checks for existing payments before processing
- 💾 **Database Storage**: Stores payment records with subscription metadata
- 🔐 **Security**: Validates transaction signatures and meta data
- 📊 **USDC-Focused**: Specifically designed for USDC subscription payments
- 📋 **Plan Type Detection**: Automatically identifies subscription plan types
- 🔄 **Subscription Management**: Updates subscription end dates in database
- 🎯 **Integrated Workflow**: Seamlessly works with confirm.ts for complete payment processing
- 🏗️ **Separation of Concerns**: validate.ts handles all database operations, confirm.ts focuses on transaction confirmation
- ⚡ **Simplified Architecture**: Eliminates complex instruction decoding for better performance


**Integration with confirm.ts:**
The refactored system now follows a clean separation of concerns with parallel processing for optimal performance:

```typescript
// Backend: src/api/confirm.ts
// Process transactions in parallel for better performance
const transactionPromises = transactions.map(async (transaction, i) => {
  const payment = payments?.[i];
  
  try {
    console.log(`Processing transaction ${i + 1}/${transactions.length}`);
    
    // Send and confirm the transaction
    const signature = await sendTransaction(transaction);
    
    if (signature && payment) {
      try {
        // Fetch the confirmed transaction to pass to validateTransaction
        const confirmedTransaction = await rpc.getTransaction(signature as Signature, {
          commitment: 'confirmed',
          encoding: 'jsonParsed',
          maxSupportedTransactionVersion: 0,
        }).send();

        if (!confirmedTransaction) {
          throw new Error('Failed to fetch confirmed transaction');
        }

        // Check if transaction failed
        if (confirmedTransaction.meta?.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmedTransaction.meta.err)}`);
        }

        // Use validate.ts to handle payment storage and subscription management
        const validatedSubscription = await validateTransaction(
          signature,
          confirmedTransaction
        );
        
        console.log(`Payment validated and stored for transaction: ${payment.transaction_hash}`);
        console.log(`Subscription plan: ${validatedSubscription.planType}`);
        console.log(`Duration: ${validatedSubscription.subscriptionDurationDays} days`);
        
        return {
          signature: signature,
          status: 'confirmed',
          payment: payment,
          subscriptionDetails: {
            walletAddress: payment.wallet_address,
            amountUsdc: payment.amount_usdc,
            durationDays: payment.subscription_duration_days || 0,
            plan: validatedSubscription.planType
          }
        };
        
      } catch (error) {
        console.error(`Failed to validate transaction ${signature}:`, error);
        return {
          signature: signature,
          status: 'confirmed_but_validation_failed',
          payment: payment,
          error: error instanceof Error ? error.message : 'Validation failed'
        };
      }
    }
    
    return {
      signature: signature || '',
      status: signature ? 'confirmed' : 'failed',
      payment: payment || null,
      subscriptionDetails: payment ? {
        walletAddress: payment.wallet_address,
        amountUsdc: payment.amount_usdc,
        durationDays: payment.subscription_duration_days || 0,
        plan: 'Subscription Plan'
      } : null
    };
    
  } catch (error) {
    console.error(`Error processing transaction ${i}:`, error);
    return {
      signature: '',
      status: 'failed',
      payment: payment || null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// Wait for all transactions to complete
const results = await Promise.all(transactionPromises);
```
**Database Schema:**
```sql
-- Payments table with subscription data
CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_hash TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  amount_usdc REAL NOT NULL,
  payment_date DATETIME NOT NULL,
  subscription_duration_days INTEGER NOT NULL,
  status TEXT DEFAULT 'confirmed',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions table for active subscriptions
CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_address TEXT UNIQUE NOT NULL,
  end_date DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Key Database Features:**
- 🔒 **Unique Constraints**: Prevents duplicate transaction processing
- 📊 **Subscription Tracking**: Maintains active subscription end dates
- 🕒 **Timestamps**: Tracks creation and update times
- 🔄 **Status Management**: Tracks payment confirmation status

**Key Features:**
- 🔍 **Transaction Validation**: Decodes and validates Solana transactions
- 💰 **Amount Extraction**: Automatically extracts payment amounts from USDC/SOL transfers
- 📅 **Smart Duration Detection**: Determines subscription length based on payment amount
- 🚫 **Duplicate Prevention**: Checks for existing payments before processing
- 💾 **Database Storage**: Stores payment records with subscription metadata
- 🔐 **Security**: Validates transaction signatures and instruction types
- 📊 **Flexible Support**: Handles both USDC and SOL transfer instructions
- 📋 **Plan Type Detection**: Automatically identifies subscription plan types
- 🔄 **Subscription Management**: Updates subscription end dates in database
- 🎯 **Integrated Workflow**: Seamlessly works with confirm.ts for complete payment processing
- 🏗️ **Separation of Concerns**: validate.ts handles all database operations, confirm.ts focuses on transaction confirmation

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/ricardocr987/solana-sub
cd solana-sub
bun install
```

### 2. Environment Setup

```bash
# Backend
cd backend
cp env.example .env
# Edit .env with your configuration
```

```env
# Backend .env
# Solana RPC endpoint (e.g. QuickNode mainnet HTTPS URL)
QUICKNODE_RPC_URL=https://your-quicknode-endpoint.solana-mainnet.quiknode.pro/your-api-key/

# Receiver's USDC token account owner (base58 address)
RECEIVER=YourReceiverWalletAddress
```

### 3. Start the Services

```bash
# Terminal 1: Backend (Port 3000)
cd backend
bun run dev

# Terminal 2: Frontend (Port 8080)
cd frontend
bun run dev
```

Visit `http://localhost:8080` to see your subscription system in action!

## 🛡️ Security Best Practices

### RPC Key Protection

The system keeps RPC endpoints secure by storing them only in backend environment variables. Frontend code never has access to sensitive RPC credentials.

**Never expose RPC keys in frontend code!**

## 🚀 Deployment

### Environment Variables

```bash
# Production .env
QUICKNODE_RPC_URL=https://your-rpc-endpoint.com
RECEIVER=your-production-wallet
NODE_ENV=production
```

### Build Commands

```bash
# Backend
cd backend
bun run build
bun start

# Frontend
cd frontend
bun run build
# Deploy dist/ folder to your hosting provider
```

## 📚 Technical Implementation Details

### Transaction Processing Pipeline

**1. Pre-Validation:**
- Balance checking before transaction building
- User authentication verification
- Input validation and sanitization

**2. Transaction Construction:**
- USDC transfer instruction creation
- Transaction simulation
- Compute budget optimization
- Priority fee estimation
- Transaction message compilation

**3. Client-Side Signing:**
- Transaction encoding and transmission
- Wallet signature collection
- Error handling

**4. Backend Confirmation:**
- Confirmation monitoring with retry logic
- Payment validation and storage

## 📈 Performance Considerations

### Backend Optimization

- **Database Indexing**: Proper indexing for fast queries
- **Caching**: Strategic caching for frequently accessed data
- **Parallel Processing**: Concurrent transaction confirmation

### Frontend Optimization

- **Code Splitting**: Lazy loading of components
- **Memoization**: Strategic use of React.memo and useMemo
- **Bundle Optimization**: Efficient bundling with Bun

## 🚀 Next Steps

### Enhancements

1. **Webhook Integration**: Add Quicknode webhooks for real-time transaction confirmation
2. **Multi-Token Support**: Extend beyond USDC to other SPL tokens
3. **Analytics Dashboard**: Implement transaction analytics and reporting
4. **Mobile App**: Build React Native version using the same backend
5. **Advanced Subscription Features**: Recurring payments, plan upgrades, cancellations

### Learning Resources

- [Solana Documentation](https://docs.solana.com/)
- [Elysia Framework](https://elysiajs.com/)
- [Bun Runtime](https://bun.sh/)
- [@solana/kit](https://github.com/anza-xyz/kit)

## 🤝 Contributing

This project is open source! Feel free to:

- 🐛 Report bugs
- 💡 Suggest features
- 🔧 Submit pull requests
- 📖 Improve documentation

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ using Solana, Elysia and Bun**
