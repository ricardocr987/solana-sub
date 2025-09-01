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
- The address of the **RECEIVER** in the backend environment requires the USDC token account to be opened

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

**Eden Benefits:**
- 🎯 **Auto-completion**: IDE support for all endpoints
- ✅ **Type Safety**: Compile-time error checking

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

### 3. Build Transaction

This is the entrypoint of the server to get the subscription transaction:

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

    // Prepare transaction using Solana Kit - return the encoded transaction
    const transaction = await prepareTransaction(
        [paymentInstruction],
        account,
    );

    return { 
        transaction,
        amount: parseFloat(amount),
        metadata: {
          ...
        }
    };
})
```

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

When we get the instruction, the transaction is prepared:

```typescript
// Backend: src/solana/prepare
export async function prepareTransaction(
  instructions: Instruction<string>[],
  feePayer: string,
): Promise<string> {
  // First, the system grabs the latest blockhash from the Solana network.
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  // Next, we calculate the compute budget from transaction simulation and Quicknode endpoint
  const finalInstructions = await getComputeBudget(
    instructions,
    feePayer,
    {},
    latestBlockhash
  );

  // Finally, everything gets assembled into a proper transaction message and base64 encoded for the response
  const payer = address(feePayer);
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    tx => setTransactionMessageFeePayer(payer, tx),
    tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    tx => appendTransactionMessageInstructions(finalInstructions, tx),
  );
  const compiledMessage = compileTransaction(message);
  return getBase64EncodedWireTransaction(compiledMessage).toString();
}
```

While balance validation happens early, the system also handles transaction simulation errors during compute budget preparation:

```typescript
// Backend: src/solana/transaction/compute.ts
async function getComputeUnits(wireTransaction: Base64EncodedWireTransaction): Promise<number> {
  const simulation = await rpc.simulateTransaction(wireTransaction, {
    sigVerify: false,
    encoding: 'base64',
  }).send();

  if (simulation.value.err && simulation.value.logs) {
    const hasInsufficientFunds = simulation.value.logs.some(log => 
      log.includes('insufficient funds') || 
      log.includes('Error: insufficient funds')
    );
    
    if (hasInsufficientFunds) {
      throw new Error('Insufficient USDC balance for this transaction');
    }

    // Handle other specific Solana program errors
    for (const log of simulation.value.logs) {
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


QuickNode API is used to get a priority fee estimate:

```typescript
async function getPriorityFeeEstimate(): Promise<number> {
  try {
    // Use QuickNode's getRecentPrioritizationFees RPC method
    const response = await fetch(config.QUICKNODE_RPC_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

    // Calculate average priority fee from recent blocks
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
```

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
  }, [account, params, signTransaction]);
}
```

### 5. Confirm Transaction

This endpoint handles confirmation of multiple transactions in parallel. After transactions are sent and confirmed on-chain, they undergo validation to verify they represent legitimate user payments to the recipient address. Once validated, payment records and subscription data are persisted to the database

```typescript
// Backend: src/api/confirm.ts
.post('/transactions', async ({ body }) => {
  try {
    const { transactions, payments } = body;
    // Process transactions in parallel for better performance
    const transactionPromises = transactions.map(async (transaction, i) => {      
      // Send and confirm the transaction using the simplified function
      const signature = await sendTransaction(transaction);
      
      if (signature && payment) {
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
        
        return {
          signature,
          status: 'confirmed',
        };
      }
    });

    // Wait for all transactions to complete
    const results = await Promise.all(transactionPromises);

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

**Transaction Sending and confirmation:**

[SendTransaction](https://www.quicknode.com/docs/solana/sendTransaction) rpc method is called with the optimal configuration and the base 64 encoded transaction

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

**Confirmation with Error Handling:**

The backend confirms transactions by polling the transaction with getTransaction RPC method, a better way would be using [signatureSubscribe](https://www.quicknode.com/docs/solana/signatureSubscribe) ws method:

```typescript
// Backend: src/solana/transaction/send.ts
async function confirmSignature(signature: Signature): Promise<string> {
  const MAX_RETRIES = 5;
  const RETRY_INTERVAL = 1000; // 1000ms between retries
  const TIMEOUT_DURATION = 6000; // 6 seconds total timeout
  
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

### 6. Validate & Persist

The system validates transactions, extracts payment details and determines subscription plans based on payment amounts:

```typescript
// Key validation functions and logic
export async function validateTransaction(
  signature: string,
  confirmedTransaction: any
): Promise<ValidatedSubscription> {
  // Check for duplicate payments
  const existingPayment = await getPaymentByTransactionHash(signature);
  if (existingPayment) {
    throw new Error('Payment already processed');
  }

  // Extract payment details from transaction metadata
  const paymentDetails = extractPaymentDetailsFromMeta(confirmedTransaction, signature);
  if (!paymentDetails) {
    throw new Error('Failed to extract payment details from transaction');
  }

  // Validate minimum amount (2 USDC)
  if (paymentDetails.amountUsdc < 2) {
    throw new Error(`Amount too low: ${paymentDetails.amountUsdc}, minimum required: 2`);
  }

  // Auto-determine subscription duration based on amount
  let subscriptionDurationDays = 30; // Default monthly
  
  if (paymentDetails.amountUsdc >= 100) {
    subscriptionDurationDays = 365; // Yearly subscription
  } else if (paymentDetails.amountUsdc >= 10) {
    subscriptionDurationDays = 30; // Monthly Pro II
  } else if (paymentDetails.amountUsdc >= 2) {
    subscriptionDurationDays = 30; // Monthly Pro I
  }

  // Determine plan type automatically
  const planType = getPlanTypeFromAmount(paymentDetails.amountUsdc, subscriptionDurationDays);

  // Store payment and update subscription
  const success = await addPayment({
    transaction_hash: signature,
    wallet_address: paymentDetails.walletAddress,
    amount_usdc: paymentDetails.amountUsdc,
    payment_date: new Date(),
    subscription_duration_days: subscriptionDurationDays,
    status: 'confirmed'
  });

  // Update subscription end date
  const subscriptionEndDate = new Date();
  subscriptionEndDate.setDate(subscriptionEndDate.getDate() + subscriptionDurationDays);
  
  await upsertSubscription(paymentDetails.walletAddress, subscriptionEndDate);

  return { /* subscription details */ };
}
```

**Automatic Plan Detection:**

The system automatically determines subscription plans based on payment amounts:

- **$2 USDC** → Monthly Pro I (30 days)
- **$10 USDC** → Monthly Pro II (30 days)  
- **$20 USDC** → Yearly Pro I (365 days)
- **$100 USDC** → Yearly Pro II (365 days)

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

## 📈 Performance Considerations

### Backend Optimization

- **Caching**: Strategic caching for frequently accessed data
- **Parallel Processing**: Concurrent transaction confirmation


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
