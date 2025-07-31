import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";
import { Escrow } from "../target/types/escrow";

describe("escrow", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.escrow as Program<Escrow>;
  const provider = anchor.getProvider();

  // Test accounts
  let maker: Keypair;
  let taker: Keypair;
  let tokenMintA: PublicKey;
  let tokenMintB: PublicKey;
  let makerTokenAccountA: PublicKey;
  let takerTokenAccountB: PublicKey;

  // Test constants
  const offerId = new anchor.BN(1);
  const tokenAOfferedAmount = new anchor.BN(1_000_000); // 1 token with 6 decimals
  const tokenBWantedAmount = new anchor.BN(2_000_000); // 2 tokens with 6 decimals

  before(async () => {
    maker = Keypair.generate();
    taker = Keypair.generate();

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        maker.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      )
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        taker.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      )
    );

    tokenMintA = await createMint(
      provider.connection,
      maker,
      maker.publicKey,
      maker.publicKey,
      6 
    );

    tokenMintB = await createMint(
      provider.connection,
      taker,
      taker.publicKey,
      taker.publicKey,
      6 
    );

    makerTokenAccountA = await createAccount(
      provider.connection,
      maker,
      tokenMintA,
      maker.publicKey
    );

    takerTokenAccountB = await createAccount(
      provider.connection,
      taker,
      tokenMintB,
      taker.publicKey
    );

    await mintTo(
      provider.connection,
      maker,
      tokenMintA,
      makerTokenAccountA,
      maker,
      100_000_000
    );

    await mintTo(
      provider.connection,
      taker,
      tokenMintB,
      takerTokenAccountB,
      taker,
      100_000_000
    );
  });

  describe("make_offer", () => {
    it("should create an offer successfully", async () => {
      const [offer] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("offer"),
          maker.publicKey.toBuffer(),
          offerId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const initialBalance = await getAccount(
        provider.connection,
        makerTokenAccountA
      );

      const tx = await program.methods
        .makeOffer(offerId, tokenAOfferedAmount, tokenBWantedAmount)
        .accountsPartial({
          maker: maker.publicKey,
          tokenMintA,
          tokenMintB,
          offer,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maker])
        .rpc();

      console.log("Make offer transaction signature:", tx);

      const offerAccount = await program.account.offer.fetch(offer);
      expect(offerAccount.id.toString()).to.equal(offerId.toString());
      expect(offerAccount.maker.toString()).to.equal(
        maker.publicKey.toString()
      );
      expect(offerAccount.tokenMintA.toString()).to.equal(
        tokenMintA.toString()
      );
      expect(offerAccount.tokenMintB.toString()).to.equal(
        tokenMintB.toString()
      );
      expect(offerAccount.tokenBWantedAmount.toString()).to.equal(
        tokenBWantedAmount.toString()
      );

      const [vault] = PublicKey.findProgramAddressSync(
        [offer.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), tokenMintA.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const vaultAccount = await getAccount(provider.connection, vault);
      expect(vaultAccount.amount.toString()).to.equal(
        tokenAOfferedAmount.toString()
      );

      const finalBalance = await getAccount(
        provider.connection,
        makerTokenAccountA
      );
      expect(finalBalance.amount.toString()).to.equal(
        (
          initialBalance.amount - BigInt(tokenAOfferedAmount.toNumber())
        ).toString()
      );
    });

    it("should fail with insufficient funds", async () => {
      const newOfferId = new anchor.BN(2);
      const excessiveAmount = new anchor.BN(10_000_000); // More than available

      const [offer] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("offer"),
          maker.publicKey.toBuffer(),
          newOfferId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      try {
        await program.methods
          .makeOffer(newOfferId, excessiveAmount, tokenBWantedAmount)
          .accountsPartial({
            maker: maker.publicKey,
            tokenMintA,
            tokenMintB,
            offer,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([maker])
          .rpc();

        expect.fail("Expected transaction to fail due to insufficient funds");
      } catch (error) {
        expect(error.message).to.include("insufficient funds");
      }
    });
  });

  describe("take_offer", () => {
    let offerPda: PublicKey;
    let vaultPda: PublicKey;

    before(async () => {
      [offerPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("offer"),
          maker.publicKey.toBuffer(),
          offerId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      [vaultPda] = PublicKey.findProgramAddressSync(
        [
          offerPda.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          tokenMintA.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
    });

    it("should complete the trade successfully", async () => {
      const [takerTokenAccountA] = PublicKey.findProgramAddressSync(
        [
          taker.publicKey.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          tokenMintA.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const [makerTokenAccountB] = PublicKey.findProgramAddressSync(
        [
          maker.publicKey.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          tokenMintB.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const takerInitialBalanceB = await getAccount(
        provider.connection,
        takerTokenAccountB
      );
      const vaultInitialBalance = await getAccount(
        provider.connection,
        vaultPda
      );

      const tx = await program.methods
        .takeOffer()
        .accountsPartial({
          taker: taker.publicKey,
          maker: maker.publicKey,
          tokenMintA: tokenMintA,
          tokenMintB: tokenMintB,
          takerTokenAccountA: takerTokenAccountA,
          takerTokenAccountB: takerTokenAccountB,
          makerTokenAccountB: makerTokenAccountB,
          offer: offerPda,
          vault: vaultPda,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([taker])
        .rpc();

      console.log("Take offer transaction signature:", tx);

      const takerFinalBalanceA = await getAccount(
        provider.connection,
        takerTokenAccountA
      );
      expect(takerFinalBalanceA.amount.toString()).to.equal(
        vaultInitialBalance.amount.toString()
      );

      const makerFinalBalanceB = await getAccount(
        provider.connection,
        makerTokenAccountB
      );
      expect(makerFinalBalanceB.amount.toString()).to.equal(
        tokenBWantedAmount.toString()
      );

      const takerFinalBalanceB = await getAccount(
        provider.connection,
        takerTokenAccountB
      );
      expect(takerFinalBalanceB.amount.toString()).to.equal(
        (
          takerInitialBalanceB.amount - BigInt(tokenBWantedAmount.toNumber())
        ).toString()
      );

      try {
        await program.account.offer.fetch(offerPda);
        expect.fail("Expected offer account to be closed");
      } catch (error) {
        expect(error.message).to.include("Account does not exist");
      }
    });

    it("should fail when trying to take a non-existent offer", async () => {
      const nonExistentOfferId = new anchor.BN(999);
      const [nonExistentOffer] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("offer"),
          maker.publicKey.toBuffer(),
          nonExistentOfferId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const [takerTokenAccountA] = PublicKey.findProgramAddressSync(
        [
          taker.publicKey.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          tokenMintA.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const [makerTokenAccountB] = PublicKey.findProgramAddressSync(
        [
          maker.publicKey.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          tokenMintB.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      try {
        await program.methods
          .takeOffer()
          .accountsPartial({
            taker: taker.publicKey,
            maker: maker.publicKey,
            tokenMintA: tokenMintA,
            tokenMintB: tokenMintB,
            takerTokenAccountA: takerTokenAccountA,
            takerTokenAccountB: takerTokenAccountB,
            makerTokenAccountB: makerTokenAccountB,
            offer: nonExistentOffer,
            vault: vaultPda,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([taker])
          .rpc();

        expect.fail("Expected transaction to fail for non-existent offer");
      } catch (error) {
        expect(error.message).to.include("AccountNotInitialized");
      }
    });
  });

  describe("multiple offers workflow", () => {
    it("should handle multiple offers from the same maker", async () => {
      const offer2Id = new anchor.BN(3);
      const offer3Id = new anchor.BN(4);

      const [offer2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("offer"),
          maker.publicKey.toBuffer(),
          offer2Id.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .makeOffer(offer2Id, tokenAOfferedAmount, tokenBWantedAmount)
        .accountsPartial({
          maker: maker.publicKey,
          tokenMintA,
          tokenMintB,
          offer: offer2,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maker])
        .rpc();

      const [offer3] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("offer"),
          maker.publicKey.toBuffer(),
          offer3Id.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .makeOffer(offer3Id, tokenAOfferedAmount, tokenBWantedAmount)
        .accountsPartial({
          maker: maker.publicKey,
          tokenMintA,
          tokenMintB,
          offer: offer3,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maker])
        .rpc();

      const offer2Account = await program.account.offer.fetch(offer2);
      const offer3Account = await program.account.offer.fetch(offer3);

      expect(offer2Account.id.toString()).to.equal(offer2Id.toString());
      expect(offer3Account.id.toString()).to.equal(offer3Id.toString());

      console.log("Successfully created multiple offers");
    });
  });
});
