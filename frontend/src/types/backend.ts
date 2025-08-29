import type { Elysia } from 'elysia';

// Backend API types for Eden Treaty client
export interface App extends Elysia {
  subscription: {
    transaction: {
      post: (request: { account: string; amount: string }) => Promise<{
        data?: { transaction: string; amount: number };
        error?: { value: { message: string } };
      }>;
    };
  };
  confirm: {
    transactions: {
      post: (request: {
        transactions: string[];
        payments?: Array<{
          transaction_hash: string;
          wallet_address: string;
          amount_usdc: number;
          payment_date: string;
          subscription_duration_days?: number;
        }>;
      }) => Promise<{
        data?: { signatures: string[] };
        error?: { value: { message: string } };
      }>;
    };
  };
}
