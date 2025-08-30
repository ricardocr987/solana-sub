import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { PaymentButton } from './PaymentButton'
import { useWallet } from '../context/WalletContext'
import type { TokenInfo } from '../types/api'
import { cn } from '../lib/utils'

interface PricingCardProps {
  title: string
  description: string
  icon: string
  price: string
  yearlyPrice: string
  features: string[]
  isActive?: boolean
  isCurrent?: boolean
  isYearly: boolean
  usdcToken: TokenInfo
  onSuccess: (signature: string) => void
  onError: (error: string) => void
}

export const PricingCard: React.FC<PricingCardProps> = ({
  title,
  description,
  icon,
  price,
  yearlyPrice,
  features,
  isActive = false,
  isCurrent = false,
  isYearly,
  usdcToken,
  onSuccess,
  onError
}) => {
  const { isConnected, selectedAccount } = useWallet()
  const currentPrice = isYearly ? yearlyPrice : price

  return (
    <Card className={cn(
      "bg-gray-800 border-2 relative",
      isCurrent ? "border-green-500" : "border-gray-700"
    )}>
      <div className="absolute top-4 right-4">
        <span className="text-2xl font-bold text-green-500">${currentPrice}</span>
      </div>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center">
            <span className="text-white text-lg">{icon}</span>
          </div>
          <div>
            <CardTitle className="text-xl text-white">{title}</CardTitle>
            <p className="text-gray-400 text-sm">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 mb-6">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span className="text-sm text-white">{feature}</span>
            </li>
          ))}
        </ul>
        
        {isCurrent ? (
          <div className="text-center py-2 text-green-500 font-medium">
            Current Plan
          </div>
        ) : isConnected && selectedAccount ? (
          <PaymentButton
            account={selectedAccount}
            params={{
              selectedToken: usdcToken,
              amount: currentPrice,
              onSuccess,
              onError
            }}
          />
        ) : (
          <Button disabled variant="outline" className="w-full">
            Connect Wallet
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
