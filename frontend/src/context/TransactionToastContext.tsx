'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface TransactionStatus {
  id: string;
  status: 'pending' | 'building' | 'success' | 'error';
  error?: string;
  signature?: string;
  isServerError?: boolean;
}

export interface TransactionRequest {
  id: string;
  type: 'transfer';
  status: TransactionStatus;
  data: {
    amount: string;
    tokenMint: string;
    to: string;
  };
  createdAt: Date;
}

interface TransactionToastContextType {
  // Transfer methods
  executeTransfer: (params: {
    amount: string;
    tokenMint: string;
    to: string;
    onSuccess?: (signature: string) => void;
    onError?: (error: string) => void;
  }) => Promise<string>; // Returns transaction ID
  
  // Update transaction status
  updateTransactionStatus: (transactionId: string, updates: Partial<TransactionStatus>) => void;
  
  // State
  activeTransactions: TransactionRequest[];
  isLoading: boolean;
  
  // Utility methods
  dismissTransaction: (id: string) => void;
  clearAllTransactions: () => void;
}

interface TransactionToastProviderProps {
  children: React.ReactNode;
}

const TransactionToastContext = createContext<TransactionToastContextType | undefined>(undefined);

export const TransactionToastProvider = React.memo(({ children }: TransactionToastProviderProps) => {
  const [activeTransactions, setActiveTransactions] = useState<TransactionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const transactionIdCounter = useRef(0);

  // Generate unique transaction ID
  const generateTransactionId = useCallback(() => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const counter = ++transactionIdCounter.current;
    return `transaction_${counter}_${timestamp}_${random}`;
  }, []);

  // Create initial status for a transaction
  const createInitialStatus = useCallback((): TransactionStatus => ({
    id: '',
    status: 'pending',
    error: undefined,
    signature: undefined,
    isServerError: false,
  }), []);

  // Update transaction status
  const updateTransactionStatus = useCallback((transactionId: string, updates: Partial<TransactionStatus>) => {
    setActiveTransactions(prev => {
      return prev.map(transaction => 
        transaction.id === transactionId 
          ? { ...transaction, status: { ...transaction.status, ...updates } }
          : transaction
      );
    });
  }, []);

  // Execute transfer transaction
  const executeTransfer = useCallback(async (params: {
    amount: string;
    tokenMint: string;
    to: string;
    onSuccess?: (signature: string) => void;
    onError?: (error: string) => void;
  }) => {
    const transactionId = generateTransactionId();
    const initialStatus = createInitialStatus();
    
    // Create new transaction
    const newTransaction: TransactionRequest = {
      id: transactionId,
      type: 'transfer',
      status: initialStatus,
      data: {
        amount: params.amount,
        tokenMint: params.tokenMint,
        to: params.to,
      },
      createdAt: new Date()
    };

    setActiveTransactions(prev => [...prev, newTransaction]);
    setIsLoading(true);

    // Update status to building
    updateTransactionStatus(transactionId, { status: 'building' });

    // Return the transaction ID so the caller can update the status
    return transactionId;
  }, [generateTransactionId, createInitialStatus, updateTransactionStatus]);

  // Dismiss a transaction
  const dismissTransaction = useCallback((transactionId: string) => {
    setActiveTransactions(prev => prev.filter(t => t.id !== transactionId));
  }, []);

  // Clear all transactions
  const clearAllTransactions = useCallback(() => {
    setActiveTransactions([]);
  }, []);

  const contextValue: TransactionToastContextType = {
    executeTransfer,
    updateTransactionStatus,
    activeTransactions,
    isLoading,
    dismissTransaction,
    clearAllTransactions,
  };

  return (
    <TransactionToastContext.Provider value={contextValue}>
      {children}
      
      {/* Transaction Toast - only render when there are transactions */}
      {activeTransactions.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          {activeTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className={`p-4 rounded-lg shadow-lg w-80 ${
                transaction.status.status === 'success' 
                  ? 'bg-green-600 text-white' 
                  : transaction.status.status === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-blue-600 text-white'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">
                    {transaction.status.status === 'success' && 'Transaction Successful'}
                    {transaction.status.status === 'error' && 'Transaction Failed'}
                    {transaction.status.status === 'building' && 'Processing Transaction'}
                    {transaction.status.status === 'pending' && 'Transaction Pending'}
                  </div>
                  <div className="text-sm opacity-90 mt-1">
                    {transaction.data.amount} {transaction.data.tokenMint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' ? 'USDC' : 'tokens'}
                  </div>
                  {transaction.status.signature && (
                    <div className="text-xs opacity-75 mt-1 font-mono">
                      {transaction.status.signature.slice(0, 8)}...{transaction.status.signature.slice(-8)}
                    </div>
                  )}
                  {transaction.status.error && (
                    <div className="text-sm opacity-90 mt-1">
                      {transaction.status.error}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => dismissTransaction(transaction.id)}
                  className="text-white opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </TransactionToastContext.Provider>
  );
});

TransactionToastProvider.displayName = 'TransactionToastProvider';

export function useTransactionToast() {
  const context = useContext(TransactionToastContext);
  
  if (context === undefined) {
    throw new Error('useTransactionToast must be used within a TransactionToastProvider');
  }
  
  return context;
}
