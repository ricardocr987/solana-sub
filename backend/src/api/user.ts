import { Elysia } from "elysia";
import { getSubscriptionByWallet, getPaymentsByWallet, createSampleDataForWallet } from "../db";

const user = new Elysia({ prefix: "/user" })
  .get("/plan/:wallet", async ({ params: { wallet } }) => {
    try {
      console.log(`Fetching user plan for wallet: ${wallet}`);
      
      // Get current subscription
      const subscription = await getSubscriptionByWallet(wallet);
      console.log('Subscription data:', subscription);
      
      // Get payment history
      const payments = await getPaymentsByWallet(wallet);
      console.log('Payment data:', payments);
      
      // Determine current plan based on subscription status
      let currentPlan = "Free";
      let subscriptionEndDate = null;
      let isActive = false;
      
      if (subscription && subscription.subscription_end_date) {
        const now = new Date();
        const endDate = new Date(subscription.subscription_end_date);
        
        if (endDate > now) {
          isActive = true;
          // Always convert to string to avoid Date object issues
          subscriptionEndDate = String(subscription.subscription_end_date);
          
          // Determine plan based on payment amount
          const latestPayment = payments.find(p => p.status === 'confirmed');
          if (latestPayment) {
            if (latestPayment.amount_usdc >= 100) {
              currentPlan = "Yearly Pro II";
            } else if (latestPayment.amount_usdc >= 20) {
              currentPlan = "Yearly Pro I";
            } else if (latestPayment.amount_usdc >= 10) {
              currentPlan = "Monthly Pro II";
            } else if (latestPayment.amount_usdc >= 2) {
              currentPlan = "Monthly Pro I";
            } else if (latestPayment.amount_usdc > 0) {
              currentPlan = "Custom Plan";
            }
          }
        }
      }
      
      // Format payment history for frontend
      const formattedPayments = payments.map(payment => ({
        id: payment.id,
        date: payment.payment_date.toISOString().split('T')[0], // YYYY-MM-DD format
        amount: `$${payment.amount_usdc.toFixed(2)}`,
        plan: getPlanName(payment.amount_usdc),
        status: payment.status === 'confirmed' ? 'Completed' : payment.status === 'pending' ? 'Pending' : 'Failed',
        transaction_hash: payment.transaction_hash
      }));
      
      const response = {
        success: true,
        data: {
          currentPlan: {
            name: currentPlan,
            isActive,
            subscriptionEndDate,
            walletAddress: wallet
          },
          paymentHistory: formattedPayments
        }
      };
      
      console.log('Sending response:', response);
      return response;
    } catch (error) {
      console.error("Error fetching user plan:", error);
      return {
        success: false,
        error: "Failed to fetch user plan"
      };
    }
  })
  .post("/create-sample-data", async ({ body }) => {
    try {
      const { walletAddress } = body as { walletAddress: string };
      
      if (!walletAddress) {
        return {
          success: false,
          error: "Wallet address is required"
        };
      }
      
      const result = await createSampleDataForWallet(walletAddress);
      
      if (result) {
        return {
          success: true,
          message: "Sample data created successfully"
        };
      } else {
        return {
          success: false,
          error: "Failed to create sample data"
        };
      }
    } catch (error) {
      console.error("Error creating sample data:", error);
      return {
        success: false,
        error: "Failed to create sample data"
      };
    }
  })
  .get("/debug/:wallet", async ({ params: { wallet } }) => {
    try {
      console.log(`Debug request for wallet: ${wallet}`);
      
      // Get raw data from database
      const subscription = await getSubscriptionByWallet(wallet);
      const payments = await getPaymentsByWallet(wallet);
      
      return {
        success: true,
        data: {
          wallet,
          subscription,
          payments,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error("Error in debug endpoint:", error);
      return {
        success: false,
        error: "Debug failed"
      };
    }
  });

// Helper function to determine plan name based on amount
function getPlanName(amount: number): string {
  if (amount >= 100) {
    return "Yearly Pro II";
  } else if (amount >= 20) {
    return "Yearly Pro I";
  } else if (amount >= 10) {
    return "Monthly Pro II";
  } else if (amount >= 2) {
    return "Monthly Pro I";
  } else if (amount > 0) {
    return "Custom Plan";
  }
  return "Free";
}

export default user;

