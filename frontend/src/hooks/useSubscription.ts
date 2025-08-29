import { useState } from 'react'
import { treaty } from '@elysiajs/eden'
import type { App } from '@backend/index'

// Create the Eden Treaty client
const api = treaty<App>('http://localhost:3000')

interface SubscriptionRequest {
  account: string
  amount: string
}

interface ConfirmRequest {
  transactions: string[]
  payments?: Array<{
    transaction_hash: string
    wallet_address: string
    amount_usdc: number
    payment_date: string
    subscription_duration_days?: number
  }>
}

export const useSubscription = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getSubscriptionTransaction = async (request: SubscriptionRequest) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const { data, error } = await api.subscription.transaction.post(request)

      if (error) {
        const errorMessage = typeof error.value === 'string' ? error.value : 'Failed to get subscription transaction'
        throw new Error(errorMessage)
      }

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const confirmSubscription = async (request: ConfirmRequest) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const { data, error } = await api.confirm.transactions.post(request)

      if (error) {
        const errorMessage = typeof error.value === 'string' ? error.value : 'Failed to confirm subscription'
        throw new Error(errorMessage)
      }

      return data
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
