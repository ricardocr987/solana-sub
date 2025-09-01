import { pipe } from '@solana/functional';
import {
  createTransactionMessage,
  setTransactionMessageFeePayer,
  appendTransactionMessageInstructions,
  setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
  address,
  compileTransaction,
  getBase64EncodedWireTransaction,
} from '@solana/kit';
import { getComputeBudget } from './compute';
import { rpc } from '../rpc';

export async function prepareTransaction(
  instructions: Instruction<string>[],
  feePayer: string,
): Promise<string> {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const finalInstructions = await getComputeBudget(
    instructions,
    feePayer,
    {},
    latestBlockhash
  );
  const payer = address(feePayer);
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    tx => setTransactionMessageFeePayer(payer, tx),
    tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    tx => appendTransactionMessageInstructions(finalInstructions, tx),
  );
  const compiledMessage = compileTransaction(message);
  
  return getBase64EncodedWireTransaction(compiledMessage).toString();
}
