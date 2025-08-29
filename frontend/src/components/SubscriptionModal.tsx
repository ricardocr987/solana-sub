import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { useSubscription } from '../hooks/useSubscription'
import { cn } from '../lib/utils'

interface SubscriptionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  walletAddress?: string
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  open,
  onOpenChange,
  walletAddress,
}) => {
  const [yearly, setYearly] = useState(false)
  const { getSubscriptionTransaction, confirmSubscription, isLoading, error, resetError } = useSubscription()

  const handleSubscribe = async () => {
    if (!walletAddress) {
      return
    }

    try {
      // Step 1: Get the subscription transaction
      const amount = yearly ? '499' : '49'
      const transactionResponse = await getSubscriptionTransaction({
        account: walletAddress,
        amount,
      })

      if (!transactionResponse) {
        return
      }

      // Step 2: Sign and send the transaction (this would be done by the wallet)
      // For now, we'll simulate this step
      console.log('Transaction to sign:', transactionResponse.transaction)
      
      // Step 3: Confirm the transaction
      const confirmResponse = await confirmSubscription({
        transactions: [transactionResponse.transaction.signature || 'mock-signature'],
        payments: [{
          transaction_hash: transactionResponse.transaction.signature || 'mock-signature',
          wallet_address: walletAddress,
          amount_usdc: parseInt(amount),
          payment_date: new Date().toISOString(),
          subscription_duration_days: yearly ? 365 : 30,
        }],
      })

      if (confirmResponse) {
        console.log('Subscription confirmed:', confirmResponse)
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Subscription failed:', error)
    }
  }

  // Reset error when modal opens/closes
  React.useEffect(() => {
    if (!open) {
      resetError()
    }
  }, [open, resetError])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Your Plan</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Plan Toggle */}
          <div className="flex items-center justify-center gap-3 bg-muted/10 rounded-full px-3 py-2">
            <span className={cn('text-sm font-medium', !yearly && 'text-primary')}>
              Monthly
            </span>
            <button
              className={cn(
                'relative w-10 h-6 bg-muted rounded-full transition-colors duration-200',
                yearly ? 'bg-green-600' : 'bg-muted',
              )}
              onClick={() => setYearly((v) => !v)}
              type="button"
            >
              <span
                className={cn(
                  'absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  yearly ? 'translate-x-4' : 'translate-x-0',
                )}
              />
            </button>
            <span className={cn('text-sm font-medium', yearly && 'text-primary')}>
              Yearly
            </span>
            {yearly && (
              <span className="bg-green-700/90 text-white text-xs font-semibold px-2 py-1 rounded-full">
                2 months Free
              </span>
            )}
          </div>

          {/* Plan Details */}
          <div className="text-center space-y-2">
            <div className="text-3xl font-bold text-green-500">
              ${yearly ? '499' : '49'}
            </div>
            <div className="text-sm text-muted-foreground">
              per {yearly ? 'year' : 'month'}
            </div>
            <div className="text-sm">
              {yearly ? 'Unlimited portfolio generation, 0.1% swap fee, 15% performance fee' : 
                       'Unlimited portfolio generation, 0.1% swap fee, 15% performance fee'}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          {/* Subscribe Button */}
          <Button
            onClick={handleSubscribe}
            disabled={isLoading || !walletAddress}
            className="w-full"
          >
            {isLoading ? 'Processing...' : 'Subscribe Now'}
          </Button>

          {!walletAddress && (
            <p className="text-sm text-muted-foreground text-center">
              Please connect your wallet to subscribe
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
