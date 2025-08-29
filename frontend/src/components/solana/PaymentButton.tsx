import { type TokenInfo } from "../../types/api";
import { useSignTransaction } from "@solana/react";
import { type UiWalletAccount } from "@wallet-standard/react";
import { useCallback } from "react";
import bs58 from 'bs58';
import { Button } from "../ui/button";
import { useTransactionToast } from "../../context/TransactionToastContext";
import { useSubscription } from "../../hooks/useSubscription";
import { getBase64Encoder } from "@solana/kit";

interface PaymentProps {
    selectedToken: TokenInfo;
    amount: string;
    onSuccess: (signature: string) => void;
    onError: (error: string) => void;
}

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export function PaymentButton({ account, params }: { account: UiWalletAccount, params: PaymentProps }) {
    const signTransaction = useSignTransaction(account, 'solana:mainnet');
    const { executeTransfer, updateTransactionStatus } = useTransactionToast();
    const { getSubscriptionTransaction, confirmSubscription } = useSubscription();

    const handleTransaction = useCallback(async () => {
        const { selectedToken, amount, onSuccess, onError } = params;
        console.log('Payment params:', params);
        
        try {
            // Verify this is a USDC payment
            if (selectedToken.mint !== USDC_MINT) {
                throw new Error("Only USDC payments are supported for subscriptions");
            }

            // Start transaction toast and get transaction ID
            const transactionId = await executeTransfer({
                amount,
                tokenMint: selectedToken.mint,
                to: 'subscription-service'
            });

            try {
                // Step 1: Get transaction from backend
                updateTransactionStatus(transactionId, { status: 'building' });
                const transactionResponse = await getSubscriptionTransaction({
                    account: account.address,
                    amount: amount
                });

                if (!transactionResponse || !transactionResponse.transaction) {
                    throw new Error("Failed to generate subscription transaction");
                }

                const { transaction: base64Transaction } = transactionResponse;
                console.log("Generated transaction:", base64Transaction);

                // Step 2: Sign the transaction
                updateTransactionStatus(transactionId, { status: 'building' });
                const transactionBytes = base64ToUint8Array(base64Transaction);
                
                const { signedTransaction } = await signTransaction({
                    transaction: transactionBytes,
                });

                // Convert to base64 for sending
                const serializedTransaction = bs58.encode(Buffer.from(signedTransaction));

                // Step 3: Send signed transaction for confirmation
                updateTransactionStatus(transactionId, { status: 'building' });
                const confirmResponse = await confirmSubscription({
                    transactions: [serializedTransaction],
                    payments: [{
                        transaction_hash: serializedTransaction,
                        wallet_address: account.address,
                        amount_usdc: parseFloat(amount),
                        payment_date: new Date().toISOString(),
                        subscription_duration_days: parseFloat(amount) >= 100 ? 365 : 30
                    }]
                });

                if (!confirmResponse || !confirmResponse.signatures || confirmResponse.signatures.length === 0) {
                    throw new Error("Failed to confirm transaction");
                }

                const result = confirmResponse;
                console.log("Transaction confirmed:", result);

                if (result.signatures[0]) {
                    // Update toast to success
                    updateTransactionStatus(transactionId, { 
                        status: 'success',
                        signature: result.signatures[0]
                    });
                    
                    // Call the success callback
                    onSuccess(result.signatures[0]);
                } else {
                    throw new Error("No signature returned from confirmation");
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
    }, [account, params, signTransaction, executeTransfer, updateTransactionStatus, getSubscriptionTransaction, confirmSubscription]);

    return (
        <Button
            onClick={handleTransaction}
            className="w-full py-6 text-lg font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl transition-all"
        >
            Confirm Payment
        </Button>
    );
}

function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}