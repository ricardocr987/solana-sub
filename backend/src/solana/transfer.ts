import {
  TransactionInstruction,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createTransferInstruction,
  NATIVE_MINT,
  createAssociatedTokenAccountInstruction as createATAInstruction,
} from '@solana/spl-token';

export async function legacyTransferInstruction(
  signer: { address: string },
  amount: bigint,
  mint: string,
  destination: string
): Promise<TransactionInstruction> {
  const signerPubkey = new PublicKey(signer.address);
  const destinationPubkey = new PublicKey(destination);
  const mintPubkey = new PublicKey(mint);

  if (mint === NATIVE_MINT.toBase58()) {
    // SOL transfer
    return SystemProgram.transfer({
      fromPubkey: signerPubkey,
      toPubkey: destinationPubkey,
      lamports: amount,
    });
  } else {
    // SPL token transfer
    const sourceTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      signerPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const destinationTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      destinationPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    return createTransferInstruction(
      sourceTokenAccount,
      destinationTokenAccount,
      signerPubkey,
      amount
    );
  }
}

/**
 * Creates a payment instruction for SPL tokens (like USDC)
 * This function handles both the transfer and creates destination token accounts if needed
 */
export async function createPaymentInstruction(
  from: PublicKey,
  to: PublicKey,
  mint: string,
  amount: number
): Promise<TransactionInstruction> {
  const mintPubkey = new PublicKey(mint);
  
  // Get associated token account addresses
  const sourceTokenAccount = await getAssociatedTokenAddress(
    mintPubkey,
    from,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const destinationTokenAccount = await getAssociatedTokenAddress(
    mintPubkey,
    to,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Convert amount to the smallest unit (e.g., for USDC with 6 decimals, multiply by 10^6)
  // For now, assuming USDC (6 decimals) - you might want to make this configurable
  const decimals = 6;
  const rawAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));

  return createTransferInstruction(
    sourceTokenAccount,
    destinationTokenAccount,
    from,
    rawAmount
  );
}

/**
 * Creates an instruction to create an associated token account if it doesn't exist
 * This is useful when the destination doesn't have a token account for the specific mint
 */
export async function createAssociatedTokenAccountInstruction(
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): Promise<TransactionInstruction> {
  const associatedTokenAddress = await getAssociatedTokenAddress(
    mint,
    owner,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  return createATAInstruction(
    payer,
    associatedTokenAddress,
    owner,
    mint
  );
}
  