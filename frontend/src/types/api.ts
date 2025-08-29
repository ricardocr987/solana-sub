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
