# Solana Starter

A Solana transaction confirmation and verification system using QuickNode RPC.

## Features

- **confirmTransaction**: Confirms a single transaction using QuickNode RPC
- **confirmTransactions**: Confirms multiple transactions concurrently
- **verifyTransactions**: Verifies transaction status with retry logic
- **Elysia API endpoint**: REST API for transaction confirmation

## Setup

1. **Install dependencies**:
   ```bash
   bun install
   ```

2. **Configure QuickNode RPC**:
   - Copy `env.example` to `.env`
   - Add your QuickNode RPC endpoint:
     ```
     QUICKNODE_RPC_URL=https://your-quicknode-endpoint.solana-mainnet.quiknode.pro/your-api-key/
     ```

3. **Run the development server**:
   ```bash
   bun run dev
   ```

## API Usage

### Confirm Transactions

**Endpoint**: `POST /confirm/transactions`

**Request Body**:
```json
{
  "transactions": [
    "base64_encoded_transaction_1",
    "base64_encoded_transaction_2"
  ]
}
```

**Response**:
```json
{
  "signatures": ["signature1", "signature2"],
  "swapDetails": null
}
```

## Functions

### `confirmTransaction(transaction: string, rpcType?: RpcType): Promise<string>`
Confirms a single transaction and returns the signature.

### `confirmTransactions(transactions: string[], rpcType?: RpcType): Promise<string[]>`
Confirms multiple transactions concurrently and returns an array of signatures.

### `verifyTransactions(signatures: string[])`
Verifies transaction status with exponential backoff retry logic.

## Configuration

The system is configured to always use QuickNode RPC for optimal performance and reliability. The RPC connection is configured with:

- Commitment level: `confirmed`
- Transaction timeout: 60 seconds
- Optimized transaction delivery settings

## Dependencies

- `@solana/web3.js`: Solana Web3 library
- `elysia`: Fast web framework
- `bun`: JavaScript runtime