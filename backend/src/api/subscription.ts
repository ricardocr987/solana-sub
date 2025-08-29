import { Elysia, t } from "elysia";
import { prepareTransaction } from '../solana/prepareTransaction';
import { config } from "../config";
import { BigNumber } from "bignumber.js";
import { getTokenBalance } from '../solana/getTokenBalance';
import { transferInstruction } from "../solana/transferInstruction";
import { address, TransactionSigner } from "@solana/kit";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const subscription = new Elysia({ prefix: '/subscription' })
    .post('/transaction', async ({ body: { account, amount: uiAmount } }) => {
        try {
            const amount = uiAmount.replace(',', '.');

            const validate = await validateAmount(account, USDC_MINT, amount);
            if (!validate.isValid) {
                return Response.json(
                    { message: validate.message },
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

            // Prepare transaction using Solana Kit
            const transaction = await prepareTransaction(
                [paymentInstruction],
                account,
                {} // Empty lookup table accounts for now
            );

            return { 
                transaction,
                amount: parseFloat(amount)
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

// IF AMOUNT IS 2 IS MONTHLY PRO I, IF AMOUNT IS 20 IS YEARLY PRO I
// IF AMOUNT IS 10 IS MONTHLY PRO II, IF AMOUNT IS 100 IS YEARLY PRO II
function getSubscriptionEndsAt(amount: number) {
    if (amount === 2) {
        return Date.now() + 30 * 24 * 60 * 60 * 1000; // Monthly Pro I
    }
    if (amount === 20) {
        return Date.now() + 365 * 24 * 60 * 60 * 1000; // Yearly Pro I
    }
    if (amount === 10) {
        return Date.now() + 30 * 24 * 60 * 60 * 1000; // Monthly Pro II
    }
    if (amount === 100) {
        return Date.now() + 365 * 24 * 60 * 60 * 1000; // Yearly Pro II
    }
        
    return null;
}

interface TokenBalance {
    accountIndex: number;
    mint: string;
    owner: string;
    programId: string;
    uiTokenAmount: {
        amount: string;
        decimals: number;
        uiAmount: number;
        uiAmountString: string;
    };
}

interface HeliusTransactionInstruction {
    accounts: number[];
    data: string;
    programIdIndex: number;
}

interface InnerInstruction {
    index: number;
    instructions: HeliusTransactionInstruction[];
}

interface TransactionMeta {
    err: any;
    fee: number;
    innerInstructions: InnerInstruction[];
    loadedAddresses: {
        readonly: string[];
        writable: string[];
    };
    logMessages: string[];
    postBalances: number[];
    postTokenBalances: TokenBalance[];
    preBalances: number[];
    preTokenBalances: TokenBalance[];
    rewards: any[];
}

interface TransactionMessage {
    accountKeys: string[];
    addressTableLookups: any | null;
    header: {
        numReadonlySignedAccounts: number;
        numReadonlyUnsignedAccounts: number;
        numRequiredSignatures: number;
    };
    instructions: HeliusTransactionInstruction[];
    recentBlockhash: string;
}

interface HeliusTransaction {
    blockTime: number;
    indexWithinBlock: number;
    meta: TransactionMeta;
    slot: number;
    transaction: {
        message: TransactionMessage;
        signatures: string[];
    };
}

interface SubscriptionPaymentDetails {
    signer: string;
    amount: number;
    timestamp: number;
    signature: string;
}

/**
 * Extracts subscription payment details from a transaction
 * @param transaction The transaction data from Helius webhook
 * @returns Payment details if valid subscription payment, null otherwise
 */
function getSubscriptionPaymentDetails(transaction: HeliusTransaction): SubscriptionPaymentDetails | null {
    try {
        const message = transaction?.transaction?.message;
        if (!message) return null;

        // Get the signer (first required signature)
        const signerIndex = message.header.numRequiredSignatures > 0 ? 0 : -1;
        if (signerIndex === -1) return null;

        const signer = message.accountKeys[signerIndex];
        if (!signer) return null;

        // Get pre and post token balances
        const preBalances = transaction?.meta?.preTokenBalances || [];
        const postBalances = transaction?.meta?.postTokenBalances || [];

        // Find USDC balances for all accounts
        const preBalanceMap = new Map<number, TokenBalance>();
        const postBalanceMap = new Map<number, TokenBalance>();

        // Map all USDC balances by account index
        for (const balance of preBalances) {
            if (balance.mint === USDC_MINT) {
                preBalanceMap.set(balance.accountIndex, balance);
            }
        }
        for (const balance of postBalances) {
            if (balance.mint === USDC_MINT) {
                postBalanceMap.set(balance.accountIndex, balance);
            }
        }

        // Look for accounts that had balance changes
        const changes: Array<{accountIndex: number, owner: string, difference: BigNumber}> = [];
        
        // Check all accounts that appear in either pre or post balances
        const allAccountIndexes = new Set([...preBalanceMap.keys(), ...postBalanceMap.keys()]);
        
        for (const accountIndex of allAccountIndexes) {
            const pre = preBalanceMap.get(accountIndex);
            const post = postBalanceMap.get(accountIndex);
            
            if (pre || post) {
                const preAmount = pre ? new BigNumber(pre.uiTokenAmount.amount) : new BigNumber(0);
                const postAmount = post ? new BigNumber(post.uiTokenAmount.amount) : new BigNumber(0);
                const difference = postAmount.minus(preAmount);
                
                if (!difference.isZero()) {
                    changes.push({
                        accountIndex,
                        owner: (post || pre)!.owner,
                        difference
                    });
                }
            }
        }

        // Find the payment - there should be a negative change (from sender) and positive change (to receiver)
        const negativeChange = changes.find(c => c.difference.isNegative());
        const positiveChange = changes.find(c => c.difference.isPositive());

        if (!negativeChange || !positiveChange) return null;

        // Verify one of the accounts is our payment receiver
        if (positiveChange.owner !== config.RECEIVER) return null;

        // The amount should be the positive change (what the receiver got)
        const amount = positiveChange.difference.gt(0) ? positiveChange.difference.dividedBy(10 ** 6).toNumber() : null;
        if (!amount) return null;

        return {
            signer,
            amount,
            timestamp: transaction.blockTime,
            signature: transaction.transaction.signatures[0]
        };
    } catch (error) {
        console.error('Error getting subscription payment details:', error);
        return null;
    }
}

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

