import { Elysia, t } from "elysia";
import { prepareTransaction } from '../solana/transaction/prepare';
import { config } from "../config";
import { BigNumber } from "bignumber.js";
import { getTokenBalance } from '../solana/getTokenBalance';
import { transferInstruction } from "../solana/transaction/transferInstruction";
import { address, TransactionSigner } from "@solana/kit";
import { getTokenMetadata } from "../solana/getTokenMetadata";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const subscription = new Elysia({ prefix: '/subscription' })
    .post('/transaction', async ({ body: { account, amount: uiAmount } }) => {
        try {
            const amount = uiAmount.replace(',', '.');
            await validateAmount(account, USDC_MINT, amount);

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
            
            // Extract the actual error message from the thrown error
            const errorMessage = error instanceof Error ? error.message : 'Failed to build subscription transaction';
            
            return Response.json(
                { message: errorMessage },
                { status: 400 }
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

export async function validateAmount(
    account: string,
    inputToken: string,
    amount: string
): Promise<void> {
    const inputAmount = new BigNumber(amount);
  
    if (inputAmount.isLessThanOrEqualTo(0)) 
      throw new Error('Amount must be greater than 0!');
    
    const balance = await getTokenBalance(account, inputToken);
    if (!balance) throw new Error('Token not found in wallet!');

    // The balance is returned as a string (UI amount)
    const userBalance = new BigNumber(balance);

    if (inputAmount.isGreaterThan(userBalance)) {
        const metadata = await getTokenMetadata(inputToken);
        if (!metadata) throw new Error('Token not found!');

        throw new Error(`Insufficient balance! You have ${userBalance.toFixed(4)} ${metadata.symbol}`);
    }
}  
