import { type TokenInfo, type SubscriptionTransactionResponse, type ConfirmSubscriptionResponse } from "../types/api";
import { useSignTransaction } from "@solana/react";
import { type UiWalletAccount } from "@wallet-standard/react";
import { useCallback } from "react";
import { Button } from "./ui/button";
import { useTransactionToast } from "../context/TransactionToastContext";
import { getBase64Encoder } from "@solana/kit";
import { api } from "../lib/api";
import bs58 from 'bs58';

interface PaymentProps {
    selectedToken: TokenInfo;
    amount: string;
    onSuccess: (signature: string) => void;
    onError: (error: string) => void;
}

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export function PaymentButton({ account, params }: { account: UiWalletAccount, params: PaymentProps }) {
    const signTransaction = useSignTransaction(account, 'solana:mainnet');
    const { startTransaction, updateTransactionStatus } = useTransactionToast();

    const handleTransaction = useCallback(async () => {
        const { selectedToken, amount, onSuccess, onError } = params;
        console.log('Payment params:', params);
        
        try {
            // Verify this is a USDC payment
            if (selectedToken.mint !== USDC_MINT) {
                throw new Error("Only USDC payments are supported for subscriptions");
            }

            // Start transaction and get ID
            const transactionId = startTransaction({
                amount,
                tokenSymbol: selectedToken.symbol
            });

            try {
                // Step 1: Get transaction from backend
                updateTransactionStatus(transactionId, { status: 'building' });
                console.log('Getting subscription transaction from backend...');
                
                const { data, error } = await api.subscription.transaction.post({
                    account: account.address,
                    amount: amount
                });

                if (error) {
                    const errorMessage = error.value?.message || `HTTP ${error.status} error`;
                    throw new Error(errorMessage);
                }

                if (!data) {
                    throw new Error('No data received from server');
                }

                // Type guard to ensure we have the expected data structure
                if (!('transaction' in data)) {
                    throw new Error('Invalid response format from server');
                }

                console.log("Received transaction data from backend:", data);

                // Step 2: Sign the transaction
                updateTransactionStatus(transactionId, { status: 'signing' });
                console.log('Signing transaction...');
                
                const base64Encoder = getBase64Encoder();
                console.log('data.transaction:', data.transaction);
                const transactionBytes = base64Encoder.encode(data.transaction);
                console.log('transactionBytes:', transactionBytes);
                const { signedTransaction } = await signTransaction({
                    transaction: transactionBytes as Uint8Array,
                });
                // Convert signed transaction to base64 for sending to backend
                const serializedTransaction = bs58.encode(Buffer.from(signedTransaction));
                console.log('Serialized transaction (base64) length:', serializedTransaction.length);
                console.log('Serialized transaction preview:',  serializedTransaction);

                // Step 3: Send signed transaction for confirmation
                updateTransactionStatus(transactionId, { status: 'confirming' });
                console.log('Confirming transaction on backend...');
                
                const confirmResponse = await api.confirm.transactions.post({
                    transactions: [serializedTransaction],
                    payments: [{    
                        transaction_hash: serializedTransaction,
                        wallet_address: account.address,
                        amount_usdc: parseFloat(amount),
                        payment_date: new Date().toISOString(),
                        subscription_duration_days: parseFloat(amount) >= 100 ? 365 : 30
                    }]
                });

                if (confirmResponse.error) {
                    throw new Error(confirmResponse.error.value?.message || 'Failed to confirm transaction');
                }

                if (!confirmResponse.data) {
                    throw new Error('No confirmation data received');
                }

                const { signatures, transactions } = confirmResponse.data;
                
                if (!signatures || signatures.length === 0 || !signatures[0]) {
                    throw new Error("No signature returned from confirmation");
                }

                const confirmedTransaction = transactions?.[0];
                console.log("Transaction confirmed:", confirmedTransaction);

                if (confirmedTransaction?.status === 'confirmed') {
                    // Update toast to success
                    updateTransactionStatus(transactionId, { 
                        status: 'success',
                        signature: signatures[0]
                    });
                    
                    // Call the success callback
                    onSuccess(signatures[0]);
                } else {
                    throw new Error("Transaction confirmation failed");
                }

            } catch (error) {
                console.error('Transaction processing error:', error);
                const errorMessage = error instanceof Error ? error.message : "Transaction failed";
                
                // Update toast to error
                updateTransactionStatus(transactionId, { 
                    status: 'error',
                    error: errorMessage
                });
                
                // Call the error callback
                onError(errorMessage);
            }

        } catch (error) {
            console.error('Critical transaction error:', error);
            const errorMessage = error instanceof Error ? error.message : "Something went wrong";
            onError(errorMessage);
        }
    }, [account, params, signTransaction, startTransaction, updateTransactionStatus]);

    return (
        <Button
            onClick={handleTransaction}
            className="w-full py-6 text-lg font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl transition-all"
        >
            Confirm Payment
        </Button>
    );
}