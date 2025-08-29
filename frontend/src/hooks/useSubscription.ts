import { useState } from 'react'

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
      const response = await fetch("/api/subscription/transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to get subscription transaction')
      }

      const data = await response.json()
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
      const response = await fetch("/api/confirm/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to confirm subscription')
      }

      const data = await response.json()
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
