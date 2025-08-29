import React, { useState } from 'react'
import { Button } from './ui/button'
import { SubscriptionModal } from './SubscriptionModal'

export const SubscriptionExample: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string>('')

  // Mock wallet connection - replace with your actual wallet logic
  const connectWallet = () => {
    // Simulate connecting to a wallet
    setWalletAddress('mock-wallet-address-123')
  }

  const disconnectWallet = () => {
    setWalletAddress('')
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Subscription Example</h1>
      
      <div className="space-y-2">
        {walletAddress ? (
          <div className="space-y-2">
            <p>Connected: {walletAddress}</p>
            <Button onClick={disconnectWallet} variant="outline">
              Disconnect Wallet
            </Button>
            <Button onClick={() => setIsModalOpen(true)}>
              Open Subscription Modal
            </Button>
          </div>
        ) : (
          <Button onClick={connectWallet}>
            Connect Wallet
          </Button>
        )}
      </div>

      <SubscriptionModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        walletAddress={walletAddress}
      />
    </div>
  )
}
