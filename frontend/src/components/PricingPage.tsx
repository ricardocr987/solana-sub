import React, { useState } from 'react'
import { Card, CardContent } from './ui/card'
import { useUserPlan } from '../hooks/useUserPlan'
import { cn } from '../lib/utils'
import { PricingCard } from './PricingCard'
import { WalletConnection } from './solana/WalletConnection'
import { useWallet } from '../context/WalletContext'
import type { TokenInfo } from '../types/api'

export const PricingPage: React.FC = () => {
  const [yearly, setYearly] = useState(false)
  const { isConnected, selectedAccount } = useWallet()
  
  // Only fetch user plan if wallet is connected
  const { userPlan, paymentHistory, isLoading: isUserPlanLoading, error: userPlanError, refreshUserPlan } = useUserPlan(
    isConnected && selectedAccount ? selectedAccount.address : undefined
  )

  const handleSubscriptionSuccess = (signature: string) => {
    console.log('Subscription successful:', signature)
    refreshUserPlan()
  }

  const handleSubscriptionError = (error: string) => {
    console.error('Subscription error:', error)
  }

  // Determine if starter plan should be shown as active
  const isStarterActive = !userPlan || userPlan.name === "Free" || !userPlan.isActive

  // Format subscription end date for display
  const formatSubscriptionEndDate = (dateString: string | null) => {
    if (!dateString) return 'No active subscription'
    
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return 'Invalid date'
    }
  }

  // Create USDC token info for payments
  const usdcToken: TokenInfo = {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png"
  }

  // Pricing data configuration
  const pricingPlans = [
    {
      title: "Starter",
      description: "Basic plan",
      icon: "⚡",
      price: "0",
      yearlyPrice: "0",
      features: ["Basic features", "Standard support"],
      isActive: isStarterActive,
      showPaymentButton: false
    },
    {
      title: "Pro I",
      description: "Professional plan",
      icon: "👥",
      price: "2",
      yearlyPrice: "20",
      features: ["Advanced features", "Priority support", "Premium tools"],
      isActive: userPlan?.name.includes("Active") || false,
      showPaymentButton: true
    },
    {
      title: "Pro II",
      description: "Enterprise plan",
      icon: "🪙",
      price: "10",
      yearlyPrice: "100",
      features: ["All Pro I features", "Enterprise tools", "24/7 support"],
      isActive: false,
      showPaymentButton: true
    }
  ]

  return (
    <div className="fixed inset-0 bg-gray-900 text-white overflow-auto">
      <div className="w-full p-8">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10 2C5.6 2 2 5.6 2 10C2 14.4 5.6 18 10 18C14.4 18 18 14.4 18 10C18 5.6 14.4 2 10 2ZM10 16C6.7 16 4 13.3 4 10C4 6.7 6.7 4 10 4C13.3 4 16 6.7 16 10C16 13.3 13.3 16 10 16Z"
                    fill="white"
                  />
                  <path
                    d="M10 6C8.3 6 7 7.3 7 9C7 10.7 8.3 12 10 12C11.7 12 13 10.7 13 9C13 7.3 11.7 6 10 6ZM10 10C9.4 10 9 9.6 9 9C9 8.4 9.4 8 10 8C10.6 8 11 8.4 11 9C11 9.6 10.6 10 10 10Z"
                    fill="white"
                  />
                  <path
                    d="M10 14C9.4 14 9 13.6 9 13C9 12.4 9.4 10 10 10C10.6 10 11 10.4 11 11C11 11.6 10.6 12 10 12C10.6 12 11 12.4 11 13C11 13.6 10.6 14 10 14Z"
                    fill="white"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold">Pricing</h1>
                <p className="text-gray-400">Your plans & billing</p>
              </div>
            </div>
            <WalletConnection />
          </div>
          <div className="h-px bg-gray-700"></div>
        </div>

        {/* Main Title and Toggle */}
        <div className="flex items-center justify-center gap-6 mb-12">
          <h2 className="text-4xl font-bold">
            Subscription demo
          </h2>
          
          {/* Pricing Toggle */}
          <div className="flex items-center gap-3 bg-gray-800 rounded-full px-3 py-2">
            <span className={cn('text-sm font-medium', !yearly && 'text-white')}>
              Monthly
            </span>
            <button
              className={cn(
                'relative w-10 h-6 bg-gray-600 rounded-full transition-colors duration-200',
                yearly ? 'bg-green-600' : 'bg-gray-600',
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
            <span className={cn('text-sm font-medium', yearly && 'text-white')}>
              Yearly
            </span>
            {yearly && (
              <span className="bg-green-700/90 text-white text-xs font-semibold px-2 py-1 rounded-full">
                2 months Free
              </span>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {pricingPlans.map((plan, index) => (
            <PricingCard
              key={index}
              title={plan.title}
              description={plan.description}
              icon={plan.icon}
              price={plan.price}
              yearlyPrice={plan.yearlyPrice}
              features={plan.features}
              isActive={plan.isActive}
              isYearly={yearly}
              usdcToken={usdcToken}
              onSuccess={handleSubscriptionSuccess}
              onError={handleSubscriptionError}
            />
          ))}
        </div>

        {/* Current Plan Section */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold mb-6">Your Current Plan</h3>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-6">
              {isUserPlanLoading ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">Loading plan information...</p>
                </div>
              ) : userPlan ? (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white text-lg">{userPlan.name}</p>
                    <p className="text-gray-400 text-sm">Current plan</p>
                  </div>
                  <div>
                    <p className="text-white text-lg">
                      {userPlan.isActive ? 'Active' : 'Inactive'}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {formatSubscriptionEndDate(userPlan.subscriptionEndDate)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white text-lg">Starter</p>
                    <p className="text-gray-400 text-sm">Current plan</p>
                  </div>
                  <div>
                    <p className="text-white text-lg">Active</p>
                    <p className="text-gray-400 text-sm">Free plan</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment History Section */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold mb-6">Payment History</h3>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-6">
              {isUserPlanLoading ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">Loading payment history...</p>
                </div>
              ) : paymentHistory.length > 0 ? (
                <div className="space-y-4">
                  {paymentHistory.map((payment) => (
                    <div key={payment.id} className="flex justify-between items-center py-3 border-b border-gray-700 last:border-b-0">
                      <div>
                        <p className="text-white font-medium">{payment.plan}</p>
                        <p className="text-gray-400 text-sm">{payment.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-medium">{payment.amount}</p>
                        <p className={cn(
                          "text-sm",
                          payment.status === 'Completed' ? 'text-green-500' : 
                          payment.status === 'Pending' ? 'text-yellow-500' : 'text-red-500'
                        )}>
                          {payment.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">No payment history available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Error Display */}
        {userPlanError && (
          <div className="text-red-500 text-sm text-center bg-red-900/20 p-4 rounded-lg border border-red-700">
            {userPlanError}
          </div>
        )}

        {!isConnected && (
          <div className="text-center py-8">
            <p className="text-gray-400">Connect your wallet to subscribe to premium plans</p>
          </div>
        )}
      </div>
    </div>
  )
}
