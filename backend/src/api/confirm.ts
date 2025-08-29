import Elysia, { t } from 'elysia';
import { addPayment, upsertSubscription, Payment } from '../db';
import { confirmTransactions, verifyTransactions, parseSubscriptionTransaction } from '../solana/confirm';

// Elysia endpoint
const confirm = new Elysia({ prefix: '/confirm' })
  .post(
    '/transactions',
    async ({ body }) => {
      try {
        const { transactions, payments } = body;
        console.log('transactions', transactions.length);
        console.log('payments', payments?.length || 0);
        
        // Use the new confirmTransactions function
        const signatures = await confirmTransactions(transactions);

        // Verify all transactions at once
        const verifiedSignatures = await verifyTransactions(signatures);

        // Store only confirmed payments
        if (payments && payments.length > 0 && verifiedSignatures.length > 0) {
          for (let i = 0; i < Math.min(payments.length, verifiedSignatures.length); i++) {
            const signature = verifiedSignatures[i];
            const payment = payments[i];
            
            if (signature && payment) {
              // Transaction confirmed successfully - store the payment
              const success = await addPayment({
                ...payment,
                payment_date: new Date(payment.payment_date),
                status: 'confirmed'
              });
              
              if (success) {
                console.log(`Payment stored for confirmed transaction: ${payment.transaction_hash}`);
                
                // Create or update subscription record
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
            } else {
              console.log(`Transaction failed or not found for payment: ${payment.transaction_hash}`);
            }
          }
        }

        return { signatures: verifiedSignatures };
      } catch (error: any) {
        console.error(
          'Error in transactions endpoint:',
          error,
          'transactions',
          body.transactions
        );
        return { signatures: body.transactions.map(() => '') };
      }
    },
    {
      body: t.Object({
        transactions: t.Array(t.String()),
        payments: t.Optional(t.Array(t.Object({
          transaction_hash: t.String(),
          wallet_address: t.String(),
          amount_usdc: t.Number(),
          payment_date: t.String(), // ISO date string
          subscription_duration_days: t.Optional(t.Number())
        })))
      }),
    }
  )
  .post(
    '/confirm',
    async ({ body: { transaction } }) => {
      try {
        // Parse the subscription transaction to extract details
        const subscriptionDetails = await parseSubscriptionTransaction(transaction);
        
        if (!subscriptionDetails) {
          return Response.json(
            { message: 'Failed to parse subscription transaction or invalid transaction' },
            { status: 400 }
          );
        }

        // Validate subscription details
        if (!subscriptionDetails.walletAddress || subscriptionDetails.amountUsdc < 2) {
          return Response.json(
            { message: 'Invalid subscription details: missing wallet address or insufficient amount' },
            { status: 400 }
          );
        }

        console.log('Parsed subscription details:', subscriptionDetails);

        // Send the transaction for confirmation
        const signature = await confirmTransactions([transaction]);
        
        if (signature[0]) {
          // Store the payment in the database
          const paymentData = {
            transaction_hash: signature[0],
            wallet_address: subscriptionDetails.walletAddress,
            amount_usdc: subscriptionDetails.amountUsdc,
            payment_date: new Date(),
            subscription_duration_days: subscriptionDetails.subscriptionDurationDays,
            status: 'pending' as const // Will be updated to 'confirmed' after verification
          };

          const paymentSuccess = await addPayment(paymentData);
          
          if (!paymentSuccess) {
            console.error('Failed to store payment in database');
            return Response.json(
              { message: 'Failed to store payment in database' },
              { status: 500 }
            );
          }

          // Create or update subscription record
          const subscriptionEndDate = new Date();
          subscriptionEndDate.setDate(subscriptionEndDate.getDate() + subscriptionDetails.subscriptionDurationDays);
          
          const subscriptionSuccess = await upsertSubscription(
            subscriptionDetails.walletAddress, 
            subscriptionEndDate
          );
          
          if (!subscriptionSuccess) {
            console.error('Failed to update subscription in database');
            // Don't fail the entire request, just log the error
          }

          console.log(`Subscription processed successfully for wallet: ${subscriptionDetails.walletAddress}`);
          console.log(`Amount: ${subscriptionDetails.amountUsdc} USDC`);
          console.log(`Duration: ${subscriptionDetails.subscriptionDurationDays} days`);
          console.log(`End date: ${subscriptionEndDate.toISOString()}`);

          return { 
            signature: signature[0],
            subscriptionDetails: {
              signature: signature[0],
              wallet_address: subscriptionDetails.walletAddress,
              amount_usdc: subscriptionDetails.amountUsdc,
              subscription_duration_days: subscriptionDetails.subscriptionDurationDays,
              subscription_end_date: subscriptionEndDate.toISOString(),
              status: 'confirmed'
            }
          };
        } else {
          return Response.json(
            { message: 'Transaction confirmation failed' },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error('Error confirming transaction:', error);
        return Response.json(
          { message: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      body: t.Object({
        transaction: t.String(),
      }),
    }
  );

export default confirm;