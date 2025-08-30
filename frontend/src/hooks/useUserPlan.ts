import { useState, useEffect } from 'react'

export interface UserPlan {
  name: string
  isActive: boolean
  subscriptionEndDate: string | null
  walletAddress: string
}

export interface PaymentHistoryItem {
  id: number
  date: string
  amount: string
  plan: string
  status: string
  transaction_hash: string
}

export interface UserPlanResponse {
  currentPlan: UserPlan
  paymentHistory: PaymentHistoryItem[]
}

export const useUserPlan = (walletAddress?: string) => {
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null)
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUserPlan = async () => {
    if (!walletAddress) {
      setUserPlan(null)
      setPaymentHistory([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching user plan for wallet:', walletAddress)
      const response = await fetch(`http://localhost:3000/user/plan/${walletAddress}`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('User plan response:', data)

      if (data && data.success && data.data) {
        const currentPlan = data.data.currentPlan
        const history = data.data.paymentHistory
        
        if (currentPlan && history) {
          const formattedPlan: UserPlan = {
            ...currentPlan,
            subscriptionEndDate: currentPlan.subscriptionEndDate || null
          }
          
          const formattedHistory: PaymentHistoryItem[] = history
            .filter((item: any) => item.id !== undefined && item.date !== undefined)
            .map((item: any) => ({
              id: item.id!,
              date: String(item.date!),
              amount: item.amount,
              plan: item.plan,
              status: item.status,
              transaction_hash: item.transaction_hash
            }))
          
          setUserPlan(formattedPlan)
          setPaymentHistory(formattedHistory)
        } else {
          // Handle case where no subscription data exists yet
          console.log('No subscription data found, setting default plan')
          setUserPlan({
            name: 'Free',
            isActive: true,
            subscriptionEndDate: null,
            walletAddress: walletAddress
          })
          setPaymentHistory([])
        }
      } else {
        // Handle case where response doesn't have expected structure
        console.log('Response missing expected data structure, setting default plan')
        setUserPlan({
          name: 'Free',
          isActive: true,
          subscriptionEndDate: null,
          walletAddress: walletAddress
        })
        setPaymentHistory([])
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      console.error('Error fetching user plan:', err)
      setError(errorMessage)
      
      // Set default plan on error
      setUserPlan({
        name: 'Free',
        isActive: true,
        subscriptionEndDate: null,
        walletAddress: walletAddress
      })
      setPaymentHistory([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUserPlan()
  }, [walletAddress])

  const refreshUserPlan = () => {
    fetchUserPlan()
  }

  return {
    userPlan,
    paymentHistory,
    isLoading,
    error,
    refreshUserPlan,
  }
}
