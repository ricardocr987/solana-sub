export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
}

export interface PaymentResponse {
  signature: string;
  status: 'success' | 'error';
  message?: string;
}

export interface SubscriptionData {
  plan: string;
  yearly: boolean;
  amount: number;
  walletAddress: string;
}

// API Response Types
export interface SubscriptionTransactionResponse {
  transaction: {
    message: any; // Transaction message from backend
    lifetimeConstraint: {
      blockhash: string;
      lastValidBlockHeight: number;
    };
  };
  amount: number;
  metadata: {
    tokenMint: string;
    tokenSymbol: string;
    tokenName: string;
    tokenDecimals: number;
    tokenLogoURI: string;
    receiverAddress: string;
    subscriptionPlans: {
      monthly: {
        pro1: { amount: number; duration: number };
        pro2: { amount: number; duration: number };
      };
      yearly: {
        pro1: { amount: number; duration: number };
        pro2: { amount: number; duration: number };
      };
    };
  };
}

export interface ConfirmSubscriptionResponse {
  signatures: string[];
  transactions: Array<{
    signature: string;
    status: 'confirmed' | 'failed';
    payment: {
      transaction_hash: string;
      wallet_address: string;
      amount_usdc: number;
      payment_date: string;
      subscription_duration_days?: number;
    } | null;
    subscriptionDetails: {
      walletAddress: string;
      amountUsdc: number;
      durationDays: number;
      plan: string;
    } | null;
  }>;
}
