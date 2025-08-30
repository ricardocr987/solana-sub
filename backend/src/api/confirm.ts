import Elysia, { t } from 'elysia';
import { addPayment, upsertSubscription } from '../db';
import { validateTransactionFromSignature } from '../solana/transaction/validate';
import { sendTransaction } from '../solana/transaction/send';

// Elysia endpoint
const confirm = new Elysia({ prefix: '/confirm' })
  .post(
    '/transactions',
    async ({ body }) => {
      try {
        const { transactions, payments } = body;
        console.log('Processing transactions:', transactions.length);
        console.log('Payments:', payments?.length || 0);
        
        // Debug: Log transaction details
        if (transactions && transactions.length > 0) {
          console.log('First transaction length:', transactions[0].length);
          console.log('First transaction preview:', transactions[0].substring(0, 100));
          console.log('First transaction ends with:', transactions[0].substring(transactions[0].length - 20));
          
          // Check for invalid characters
          const invalidChars = transactions[0].match(/[^A-Za-z0-9+/=]/g);
          if (invalidChars) {
            console.warn('Found invalid characters in transaction:', [...new Set(invalidChars)]);
          }
        }
        
        const results = [];
        
        // Process transactions one by one
        for (let i = 0; i < transactions.length; i++) {
          const transaction = transactions[i];
          const payment = payments?.[i];
          
          try {
            console.log(`Processing transaction ${i + 1}/${transactions.length}`);
            
            // Send and confirm the transaction using the simplified function
            const signature = await sendTransaction(transaction);
            
            if (signature && payment) {
              // Store the payment
              const success = await addPayment({
                ...payment,
                payment_date: new Date(payment.payment_date),
                status: 'confirmed'
              });
              
              if (success) {
                console.log(`Payment stored for transaction: ${payment.transaction_hash}`);
                
                // Update subscription if duration specified
                if (payment.subscription_duration_days) {
                  const subscriptionEndDate = new Date(payment.payment_date);
                  subscriptionEndDate.setDate(subscriptionEndDate.getDate() + payment.subscription_duration_days);
                  
                  const subscriptionSuccess = await upsertSubscription(payment.wallet_address, subscriptionEndDate);
                  if (subscriptionSuccess) {
                    console.log(`Subscription updated for wallet: ${payment.wallet_address}`);
                  } else {
                    console.error(`Failed to update subscription for wallet: ${payment.wallet_address}`);
                  }
                }
              } else {
                console.error(`Failed to store payment for transaction: ${payment.transaction_hash}`);
              }
            }
            
            results.push({
              signature: signature || '',
              status: signature ? 'confirmed' : 'failed',
              payment: payment || null,
              subscriptionDetails: payment ? {
                walletAddress: payment.wallet_address,
                amountUsdc: payment.amount_usdc,
                durationDays: payment.subscription_duration_days || 0,
                plan: getPlanFromAmount(payment.amount_usdc, payment.subscription_duration_days || 0)
              } : null
            });
          } catch (error) {
            console.error(`Error processing transaction ${i}:`, error);
            results.push({
              signature: '',
              status: 'failed',
              payment: payment || null,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        return { 
          signatures: results.map(r => r.signature),
          transactions: results
        };
      } catch (error: any) {
        console.error('Error in transactions endpoint:', error);
        return { 
          signatures: body.transactions.map(() => ''),
          error: error.message || 'Failed to process transactions'
        };
      }
    },
    {
      body: t.Object({
        transactions: t.Array(t.String()),
        payments: t.Optional(t.Array(t.Object({
          transaction_hash: t.String(),
          wallet_address: t.String(),
          amount_usdc: t.Number(),
          payment_date: t.String(),
          subscription_duration_days: t.Optional(t.Number())
        })))
      }),
    }
  );
// Helper function to determine subscription plan from amount and duration
function getPlanFromAmount(amount: number, durationDays: number): string {
  if (durationDays === 30) {
    if (amount === 2) return 'Monthly Pro I';
    if (amount === 10) return 'Monthly Pro II';
  } else if (durationDays === 365) {
    if (amount === 20) return 'Yearly Pro I';
    if (amount === 100) return 'Yearly Pro II';
  }
  return 'Custom Plan';
}

export default confirm;