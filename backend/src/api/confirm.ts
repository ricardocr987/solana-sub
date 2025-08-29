import Elysia, { t } from 'elysia';
import { addPayment, Payment } from '../db';
import { confirmTransactions, verifyTransactions } from '../solana/confirm';

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

export default confirm;