import { Keypair, SystemProgram } from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToCheckedInstruction,
} from "@solana/spl-token";

import { payer, connection, STATIC_PUBLICKEY } from "@/lib/vars";

import {
  buildTransaction,
  explorerURL,
  extractSignatureFromFailedTransaction,
  printConsoleSeparator,
  savePublicKeyToFile,
} from "@/lib/helpers";

(async () => {
    console.log("Payer address:", payer.publicKey.toBase58());
    console.log("Wallet address:", STATIC_PUBLICKEY.toBase58());
  
    // generate a new keypair to be used for our mint
    const mintKeypair = Keypair.generate();
  
    console.log("Mint address:", mintKeypair.publicKey.toBase58());
  
    // define the assorted token config settings
    const tokenConfig = {
      // define how many decimals we want our tokens to have
      decimals: 6,
      // the name of the token
      name: "Money",
      // the symbol of the token
      symbol: "$$$",
      // the URI pointing to the token's metadata
      uri: "https://raw.githubusercontent.com/trankhacvy/solana-bootcamp-autumn-2024/main/assets/sbs-token.json",
    };

    const createMintAccountInstruction = SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        // the `space` required for a token mint is accessible in the `@solana/spl-token` sdk
        space: MINT_SIZE,
        // store enough lamports needed for our `space` to be rent exempt
        lamports: await connection.getMinimumBalanceForRentExemption(MINT_SIZE),
        // tokens are owned by the "token program"
        programId: TOKEN_2022_PROGRAM_ID,
      });

    const tokenMint = mintKeypair.publicKey;
    
    // Create associated token account for payer
    const associatedTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        payer.publicKey,
        false, // allowOwnerOffCurve
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

    // Create associated token account for STATIC_PUBLICKEY
    const staticAssociatedTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        STATIC_PUBLICKEY,
        false, // allowOwnerOffCurve
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      const initializeMintInstruction = createInitializeMintInstruction(
        mintKeypair.publicKey,
        tokenConfig.decimals,
        payer.publicKey,
        payer.publicKey,
        TOKEN_2022_PROGRAM_ID,
      );

      const createAssociatedTokenAccountIx = createAssociatedTokenAccountInstruction(
        payer.publicKey,
        associatedTokenAccount,
        payer.publicKey, // owner
        tokenMint, // mint
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      // Create associated token account for STATIC_PUBLICKEY
      const createStaticAssociatedTokenAccountIx = createAssociatedTokenAccountInstruction(
        payer.publicKey,
        staticAssociatedTokenAccount,
        STATIC_PUBLICKEY, // owner
        tokenMint, // mint
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      const amountOfTokensToMintToOwner = 100_000_000; // 100 * 10**6
      const amountOfTokensToMintToStaticPublicKey = 10_000_000; // 10 * 10**6

      const mintToOwnerIx = createMintToCheckedInstruction(
        tokenMint,
        associatedTokenAccount,
        payer.publicKey, // mint authority
        amountOfTokensToMintToOwner, // amount
        tokenConfig.decimals, // decimals (should match tokenConfig)
        [], // multiSigners
        TOKEN_2022_PROGRAM_ID, // programId
      );

      const mintToStaticPublicKeyIx = createMintToCheckedInstruction(
        tokenMint,
        staticAssociatedTokenAccount, // Use the associated token account instead of STATIC_PUBLICKEY directly
        payer.publicKey, // mint authority
        amountOfTokensToMintToStaticPublicKey, // amount
        tokenConfig.decimals, // decimals
        [], // multiSigners
        TOKEN_2022_PROGRAM_ID, // programId
      );
    
      const tx = await buildTransaction({
        connection,
        payer: payer.publicKey,
        signers: [payer, mintKeypair],
        instructions: [
          createMintAccountInstruction, 
          initializeMintInstruction, 
          createAssociatedTokenAccountIx, 
          createStaticAssociatedTokenAccountIx, // Add this instruction
          mintToOwnerIx, 
          mintToStaticPublicKeyIx
        ],
      });
    
      try {
        // actually send the transaction
        const sig = await connection.sendTransaction(tx);
    
        // print the explorer url
        console.log("Transaction completed.");
        console.log(explorerURL({ txSignature: sig }));
        // locally save our addresses for the demo
        savePublicKeyToFile("tokenMint", mintKeypair.publicKey);
        savePublicKeyToFile("tokenAccount", mintKeypair.publicKey);
} catch (error) {
    console.error("Transaction failed:", error);
}
})();       