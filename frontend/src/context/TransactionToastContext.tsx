'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useToast } from '../hooks/useToast';

export interface TransactionStatus {
  id: string;
  status: 'pending' | 'building' | 'signing' | 'confirming' | 'success' | 'error';
  error?: string;
  signature?: string;
  amount: string;
  tokenSymbol: string;
  createdAt: Date;
}

interface TransactionToastContextType {
  // Start a new transaction
  startTransaction: (params: {
    amount: string;
    tokenSymbol: string;
  }) => string; // Returns transaction ID
  
  // Update transaction status
  updateTransactionStatus: (transactionId: string, updates: Partial<Omit<TransactionStatus, 'id' | 'amount' | 'tokenSymbol' | 'createdAt'>>) => void;
  
  // Get transaction by ID
  getTransaction: (id: string) => TransactionStatus | undefined;
  
  // State
  activeTransactions: TransactionStatus[];
  
  // Utility methods
  dismissTransaction: (id: string) => void;
  clearAllTransactions: () => void;
}

interface TransactionToastProviderProps {
  children: React.ReactNode;
}

const TransactionToastContext = createContext<TransactionToastContextType | undefined>(undefined);

export const TransactionToastProvider = React.memo(({ children }: TransactionToastProviderProps) => {
  const [activeTransactions, setActiveTransactions] = useState<TransactionStatus[]>([]);
  const { toast } = useToast();
  
  const transactionIdCounter = useRef(0);

  // Generate unique transaction ID
  const generateTransactionId = useCallback(() => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const counter = ++transactionIdCounter.current;
    return `tx_${counter}_${timestamp}_${random}`;
  }, []);

  // Start a new transaction
  const startTransaction = useCallback((params: { amount: string; tokenSymbol: string }) => {
    const transactionId = generateTransactionId();
    
    const newTransaction: TransactionStatus = {
      id: transactionId,
      status: 'pending',
      amount: params.amount,
      tokenSymbol: params.tokenSymbol,
      createdAt: new Date()
    };

    setActiveTransactions(prev => [...prev, newTransaction]);

    // Show initial toast
    toast({
      title: 'Transaction Started',
      description: `Preparing to send ${params.amount} ${params.tokenSymbol}`,
      duration: 3000,
    });

    return transactionId;
  }, [generateTransactionId, toast]);

  // Update transaction status and show appropriate toast
  const updateTransactionStatus = useCallback((transactionId: string, updates: Partial<Omit<TransactionStatus, 'id' | 'amount' | 'tokenSymbol' | 'createdAt'>>) => {
    setActiveTransactions(prev => {
      const updated = prev.map(transaction => 
        transaction.id === transactionId 
          ? { ...transaction, ...updates }
          : transaction
      );
      
      // Find the updated transaction to show toast
      const updatedTransaction = updated.find(t => t.id === transactionId);
      if (updatedTransaction) {
        const { status, error, signature } = updatedTransaction;
        
        if (status === 'success' && signature) {
          toast({
            title: 'Transaction Successful! 🎉',
            description: `${updatedTransaction.amount} ${updatedTransaction.tokenSymbol} sent successfully. Click to view on Solana Explorer.`,
            duration: 8000,
          });
          
          // Open explorer in new tab after a short delay
          setTimeout(() => {
            window.open(`https://solscan.io/tx/${signature}`, '_blank');
          }, 1000);
        } else if (status === 'error' && error) {
          toast({
            title: 'Transaction Failed ❌',
            description: error,
            variant: 'destructive',
            duration: 8000,
          });
        } else if (status === 'building') {
          toast({
            title: 'Building Transaction 🔨',
            description: 'Creating your transaction on the server',
            duration: 3000,
          });
        } else if (status === 'signing') {
          toast({
            title: 'Signing Transaction ✍️',
            description: 'Please approve the transaction in your wallet',
            duration: 3000,
          });
        } else if (status === 'confirming') {
          toast({
            title: 'Confirming Transaction ⏳',
            description: 'Waiting for network confirmation',
            duration: 3000,
          });
        }
      }
      
      return updated;
    });
  }, [toast]);

  // Get transaction by ID
  const getTransaction = useCallback((id: string) => {
    return activeTransactions.find(t => t.id === id);
  }, [activeTransactions]);

  // Dismiss a transaction
  const dismissTransaction = useCallback((transactionId: string) => {
    setActiveTransactions(prev => prev.filter(t => t.id !== transactionId));
  }, []);

  // Clear all transactions
  const clearAllTransactions = useCallback(() => {
    setActiveTransactions([]);
  }, []);

  const contextValue: TransactionToastContextType = {
    startTransaction,
    updateTransactionStatus,
    getTransaction,
    activeTransactions,
    dismissTransaction,
    clearAllTransactions,
  };

  return (
    <TransactionToastContext.Provider value={contextValue}>
      {children}
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
