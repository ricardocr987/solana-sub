import React, { useState } from 'react'
import { treaty } from '@elysiajs/eden'
import type { App } from '@backend/index'
import { Button } from '../components/ui/button'

// Create the Eden Treaty client
// Frontend runs on port 8080, but API calls go to backend on port 3000
const api = treaty<App>('http://localhost:3000')

export const EdenExample: React.FC = () => {
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const testSubscriptionAPI = async () => {
    setLoading(true)
    try {
      console.log('Testing subscription API...')
      console.log('Backend URL:', 'http://localhost:3000')
      
      // Test the subscription transaction endpoint
      const { data, error } = await api.subscription.transaction.post({
        account: 'mock-wallet-address-123',
        amount: '49'
      })

      if (error) {
        setResult(`Error: ${JSON.stringify(error, null, 2)}`)
      } else {
        setResult(`Success: ${JSON.stringify(data, null, 2)}`)
      }
    } catch (err) {
      console.error('Subscription API error:', err)
      setResult(`Exception: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const testConfirmAPI = async () => {
    setLoading(true)
    try {
      // Test the confirm transactions endpoint
      const { data, error } = await api.confirm.transactions.post({
        transactions: ['mock-signature-123'],
        payments: [{
          transaction_hash: 'mock-signature-123',
          wallet_address: 'mock-wallet-address-123',
          amount_usdc: 49,
          payment_date: new Date().toISOString(),
          subscription_duration_days: 30
        }]
      })

      if (error) {
        setResult(`Error: ${JSON.stringify(error, null, 2)}`)
      } else {
        setResult(`Success: ${JSON.stringify(data, null, 2)}`)
      }
    } catch (err) {
      setResult(`Exception: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const testRootEndpoint = async () => {
    setLoading(true)
    try {
      console.log('Testing root endpoint...')
      
      // Test the root endpoint
      const { data, error } = await api.get()

      if (error) {
        setResult(`Error: ${JSON.stringify(error, null, 2)}`)
      } else {
        setResult(`Success: ${JSON.stringify(data, null, 2)}`)
      }
    } catch (err) {
      console.error('Root endpoint error:', err)
      setResult(`Exception: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const testBasicConnectivity = async () => {
    setLoading(true)
    try {
      console.log('Testing basic connectivity...')
      
      // Test basic fetch to see if the backend is reachable
      const response = await fetch('http://localhost:3000/')
      const text = await response.text()
      
      setResult(`Basic connectivity success: ${text}`)
    } catch (err) {
      console.error('Basic connectivity error:', err)
      setResult(`Basic connectivity failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Eden Treaty API Test</h1>
      
      <div className="space-y-2">
        <Button 
          onClick={testBasicConnectivity} 
          disabled={loading}
          className="mr-2"
        >
          Test Basic Connectivity
        </Button>
        
        <Button 
          onClick={testRootEndpoint} 
          disabled={loading}
          className="mr-2"
        >
          Test Root Endpoint
        </Button>
        
        <Button 
          onClick={testSubscriptionAPI} 
          disabled={loading}
          className="mr-2"
        >
          Test Subscription API
        </Button>
        
        <Button 
          onClick={testConfirmAPI} 
          disabled={loading}
        >
          Test Confirm API
        </Button>
      </div>

      {loading && <p>Loading...</p>}
      
      {result && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Result:</h3>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {result}
          </pre>
        </div>
      )}
    </div>
  )
}
