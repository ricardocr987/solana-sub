import { useState } from 'react'
import { api } from '../lib/api'
import type { SubscriptionTransactionResponse, ConfirmSubscriptionResponse } from '../types/api'

export const useSubscription = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getSubscriptionTransaction = async (request: { account: string; amount: string }): Promise<SubscriptionTransactionResponse | null> => {
    setIsLoading(true)
    setError(null)
    
    try {
      const { data, error } = await api.subscription.transaction.post(request)
      
      if (error) {
        // Handle error based on status
        if (error.status >= 400) {
          throw new Error(error.value.message || `HTTP ${error.status} error`)
        }
        throw new Error(error.value.message || 'Unknown error')
      }
      
      if (!data) {
        throw new Error('No data received from server')
      }
      
      return data as SubscriptionTransactionResponse
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const confirmSubscription = async (request: {
    transactions: string[];
    payments?: Array<{
      transaction_hash: string;
      wallet_address: string;
      amount_usdc: number;
      payment_date: string;
      subscription_duration_days?: number;
    }>;
  }): Promise<ConfirmSubscriptionResponse | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error } = await api.confirm.transactions.post(request)
      
      if (error) {
        // Handle error based on status
        if (error.status >= 400) {
          throw new Error(error.value.message || `HTTP ${error.status} error`)
        }
        throw new Error(error.value.message || 'Unknown error')
      }
      
      if (!data) {
        throw new Error('No data received from server')
      }
      
      return data as ConfirmSubscriptionResponse
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const resetError = () => setError(null)

  return {
    getSubscriptionTransaction,
    confirmSubscription,
    isLoading,
    error,
    resetError,
  }
}
