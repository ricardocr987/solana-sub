# Subscription System Demo: Building a Solana-Powered Subscription Service

> **A complete guide to building a subscription system on Solana with end-to-end type safety, secure transaction handling, and modern web technologies.**

## 🎯 Overview

This project demonstrates how to build a production-ready subscription system on Solana using cutting-edge technologies. You'll learn how to create a secure, scalable subscription service that handles USDC payments, manages user subscriptions, and provides a seamless developer experience.

**Key Features:**
- 🔐 **Secure Transaction Flow**: Build and confirm transactions on the server, sign them on the react client. Keep your RPC keys secure on the server.
- 🚀 **Modern Stack**: Elysia + Bun for both frontend and backend
- 🔗 **Type Safety**: Full-stack type safety with Eden integration
- 💰 **USDC Payments**: Handle real USDC transactions on Solana mainnet
- 📱 **Wallet Integration**: Seamless wallet connection with @solana/kit

## 📁 Project Structure

```
solana-sub/
├── backend/                          # Elysia + Bun backend server
│   ├── src/
│   │   ├── api/                     # API endpoints
│   │   │   ├── confirm.ts           # Transaction confirmation endpoint
│   │   │   ├── subscription.ts      # Subscription transaction building
│   │   │   └── user.ts              # User management endpoints
│   │   ├── solana/                  # Solana-specific functionality
│   │   │   ├── getTokenBalance.ts   # Token balance checking
│   │   │   ├── getTokenMetadata.ts  # Token metadata retrieval
│   │   │   ├── rpc.ts               # RPC connection setup
│   │   │   └── transaction/         # Transaction handling
│   │   │       ├── compute.ts       # Compute budget optimization
│   │   │       ├── confirm.ts       # WebSocket confirmation setup
│   │   │       ├── prepare.ts       # Transaction preparation
│   │   │       ├── send.ts          # Transaction sending & confirmation
│   │   │       ├── transferInstruction.ts # USDC transfer instruction
│   │   │       └── validate.ts      # Transaction validation
│   │   ├── config.ts                # Environment configuration
│   │   ├── db.ts                    # Database operations
│   │   └── index.ts                 # Main server entry point
│   ├── package.json                 # Backend dependencies
│   ├── bun.lock                     # Bun lock file
│   ├── tsconfig.json                # TypeScript configuration
│   ├── env.example                  # Environment variables template
│   └── subscriptions.db             # SQLite database
├── frontend/                        # React + Bun frontend
│   ├── src/
│   │   ├── components/              # React components
│   │   │   ├── ui/                  # Shadcn/ui components
│   │   │   ├── ConnectWallet.tsx    # Wallet connection component
│   │   │   ├── PaymentButton.tsx    # Payment processing component
│   │   │   ├── PricingCard.tsx      # Subscription plan display
│   │   │   ├── PricingPage.tsx      # Main pricing page
│   │   │   └── TransactionHistory.tsx # Transaction history display
│   │   ├── context/                 # React context providers
│   │   │   ├── ChainContext.tsx     # Solana chain configuration
│   │   │   ├── RpcContext.tsx       # RPC endpoint management
│   │   │   ├── SolanaProvider.tsx   # Solana provider wrapper
│   │   │   ├── TransactionToastContext.tsx # Transaction status toasts
│   │   │   └── WalletContext.tsx    # Wallet state management
│   │   ├── hooks/                   # Custom React hooks
│   │   │   ├── useToast.ts          # Toast notification hook
│   │   │   └── useUserPlan.ts       # User subscription plan hook
│   │   ├── lib/                     # Utility libraries
│   │   │   ├── api.ts               # Eden API client
│   │   │   ├── rpc.ts               # RPC utility functions
│   │   │   └── utils.ts             # General utility functions
│   │   ├── types/                   # TypeScript type definitions
│   │   │   └── api.ts               # API response types
│   │   ├── utils/                   # Configuration utilities
│   │   │   ├── config.ts            # Frontend configuration
│   │   │   └── constants.ts         # Application constants
│   │   ├── App.tsx                  # Main application component
│   │   ├── frontend.tsx             # Frontend entry point
│   │   ├── index.css                # Global styles
│   │   ├── index.html               # HTML template
│   │   └── server.ts                # Bun development server
│   ├── package.json                 # Frontend dependencies
│   ├── bun.lock                     # Bun lock file
│   ├── tsconfig.json                # TypeScript configuration
│   ├── build.ts                     # Build configuration
│   ├── bunfig.toml                  # Bun configuration
│   ├── components.json              # Shadcn/ui configuration
│   └── styles/                      # Additional stylesheets
│       └── globals.css              # Global CSS styles
├── package.json                     # Monorepo root configuration
└── tsconfig.base.json              # Base TypeScript configuration
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐
│   React Frontend│    │   Elysia Backend │
│                 │    │                  │
│ • Wallet Connect│◄──►│ • Build Tx       │
│ • Sign Tx       │    │ • Validate       │
│ • Eden Client   │    │ • Send & Confirm │
└─────────────────┘    └──────────────────┘
```

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** or **Bun 1.0+** (recommended)
- **Solana CLI** tools installed
- A **Solana wallet** with some SOL for transaction fees
- **USDC tokens** in your wallet for testing
- Basic knowledge of **TypeScript** and **React**

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
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
RECEIVER=your-wallet-address
WEBHOOK_TOKEN=your-secret-token
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

## 🔄 Transaction Flow: The Complete Journey

The subscription system implements a **three-phase transaction flow** that ensures security and reliability:

### Phase 1: Server-Side Transaction Building

```typescript
// Backend: src/api/subscription.ts
.post('/transaction', async ({ body: { account, amount } }) => {
    // 1. Validate user balance
    const balance = await validateAmount(account, USDC_MINT, amount);
    
    // 2. Create transfer instruction
    const paymentInstruction = await transferInstruction(
        signer,
        BigInt(amount) * BigInt(10 ** 6), // Convert to USDC decimals
        address(USDC_MINT),
        address(config.RECEIVER)
    );
    
    // 3. Prepare transaction
    const transaction = await prepareTransaction(
        [paymentInstruction],
        account
    );
    
    // 4. Return raw transaction for client signing
    return { transaction, amount, metadata };
})
```

**Why build on the server?**
- 🔒 **RPC Key Protection**: Keep your Solana RPC endpoint secure
- 🛡️ **Validation**: Server-side balance and amount validation
- 📊 **Analytics**: Track transaction attempts and user behavior
- 🔄 **Consistency**: Ensure all transactions follow the same format

### Phase 2: Client-Side Transaction Signing

```typescript
// Frontend: src/components/PaymentButton.tsx
const handleTransaction = useCallback(async () => {
    try {
        // 1. Get transaction from backend
        const { data } = await api.subscription.transaction.post({
            account: account.address,
            amount: amount
        });
        
        // 2. Sign the transaction
        const { signedTransaction } = await signTransaction({
            transaction: data.transaction
        });
        
        // 3. Serialize for backend confirmation
        const serializedTransaction = bs58.encode(
            Buffer.from(signedTransaction)
        );
        
        // 4. Send for confirmation
        const confirmResponse = await api.confirm.transactions.post({
            transactions: [serializedTransaction],
            payments: [paymentData]
        });
        
        onSuccess(confirmResponse.data.signatures[0]);
    } catch (error) {
        onError(error.message);
    }
}, [account, amount, signTransaction]);
```

**Benefits of client-side signing:**
- 🔐 **Security**: Private keys never leave the user's wallet
- 💨 **Performance**: No need to send private keys to the server
- 🎯 **User Control**: Users maintain full control over their transactions

### Phase 3: Server-Side Transaction Confirmation

```typescript
// Backend: src/api/confirm.ts
.post('/transactions', async ({ body }) => {
    const { transactions, payments } = body;
    
    for (let i = 0; i < transactions.length; i++) {
        try {
            // 1. Send transaction to Solana network
            const signature = await sendTransaction(transaction);
            
            // 2. Store payment record
            await addPayment({
                ...payment,
                status: 'confirmed'
            });
            
            // 3. Update subscription
            if (payment.subscription_duration_days) {
                await upsertSubscription(
                    payment.wallet_address,
                    subscriptionEndDate
                );
            }
            
            results.push({ signature, status: 'confirmed' });
        } catch (error) {
            results.push({ signature: '', status: 'failed', error });
        }
    }
    
    return { signatures: results.map(r => r.signature), transactions: results };
})
```

**Server-side confirmation advantages:**
- 📡 **Network Handling**: Manage RPC connections and retries
- 💾 **Data Persistence**: Store transaction records and subscription data
- 🔍 **Monitoring**: Track transaction success/failure rates
- 🚀 **Scalability**: Handle multiple transactions efficiently

## 🚀 Elysia + Bun: The Modern Stack

### Why Elysia?

Elysia is a **lightning-fast** web framework built for Bun with:

- ⚡ **Performance**: Up to 10x faster than Express
- 🔒 **Type Safety**: Built-in TypeScript support with validation
- 🎯 **Developer Experience**: Intuitive API design
- 🌐 **Modern Features**: WebSocket support, CORS, compression

### Why Bun?

Bun is a **JavaScript runtime** that provides:

- 🚀 **Speed**: Faster than Node.js for most operations
- 📦 **Built-in Tools**: Package manager, bundler, test runner
- 🔧 **Native APIs**: SQLite, Redis, Postgres support
- 💾 **Memory Efficiency**: Lower memory usage than Node.js

### Backend Implementation

```typescript
// Backend: src/index.ts
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

const app = new Elysia()
  .use(cors({
    origin: ['http://localhost:8080'],
    credentials: true
  }))
  .onRequest((ctx) => {
    console.log('🚀 Request received:', ctx.request.method, ctx.request.url);
  })
  .mapResponse(({ response, set }) => {
    // Automatic gzip compression
    const encodedText = new TextEncoder().encode(JSON.stringify(response));
    const gzippedData = Bun.gzipSync(encodedText);
    
    return new Response(gzippedData, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  })
  .use(subscription)
  .use(confirm)
  .listen(3000);

export type App = typeof app;
```

### Frontend Implementation

```typescript
// Frontend: src/server.ts
import { serve } from "bun";
import index from "./index.html";

serve({
  routes: {
    "/": index,
  },
  development: {
    hmr: true,
    console: true
  }
});
```

## 🔗 Eden Integration: End-to-End Type Safety

Eden provides **full-stack type safety** without code generation:

### Backend Type Export

```typescript
// Backend: src/index.ts
export type App = typeof app;
```

### Frontend Type-Safe Client

```typescript
// Frontend: src/lib/api.ts
import { treaty } from '@elysiajs/eden';
import type { App } from '@backend/index';

const api = treaty<App>('http://localhost:3000');

// Now all API calls are fully typed!
export { api };
```

### Usage Examples

```typescript
// Type-safe subscription transaction
const { data, error } = await api.subscription.transaction.post({
  account: 'wallet-address',
  amount: '49'
});

// Type-safe confirmation
const confirmResponse = await api.confirm.transactions.post({
  transactions: [serializedTransaction],
  payments: [paymentData]
});

// Full autocomplete and type checking
if (error) {
  // error.value is fully typed
  console.log(error.value?.message);
}
```

**Benefits of Eden:**
- 🎯 **Auto-completion**: IDE support for all endpoints
- ✅ **Type Safety**: Compile-time error checking
- 🔄 **Real-time Updates**: Types update when backend changes
- 🚫 **No Code Generation**: Pure TypeScript inference

## 🔄 Transaction Preparation & Compute Budget Management

The subscription system implements a sophisticated transaction preparation pipeline that optimizes compute units and priority fees for maximum efficiency:

### Transaction Building (`subscription.ts`)

```typescript
// Backend: src/api/subscription.ts
.post('/transaction', async ({ body: { account, amount: uiAmount } }) => {
    try {
        // 1. Validate user balance before building transaction
        const balance = await validateAmount(account, USDC_MINT, amount);
        if (!balance.isValid) {
            return Response.json({ message: balance.message }, { status: 400 });
        }
        
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
        
        // 4. Return transaction with metadata for client
        return { 
            transaction,
            amount: parseFloat(amount),
            metadata: {
                tokenMint: USDC_MINT,
                tokenSymbol: 'USDC',
                subscriptionPlans: {
                    monthly: { pro1: { amount: 2, duration: 30 } },
                    yearly: { pro1: { amount: 20, duration: 365 } }
                }
            }
        };
    } catch (error) {
        console.error('Error building subscription transaction:', error);
        return Response.json(
            { message: 'Failed to build subscription transaction' },
            { status: 500 }
        );
    }
})
```

**Key Features:**
- 🔍 **Pre-validation**: Check USDC balance before transaction building
- 💰 **USDC Support**: Handle 6-decimal USDC transfers
- 📊 **Metadata Enrichment**: Include subscription plan information
- 🛡️ **Error Handling**: Comprehensive error handling and logging

### Transaction Preparation (`prepare.ts`)

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

**Preparation Benefits:**
- ⏰ **Fresh Blockhash**: Always use latest blockhash for validity
- 🧮 **Compute Optimization**: Automatic compute unit calculation
- 💸 **Priority Fee Management**: Dynamic priority fee estimation
- 🔧 **Instruction Assembly**: Proper instruction ordering and validation

### Compute Budget Optimization (`compute.ts`)

```typescript
// Backend: src/solana/transaction/compute.ts
export async function getComputeBudget(
  instructions: Instruction<string>[],
  feePayer: string,
  lookupTableAccounts: AddressesByLookupTableAddress,
  latestBlockhash: Blockhash,
  priorityLevel: PriorityLevel = 'MEDIUM'
): Promise<Instruction<string>[]> {
  
  // 1. Simulate transaction to determine compute units needed
  const [computeBudgetIx, priorityFeeIx] = await simulateAndGetBudget(
    instructions,
    feePayer,
    lookupTableAccounts,
    latestBlockhash,
    priorityLevel
  );
  
  // 2. Return optimized instructions with compute budget
  return [computeBudgetIx, priorityFeeIx, ...instructions];
}

// Priority fee estimation using QuickNode RPC
async function getPriorityFeeEstimate(
  wireTransaction: string,
  options: PriorityFeeOptions = {}
): Promise<number> {
  try {
    // Use QuickNode's getRecentPrioritizationFees for accurate fee estimation
    const response = await fetch(config.QUICKNODE_RPC_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getRecentPrioritizationFees',
        params: [],
      }),
    });
    
    const data = await response.json();
    
    // Calculate median fee from recent blocks for stability
    const fees = data.result
      .filter((item: any) => item.prioritizationFee !== null)
      .map((item: any) => item.prioritizationFee);
    
    const sortedFees = fees.sort((a: number, b: number) => a - b);
    const medianIndex = Math.floor(sortedFees.length / 2);
    let medianFee = sortedFees[medianIndex];
    
    // Apply constraints for reasonable fee range
    const constrainedFee = Math.min(
      Math.max(medianFee, DEFAULT_PRIORITY_FEE), 
      DEFAULT_PRIORITY_FEE * 10
    );
    
    return constrainedFee;
  } catch (error) {
    console.error('Error getting priority fee estimate:', error);
    return DEFAULT_PRIORITY_FEE;
  }
}
```

**Compute Budget Features:**
- 🧮 **Dynamic Simulation**: Simulate transactions to determine exact compute units needed
- 💰 **Smart Priority Fees**: Use QuickNode RPC for accurate fee estimation
- 📊 **Median Calculation**: Calculate median fees from recent blocks for stability
- 🔒 **Safety Constraints**: Apply reasonable fee limits (min/max bounds)
- ⚡ **Performance Optimization**: Add 10% buffer to computed units for reliability

### Priority Levels & Fee Management

```typescript
export const PRIORITY_LEVELS = {
  MIN: 'Min',
  LOW: 'Low', 
  MEDIUM: 'Medium',    // Default
  HIGH: 'High',
  VERY_HIGH: 'VeryHigh',
  UNSAFE_MAX: 'UnsafeMax',
} as const;

// Default settings for reliable transactions
const DEFAULT_COMPUTE_UNITS = 1_400_000;
const DEFAULT_PRIORITY_FEE = 50000; // 50,000 microlamports per compute unit
```

### Transaction Pipeline Flow

```
1. Validate Balance → 2. Create Instructions → 3. Simulate Transaction → 4. Optimize Budget
     ↓                      ↓                      ↓                      ↓
  USDC Check           Transfer Instruction    Compute Units         Priority Fees
  (Pre-flight)         (USDC → Receiver)      (Simulation)          (QuickNode RPC)
  
5. Build Message → 6. Compile Transaction → 7. Encode & Return
     ↓                      ↓                      ↓
  Blockhash + Fees      Binary Format         Base64 String
  (Latest)              (Optimized)          (Client Ready)
```

### Error Handling & Validation

```typescript
// Comprehensive simulation error handling
if (simulation.value.err && simulation.value.logs) {
  if ((simulation.value.err as any).InsufficientFundsForRent) {
    throw new Error('You need more SOL to pay for transaction fees');
  }
  
  // Check for specific program errors
  for (const log of simulation.value.logs) {
    if (log.includes('InvalidLockupAmount')) {
      throw new Error('Invalid staked amount: Should be > 1');
    }
    if (log.includes('0x1771') || log.includes('0x178c')) {
      throw new Error('Maximum slippage reached');
    }
    if (log.includes('insufficient lamports')) {
      throw new Error('You need more SOL to pay for transaction fees');
    }
  }
  
  throw new Error('Transaction simulation error');
}
```

## 🔄 Transaction Confirmation & Sending

The subscription system uses a sophisticated transaction confirmation process that combines WebSocket subscriptions with polling for maximum reliability:

### Transaction Sending (`send.ts`)

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

### Transaction Confirmation (`confirm.ts`)

```typescript
// Backend: src/solana/transaction/confirm.ts
const wsEndpoint = 'wss://mainnet.helius-rpc.com/?api-key=' + process.env.RPC_KEY!;
const ws = new WebSocket(wsEndpoint);

// Note: WebSocket setup for future real-time confirmations
// Currently, transaction confirmation is handled by polling in send.ts
// This WebSocket infrastructure is ready for future enhancements
```

**WebSocket Infrastructure:**
- 🌐 **Future-Ready**: WebSocket setup for future real-time confirmations
- 🔌 **Efficient Design**: Single WebSocket connection architecture
- 🧹 **Automatic Cleanup**: Proper cleanup on process exit
- 📡 **Helius Integration**: Uses Helius RPC for reliable mainnet connections
- 📊 **Current Implementation**: Currently uses polling-based confirmation in send.ts

### Confirmation Flow

```
1. Send Transaction → 2. Get Signature → 3. Subscribe to Updates → 4. Receive Confirmation
     ↓                      ↓                    ↓                    ↓
  RPC Call            Transaction ID        WebSocket Sub        Status Update
  (skipPreflight)     (base64 encoded)     (signature)         (confirmed/failed)
```

### Error Handling & Retries

```typescript
// Automatic cleanup and error handling
process.on('SIGINT', () => {
  ws.close();
  process.exit();
});

process.on('SIGTERM', () => {
  ws.close();
  process.exit();
});

// Transaction status tracking
if (error && 'signature' in error) {
  const signature = (error as { signature: string }).signature;
  await updatePaymentStatus(signature, 'failed');
}
```

## 🎒 Wallet Integration with @solana/kit

### Wallet Connection Component

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

### Transaction Signing

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

**@solana/kit Benefits:**
- 🔧 **Standardized APIs**: Consistent interface across wallets
- 🎯 **Type Safety**: Full TypeScript support
- 🚀 **Performance**: Optimized for modern wallets
- 🔒 **Security**: Built-in security best practices

## 🛡️ Security Best Practices

### RPC Key Protection

```typescript
// Backend: src/config.ts
export const config = {
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  SOLANA_WS_URL: process.env.SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com',
  RECEIVER: process.env.RECEIVER || '',
  WEBHOOK_TOKEN: process.env.WEBHOOK_TOKEN || ''
};
```

**Never expose RPC keys in frontend code!**

### Transaction Validation

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

### CORS Configuration

```typescript
// Backend: src/index.ts
.use(cors({
  origin: ['http://localhost:8080', 'https://yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
```

## 📊 Database Schema

The system uses SQLite for simplicity, but can easily scale to PostgreSQL:

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

## 🧪 Testing Your System

### 1. Test Wallet Connection

```bash
# Start the frontend
cd frontend
bun run dev

# Open http://localhost:8080
# Click "Connect Wallet" and select your wallet
```

### 2. Test Transaction Flow

```bash
# Ensure you have USDC in your wallet
# Select a subscription plan
# Click "Confirm Payment"
# Approve the transaction in your wallet
```

### 3. Monitor Backend Logs

```bash
# In your backend terminal, you should see:
🚀 Request received: POST /subscription/transaction
🔒 CORS Debug Info: Origin: http://localhost:8080
📦 Request body: {"account":"...","amount":"49"}
```

## 🚀 Deployment

### Environment Variables

```bash
# Production .env
SOLANA_RPC_URL=https://your-rpc-endpoint.com
SOLANA_WS_URL=wss://your-ws-endpoint.com
RECEIVER=your-production-wallet
WEBHOOK_TOKEN=your-secure-token
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

1. **Webhook Integration**: Add Quicknode webhooks for real-time transaction monitoring for db inserts, instead of on confirmation
2. **Multi-Token Support**: Extend beyond USDC to other SPL tokens
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

**Built with ❤️ using Solana, Elysia, Bun, and Eden**

*This project demonstrates modern Solana development practices and serves as a foundation for building production-ready dApps.*
