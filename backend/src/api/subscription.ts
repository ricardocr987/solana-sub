import { Elysia, t } from "elysia";
import { prepareTransaction } from '../solana/transaction/prepare';
import { config } from "../config";
import { BigNumber } from "bignumber.js";
import { getTokenBalance } from '../solana/getTokenBalance';
import { transferInstruction } from "../solana/transaction/transferInstruction";
import { address, compileTransaction, compressTransactionMessageUsingAddressLookupTables, getBase64EncodedWireTransaction, TransactionSigner } from "@solana/kit";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const subscription = new Elysia({ prefix: '/subscription' })
    .post('/transaction', async ({ body: { account, amount: uiAmount } }) => {
        try {
            const amount = uiAmount.replace(',', '.');
            const balance = await validateAmount(account, USDC_MINT, amount);
            if (!balance.isValid) {
                return Response.json(
                    { message: balance.message },
                    { status: 400 }
                );
            }

            const signer: TransactionSigner = {
                address: address(account),
                signTransactions: () => Promise.resolve([]),
            };
            const paymentInstruction = await transferInstruction(
                signer,
                BigInt(amount) * BigInt(10 ** 6),
                address(USDC_MINT),
                address(config.RECEIVER)
            );

            // Prepare transaction using Solana Kit - return the raw transaction message
            const transaction = await prepareTransaction(
                [paymentInstruction],
                account,
            );

            // Return the raw transaction message for the frontend to sign
            return { 
                transaction,
                amount: parseFloat(amount),
                metadata: {
                    tokenMint: USDC_MINT,
                    tokenSymbol: 'USDC',
                    tokenName: 'USD Coin',
                    tokenDecimals: 6,
                    tokenLogoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
                    receiverAddress: config.RECEIVER,
                    subscriptionPlans: {
                        monthly: {
                            pro1: { amount: 2, duration: 30 },
                            pro2: { amount: 10, duration: 30 }
                        },
                        yearly: {
                            pro1: { amount: 20, duration: 365 },
                            pro2: { amount: 100, duration: 365 }
                        }
                    }
                }
            };
        } catch (error) {
            console.error('Error building subscription transaction:', error);
            return Response.json(
                { message: 'Failed to build subscription transaction' },
                { status: 500 }
            );
        }
    },
    {
        body: t.Object({
            account: t.String(),
            amount: t.String(),
        }),
    }
    )
    /* webhook notifications could be more reliable that storing on confirmation endpoint
    .post('/transactionListener', async ({ body, headers }) => {
        try {
            const authToken = headers['authorization'];
            if (!authToken || authToken !== config.WEBHOOK_TOKEN) {
                console.error(`Unauthorized request`);
                return new Response(JSON.stringify({ error: "Unauthorized" }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const transactions = body as HeliusTransaction[];
            console.log('Received transactions:', transactions);

            for (const tx of transactions) {
                const paymentDetails = getSubscriptionPaymentDetails(tx);
                console.log('Payment details:', paymentDetails);
                if (!paymentDetails) continue;

                const subscriptionEndsAt = getSubscriptionEndsAt(paymentDetails.amount);
                if (!subscriptionEndsAt) {
                    console.log('Invalid subscription amount:', paymentDetails.amount);
                    continue;
                }

                console.log('Subscription payment received:', {
                    signature: paymentDetails.signature,
                    address: paymentDetails.signer,
                    amount: paymentDetails.amount,
                    subscriptionEndsAt,
                });

                const success = await addSubscriptionPayment(
                    paymentDetails.signer,
                    paymentDetails.signature,
                    paymentDetails.amount,
                    new Date(paymentDetails.timestamp * 1000), // Convert Unix timestamp to Date
                    paymentDetails.amount === 2 || paymentDetails.amount === 10 ? 30 : 365
                );

                console.log('Subscription db status:', success);
            }

            return { success: true, message: 'Transactions processed successfully' };
        } catch (error) {
            console.error('Failed to process transactions:', error);
            return { success: false, message: 'Failed to process transactions' };
        }
    })*/;

export default subscription;

export type ValidateAmount = {
  isValid: boolean;
  message?: string;
};

export async function validateAmount(
  account: string,
  inputToken: string,
  amount: string
): Promise<ValidateAmount> {
  const inputAmount = new BigNumber(amount);

  if (inputAmount.isLessThanOrEqualTo(0)) {
    return {
      isValid: false,
      message: 'Amount must be greater than 0!',
    };
  }

  try {
    const balance = await getTokenBalance(account, inputToken);
    if (!balance) {
      return {
        isValid: false,
        message: 'Token not found in wallet!',
      };
    }

    const userBalance = new BigNumber(balance.balance);
    if (inputAmount.isGreaterThan(userBalance)) {
      return {
        isValid: false,
        message: `Insufficient balance! You have ${userBalance.toFixed(4)} USDC`,
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Error validating token amount:', error);
    return {
      isValid: false,
      message: 'Failed to validate token amount',
    };
  }
}

