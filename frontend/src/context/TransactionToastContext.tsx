'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useToast } from '../hooks/useToast';

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
    tokenSymbol?: string;
    tokenLogoURI?: string;
  };
  createdAt: Date;
}

interface TransactionToastContextType {
  // Transfer methods
  executeTransfer: (params: {
    amount: string;
    tokenMint: string;
    to: string;
    tokenSymbol?: string;
    tokenLogoURI?: string;
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
  const { toast } = useToast();
  
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

  // Update transaction status and show appropriate toast
  const updateTransactionStatus = useCallback((transactionId: string, updates: Partial<TransactionStatus>) => {
    setActiveTransactions(prev => {
      const updated = prev.map(transaction => 
        transaction.id === transactionId 
          ? { ...transaction, status: { ...transaction.status, ...updates } }
          : transaction
      );
      
      // Find the updated transaction to show toast
      const updatedTransaction = updated.find(t => t.id === transactionId);
      if (updatedTransaction) {
        const { status, error, signature } = updatedTransaction.status;
        
        if (status === 'success' && signature) {
          toast({
            title: 'Transaction Successful',
            description: `${updatedTransaction.data.amount} ${updatedTransaction.data.tokenSymbol || 'USDC'} sent successfully`,
            duration: 5000,
          });
        } else if (status === 'error' && error) {
          toast({
            title: 'Transaction Failed',
            description: error,
            variant: 'destructive',
            duration: 5000,
          });
        } else if (status === 'building') {
          toast({
            title: 'Processing Transaction',
            description: 'Your transaction is being processed on the Solana network',
            duration: 3000,
          });
        }
      }
      
      return updated;
    });
  }, [toast]);

  // Execute transfer transaction
  const executeTransfer = useCallback(async (params: {
    amount: string;
    tokenMint: string;
    to: string;
    tokenSymbol?: string;
    tokenLogoURI?: string;
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
        tokenSymbol: params.tokenSymbol,
        tokenLogoURI: params.tokenLogoURI,
      },
      createdAt: new Date()
    };

    setActiveTransactions(prev => [...prev, newTransaction]);
    setIsLoading(true);

    // Show initial toast
    toast({
      title: 'Transaction Started',
      description: `Preparing to send ${params.amount} ${params.tokenSymbol || 'USDC'}`,
      duration: 3000,
    });

    // Update status to building
    updateTransactionStatus(transactionId, { status: 'building' });

    // Return the transaction ID so the caller can update the status
    return transactionId;
  }, [generateTransactionId, createInitialStatus, updateTransactionStatus, toast]);

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
