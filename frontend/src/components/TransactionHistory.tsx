import { useTransactionToast } from '../context/TransactionToastContext';
import { Button } from './ui/button';
import { X, ExternalLink, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function TransactionHistory() {
  const { activeTransactions, dismissTransaction, clearAllTransactions } = useTransactionToast();

  if (activeTransactions.length === 0) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'building':
      case 'signing':
      case 'confirming':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return 'Completed';
      case 'error':
        return 'Failed';
      case 'pending':
        return 'Pending';
      case 'building':
        return 'Building';
      case 'signing':
        return 'Signing';
      case 'confirming':
        return 'Confirming';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      case 'pending':
        return 'text-yellow-500';
      case 'building':
      case 'signing':
      case 'confirming':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3 max-w-sm">
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
        <h3 className="text-sm font-medium text-white">Active Transactions</h3>
        <Button
          onClick={clearAllTransactions}
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-gray-400 hover:text-white"
        >
          Clear All
        </Button>
      </div>

      {/* Transaction Items */}
      {activeTransactions.map((transaction) => (
        <div
          key={transaction.id}
          className={cn(
            "bg-gray-800 rounded-lg p-4 border border-gray-700 shadow-lg",
            "transition-all duration-200 hover:shadow-xl"
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {getStatusIcon(transaction.status)}
                <span className={cn("text-sm font-medium", getStatusColor(transaction.status))}>
                  {getStatusText(transaction.status)}
                </span>
              </div>
              
              <p className="text-white text-sm mb-1">
                {transaction.amount} {transaction.tokenSymbol}
              </p>
              
              {transaction.signature && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-400 font-mono">
                    {transaction.signature.slice(0, 8)}...{transaction.signature.slice(-8)}
                  </span>
                  <Button
                    onClick={() => window.open(`https://solscan.io/tx/${transaction.signature}`, '_blank')}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              )}
              
              {transaction.error && (
                <p className="text-red-400 text-xs mt-2">{transaction.error}</p>
              )}
            </div>
            
            <Button
              onClick={() => dismissTransaction(transaction.id)}
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-gray-400 hover:text-white ml-2"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
