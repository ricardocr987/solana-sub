# Solana Subscription Service

<img width="1506" height="774" alt="image" src="https://github.com/user-attachments/assets/294bbabd-22b4-4ca2-8af3-4681e44e27a8" />


## 🎯 Overview

This project demonstrates how to build a secure subscription service that handles USDC payments on Solana. It features a three-phase transaction flow that keeps RPC keys secure while providing full user control over transactions.

**Key Features:**
- 🔐 **Secure Transaction Flow**: Build transactions on server, sign on client
- 🚀 **Modern Stack**: Elysia + Bun for both frontend and backend
- 🔗 **Type Safety**: Full-stack type safety with Eden integration
- 💰 **USDC Payments**: Handle real USDC transactions on Solana mainnet
- 📱 **Wallet Integration**: Seamless wallet connection with @solana/kit

## 📋 Prerequisites

Before you begin, ensure you have:

- **Bun**: https://bun.com/docs/installation
- A **Solana wallet** with some SOL and USDC as a user
- The address of the **RECEIVER** in the backend environment requires the USDC token account to be opened, so send some USDC there.
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
│                           │                │ 4. Confirm Transaction    │
│                           │ <── Tx Confirm │                           │
│ 5. Show Result            │                │ 5. Validate & Persist     │
└───────────────────────────┘                └───────────────────────────┘
```

## 🔄 Complete Transaction Flow

### 1. Connect Wallet
**Files:** `frontend/src/components/ConnectWallet.tsx`, `frontend/src/context/WalletContext.tsx`

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
**Files:** `frontend/src/components/PaymentButton.tsx`, `frontend/src/lib/api.ts`

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
**Files:** `backend/src/api/subscription.ts`, `backend/src/solana/transaction/prepare.ts`, `backend/src/solana/transaction/compute.ts`, `backend/src/solana/transaction/transferInstruction.ts`

**Key Features:**
- 🔍 **Validation**: Check USDC balance before transaction building and logs on the simulation
- 📊 **Metadata Enrichment**: Include metadata information about plans and the transaction
- 💸 **Priority Fee**: Dynamic priority fee estimation using Quicknode

```typescript
// Backend: src/api/subscription.ts
.post('/transaction', async ({ body: { account, amount: uiAmount } }) => {
    try {
        // 1. Validate user balance before building transaction
        await validateAmount(account, USDC_MINT, amount);
        
        // 2. Create USDC transfer instruction
        const paymentInstruction = await transferInstruction(
            signer,
            BigInt(amount) * BigInt(10 ** 6), // Convert to USDC decimals
            address(USDC_MINT),
            address(config.RECEIVER)
        );
        
        // 3. Prepare transaction with compute budget optimization
        const transaction = await prepareTransaction(
            [paymentInstruction],
            account
        );
        
        return { 
            transaction,
            amount: parseFloat(amount),
            metadata: { /* subscription plans, token info */ }
        };
    } catch (error) {
        return Response.json(
            { message: 'Failed to build subscription transaction' },
            { status: 500 }
        );
    }
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

**Error Handling:**
The system now provides specific error messages for different failure scenarios:

**Solana Transaction Log Compilation (`compute.ts`):**

```typescript
// Backend: src/solana/transaction/compute.ts
async function getComputeUnits(wireTransaction: Base64EncodedWireTransaction): Promise<number> {
  const simulation = await rpc.simulateTransaction(wireTransaction, {
    sigVerify: false,
    encoding: 'base64',
  }).send();

  if (simulation.value.err && simulation.value.logs) {
    // Early detection of insufficient funds
    const hasInsufficientFunds = simulation.value.logs.some(log => 
      log.includes('insufficient funds') || 
      log.includes('Error: insufficient funds')
    );
    
    if (hasInsufficientFunds) {
      throw new Error('Insufficient USDC balance for this transaction');
    }

    // Detailed log analysis for specific error patterns
    for (const log of simulation.value.logs) {
      if (log.includes('InvalidLockupAmount')) {
        throw new Error('Invalid staked amount: Should be > 1');
      }
      if (log.includes('0x1771') || log.includes('0x178c')) {
        throw new Error('Maximum slippage reached');
      }
      if (log.includes('insufficient funds')) {
        throw new Error('Insufficient USDC balance for this transaction');
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

**Priority Fee Estimation (`compute.ts`):**
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

**Compute Budget Instructions (`compute.ts`):**
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
**Files:** `frontend/src/components/PaymentButton.tsx`

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
    
    // Send for confirmation
    await api.confirm.transactions.post({
      transactions: [bs58.encode(Buffer.from(signedTransaction))],
      payments: [paymentData]
    });
  }, [account, params, signTransaction]);
}
```

### 5. Confirm Transaction
**Files:** `backend/src/api/confirm.ts`, `backend/src/solana/transaction/send.ts`

The backend confirms transactions with optimized RPC settings:

```typescript
// Backend: src/api/confirm.ts
.post('/transactions', async ({ body }) => {
  const { transactions, payments } = body;
  const results = [];
  
  for (let i = 0; i < transactions.length; i++) {
    try {
      // Send and confirm the transaction
      const signature = await sendTransaction(transaction);
      
      if (signature && payment) {
        // Store the payment
        await addPayment({ ...payment, status: 'confirmed' });
        
        // Update subscription if duration specified
        if (payment.subscription_duration_days) {
          const endDate = new Date(payment.payment_date);
          endDate.setDate(endDate.getDate() + payment.subscription_duration_days);
          await upsertSubscription(payment.wallet_address, endDate);
        }
      }
      
      results.push({ signature: signature || '', status: signature ? 'confirmed' : 'failed' });
    } catch (error) {
      results.push({ signature: '', status: 'failed' });
    }
  }
  
  return { signatures: results.map(r => r.signature), transactions: results };
})
```

**Transaction Sending with Polling Confirmation:**
```typescript
// Backend: src/solana/transaction/send.ts
export async function sendTransaction(transaction: string): Promise<string> {
  try {
    // 1. Send raw transaction with optimized RPC settings
    const signature = await sendRawTransaction(transaction, {
      encoding: 'base64',
      skipPreflight: true,        // Skip preflight for faster delivery
      maxRetries: 0n,             // Disable RPC retry queues
      preflightCommitment: 'confirmed'
    });
    
    console.log(`Transaction sent with signature: ${signature}`);
    
    // 2. Confirm the transaction using polling approach
    return await confirmSignature(signature);
  } catch (error) {
    console.error('Transaction failed:', error);
    throw new Error('Transaction failed');
  }
}
```

**Key Features:**
- ⚡ **Optimized RPC Settings**: Skip preflight for faster delivery
- 🔄 **Polling Confirmation**: Reliable confirmation using 500ms intervals
- ⏱️ **Timeout Handling**: 8-second timeout with automatic cleanup
- 📊 **Status Tracking**: Update payment status on failure

### 6. Validate & Persist
**Files:** `backend/src/solana/transaction/validate.ts`, `backend/src/db.ts`

The system validates transactions and persists subscription data:

```typescript
// Backend: src/solana/transaction/validate.ts
export async function validateTransactionFromSignature(
  signature: string,
  expectedAmount: number,
  expectedReceiver: string
): Promise<boolean> {
  try {
    const transaction = await connection.getTransaction(signature);
    
    // Verify transaction details
    if (!transaction?.meta?.postTokenBalances) return false;
    
    // Check amount and receiver
    // ... validation logic
    
    return true;
  } catch (error) {
    console.error('Transaction validation failed:', error);
    return false;
  }
}
```

**Database Schema:**
```sql
-- Payments table
CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_hash TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  amount_usdc REAL NOT NULL,
  payment_date DATETIME NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions table
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

```typescript
// Backend: src/config.ts
export const config = {
  QUICKNODE_RPC_URL: process.env.QUICKNODE_RPC_URL || 'https://api.mainnet-beta.solana.com',
  RECEIVER: process.env.RECEIVER || '',
  WEBHOOK_TOKEN: process.env.WEBHOOK_TOKEN || ''
};
```

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

## 📚 Next Steps

### Enhancements

1. **Webhook Integration**: Add Quicknode webhooks for real-time transaction confirmation
2. **Multi-Token Support**: Extend beyond USDC to other SPL tokens, swap ExactOut
3. **Analytics**: Implement transaction analytics and reporting
4. **Mobile App**: Build React Native version using the same backend

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
