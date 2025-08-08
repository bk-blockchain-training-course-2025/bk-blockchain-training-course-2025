import {
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  PublicKey,
} from "@solana/web3.js";
import { payer, connection, STATIC_PUBLICKEY } from "@/lib/vars";
import { explorerURL, printConsoleSeparator } from "@/lib/helpers";

(async () => {
  // 1. Generate a new account
  const newAccount = Keypair.generate();
  console.log("New account pubkey:", newAccount.publicKey.toBase58());

  // 2. Calculate rent-exempt minimum (0 space, so just for lamports)
  const space = 0;
  const rentExemptLamports = await connection.getMinimumBalanceForRentExemption(space);
  const transferLamports = 0.1 * LAMPORTS_PER_SOL;
  // We'll fund the new account with enough to cover the transfer and rent
  const initialLamports = rentExemptLamports + transferLamports;

  // 3. Create the new account (payer funds it)
  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: newAccount.publicKey,
    lamports: initialLamports,
    space,
    programId: SystemProgram.programId,
  });

  // 4. Transfer 0.1 SOL from new account to STATIC_PUBLICKEY
  const transferIx = SystemProgram.transfer({
    fromPubkey: newAccount.publicKey,
    toPubkey: STATIC_PUBLICKEY,
    lamports: transferLamports,
    programId: SystemProgram.programId,
  });

  // 5. Close the new account (send remaining lamports back to payer)
  // SystemProgram does not have a closeAccount, but for system accounts,
  // you can "close" by transferring all remaining lamports out and leaving 0 balance.
  // We'll transfer all remaining lamports (should be rentExemptLamports) back to payer.
  const closeIx = SystemProgram.transfer({
    fromPubkey: newAccount.publicKey,
    toPubkey: payer.publicKey,
    lamports: rentExemptLamports,
    programId: SystemProgram.programId,
  });

  // 6. Build the transaction
  const {
    context: { slot: minContextSlot },
    value: { blockhash, lastValidBlockHeight },
  } = await connection.getLatestBlockhashAndContext();

  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [createAccountIx, transferIx, closeIx],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([payer, newAccount]);

  // 7. Send the transaction
  const signature = await connection.sendTransaction(tx, { minContextSlot });
  await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });

  printConsoleSeparator();
  console.log("Transaction completed.");
  console.log("Signature:", signature);
  console.log(explorerURL({ txSignature: signature }));
})(); 