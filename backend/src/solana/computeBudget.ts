import { pipe } from '@solana/kit';
import {
  createTransactionMessage,
  setTransactionMessageFeePayer,
  appendTransactionMessageInstructions,
  setTransactionMessageLifetimeUsingBlockhash,
  compileTransaction,
  getBase64EncodedWireTransaction,
  type Instruction,
  Base64EncodedWireTransaction,
  AddressesByLookupTableAddress,
  compressTransactionMessageUsingAddressLookupTables,
  Blockhash,
  address,
} from '@solana/kit';
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from '@solana-program/compute-budget';
import { QUICKNODE_RPC, config } from '../config';

export const PRIORITY_LEVELS = {
  MIN: 'Min',
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  VERY_HIGH: 'VeryHigh',
  UNSAFE_MAX: 'UnsafeMax',
} as const;

export type PriorityLevel = keyof typeof PRIORITY_LEVELS;

interface PriorityFeeOptions {
  priorityLevel?: PriorityLevel;
  lookbackSlots?: number;
  includeVote?: boolean;
  recommended?: boolean;
  evaluateEmptySlotAsZero?: boolean;
}

export interface PriorityFeeResponse {
  jsonrpc: string;
  result: {
    priorityFeeEstimate: number;
    priorityFeeLevels?: {
      min: number;
      low: number;
      medium: number;
      high: number;
      veryHigh: number;
      unsafeMax: number;
    };
  };
  id: string;
}

const DEFAULT_COMPUTE_UNITS = 1_400_000;
const DEFAULT_PRIORITY_FEE = 50000;

async function getComputeUnits(
  wireTransaction: Base64EncodedWireTransaction
): Promise<number> {
  console.log('wireTransaction', wireTransaction.length)
  const simulation = await QUICKNODE_RPC
    .simulateTransaction(wireTransaction, {
      sigVerify: false,
      encoding: 'base64',
    })
    .send();

  if (simulation.value.err && simulation.value.logs) {
    if ((simulation.value.err as any).InsufficientFundsForRent) {
      throw new Error('You need more SOL to pay for transaction fees');
    }

    if (simulation.value.logs.length === 0) {
      throw new Error('You need more SOL to pay for transaction fees');
    }

    const numLogs = simulation.value.logs.length;
    const lastLogs = simulation.value.logs.slice(Math.max(numLogs - 10, 0));
    console.log(`Last ${lastLogs.length} Solana simulation logs:`, lastLogs);
    console.log('base64 encoded transaction:', wireTransaction);

    for (const log of simulation.value.logs) {
      if (log.includes('InvalidLockupAmount')) {
        throw new Error('Invalid staked amount: Should be > 1');
      }
      if (log.includes('0x1771') || log.includes('0x178c')) {
        throw new Error('Maximum slippage reached');
      }
      if (
        log.includes(
          'Program 11111111111111111111111111111111 failed: custom program error: 0x1'
        ) ||
        log.includes('insufficient lamports')
      ) {
        throw new Error('You need more SOL to pay for transaction fees');
      }
    }

    throw new Error('Transaction simulation error');
  }

  return Number(simulation.value.unitsConsumed) || DEFAULT_COMPUTE_UNITS;
}

async function getPriorityFeeEstimate(
  wireTransaction: string,
  options: PriorityFeeOptions = {}
): Promise<number> {
  try {
    // Use QuickNode's getRecentPrioritizationFees RPC method
    const response = await fetch(config.QUICKNODE_RPC_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getRecentPrioritizationFees',
        params: [], // Empty array means all recent fees
      }),
    });

    const data = await response.json();

    if (!data || !data.result || !Array.isArray(data.result)) {
      console.log('No priority fee data returned from QuickNode');
      return DEFAULT_PRIORITY_FEE;
    }

    // Calculate average priority fee from recent blocks
    const fees = data.result
      .filter((item: any) => item.prioritizationFee !== null && item.prioritizationFee !== undefined)
      .map((item: any) => item.prioritizationFee);

    if (fees.length === 0) {
      console.log('No valid priority fees found in recent blocks');
      return DEFAULT_PRIORITY_FEE;
    }

    // Calculate the median fee for better stability
    const sortedFees = fees.sort((a: number, b: number) => a - b);
    const medianIndex = Math.floor(sortedFees.length / 2);
    let medianFee = sortedFees[medianIndex];

    // If even number of fees, take average of two middle values
    if (sortedFees.length % 2 === 0) {
      medianFee = (sortedFees[medianIndex - 1] + sortedFees[medianIndex]) / 2;
    }

    // Apply constraints and ensure we return a reasonable fee
    const constrainedFee = Math.min(Math.max(medianFee, DEFAULT_PRIORITY_FEE), DEFAULT_PRIORITY_FEE * 10);
    
    console.log(`Priority fee estimate from QuickNode: ${constrainedFee} microlamports per compute unit`);
    return constrainedFee;
  } catch (error) {
    console.error('Error getting priority fee estimate from QuickNode:', error);
    return DEFAULT_PRIORITY_FEE;
  }
}

async function simulateAndGetBudget(
  instructions: Instruction<string>[],
  feePayer: string,
  lookupTableAccounts: AddressesByLookupTableAddress,
  latestBlockhash: Readonly<{
    blockhash: Blockhash;
    lastValidBlockHeight: bigint;
  }>,
  priorityLevel: PriorityLevel
): Promise<[Instruction<string>, Instruction<string>]> {
  const payer = address(feePayer);
  const finalInstructions = [
    getSetComputeUnitLimitInstruction({
      units: DEFAULT_COMPUTE_UNITS,
    }),
    getSetComputeUnitPriceInstruction({
      microLamports: DEFAULT_PRIORITY_FEE,
    }),
    ...instructions,
  ];
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(finalInstructions, tx)
  );

  const messageWithLookupTables =
    compressTransactionMessageUsingAddressLookupTables(
      message,
      lookupTableAccounts
    );

  const compiledMessage = compileTransaction(messageWithLookupTables);
  const wireTransaction = getBase64EncodedWireTransaction(compiledMessage);
  const [computeUnits, priorityFee] = await Promise.all([
    getComputeUnits(wireTransaction),
    getPriorityFeeEstimate(wireTransaction, {
      priorityLevel,
      lookbackSlots: 150,
      includeVote: false,
      evaluateEmptySlotAsZero: true,
    }),
  ]);

  console.log('computeUnits:', computeUnits);

  const computeBudgetIx = getSetComputeUnitLimitInstruction({
    units: Math.ceil(computeUnits * 1.1),
  });

  const priorityFeeIx = getSetComputeUnitPriceInstruction({
    microLamports: priorityFee,
  });

  return [computeBudgetIx, priorityFeeIx];
}

export async function getComputeBudget(
  instructions: Instruction<string>[],
  feePayer: string,
  lookupTableAccounts: AddressesByLookupTableAddress,
  latestBlockhash: Readonly<{
    blockhash: Blockhash;
    lastValidBlockHeight: bigint;
  }>,
  priorityLevel: PriorityLevel = 'MEDIUM'
): Promise<Instruction<string>[]> {
  try {
    console.log('calling simulateAndGetBudget');
    const [computeBudgetIx, priorityFeeIx] = await simulateAndGetBudget(
      instructions,
      feePayer,
      lookupTableAccounts,
      latestBlockhash,
      priorityLevel
    );

    return [computeBudgetIx, priorityFeeIx, ...instructions];
  } catch (error) {
    throw error;
  }
}
