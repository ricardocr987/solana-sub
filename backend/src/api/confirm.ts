import Elysia, { t } from 'elysia';
import { validateTransaction } from '../solana/transaction/validate';
import { sendTransaction } from '../solana/transaction/send';
import { rpc } from '../solana/rpc';
import { Signature } from '@solana/kit';

// Elysia endpoint
const confirm = new Elysia({ prefix: '/confirm' })
  .post(
    '/transactions',
    async ({ body }) => {
      try {
        const { transactions, payments } = body;
        console.log('Processing transactions:', transactions.length);
        console.log('Payments:', payments?.length || 0);
        
        // Process transactions in parallel for better performance
        const transactionPromises = transactions.map(async (transaction, i) => {
          const payment = payments?.[i];
          
          try {
            console.log(`Processing transaction ${i + 1}/${transactions.length}`);
            
            // Send and confirm the transaction using the simplified function
            const signature = await sendTransaction(transaction);
            
            if (signature && payment) {
              try {
                // Fetch the confirmed transaction to pass to validateTransaction
                const confirmedTransaction = await rpc.getTransaction(signature as Signature, {
                  commitment: 'confirmed',
                  encoding: 'jsonParsed',
                  maxSupportedTransactionVersion: 0,
                }).send();

                if (!confirmedTransaction) {
                  throw new Error('Failed to fetch confirmed transaction');
                }

                // Check if transaction failed
                if (confirmedTransaction.meta?.err) {
                  throw new Error(`Transaction failed: ${JSON.stringify(confirmedTransaction.meta.err)}`);
                }

                // Use validate.ts to handle payment storage and subscription management
                const validatedSubscription = await validateTransaction(
                  signature,
                  confirmedTransaction
                );
                
                console.log(`Payment validated and stored for transaction: ${payment.transaction_hash}`);
                console.log(`Subscription plan: ${validatedSubscription.planType}`);
                console.log(`Duration: ${validatedSubscription.subscriptionDurationDays} days`);
                
                return {
                  signature: signature,
                  status: 'confirmed',
                  payment: payment,
                  subscriptionDetails: {
                    walletAddress: payment.wallet_address,
                    amountUsdc: payment.amount_usdc,
                    durationDays: payment.subscription_duration_days || 0,
                    plan: validatedSubscription.planType
                  }
                };
                
              } catch (error) {
                console.error(`Failed to validate transaction ${signature}:`, error);
                return {
                  signature: signature,
                  status: 'confirmed_but_validation_failed',
                  payment: payment,
                  error: error instanceof Error ? error.message : 'Validation failed'
                };
              }
            } else {
              return {
                signature: signature || '',
                status: signature ? 'confirmed' : 'failed',
                payment: payment || null,
                subscriptionDetails: payment ? {
                  walletAddress: payment.wallet_address,
                  amountUsdc: payment.amount_usdc,
                  durationDays: payment.subscription_duration_days || 0,
                  plan: 'Subscription Plan'
                } : null
              };
            }
          } catch (error) {
            console.error(`Error processing transaction ${i}:`, error);
            return {
              signature: '',
              status: 'failed',
              payment: payment || null,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        });

        // Wait for all transactions to complete
        const results = await Promise.all(transactionPromises);

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


export default confirm;