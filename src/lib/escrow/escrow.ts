import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { ESCROW_PROGRAM_ID, TREASURY_ADDRESS } from '@/config';

export class EscrowService {
  private connection: Connection;
  private escrowProgramId: PublicKey;
  private treasuryAddress: PublicKey;

  constructor(connection: Connection) {
    this.connection = connection;
    this.escrowProgramId = new PublicKey(ESCROW_PROGRAM_ID);
    this.treasuryAddress = new PublicKey(TREASURY_ADDRESS);
  }

  /**
   * Creates an escrow account for a transaction
   */
  async createEscrow(
    amount: number,
    buyerAddress: string,
    sellerAddress: string
  ) {
    // Generate a new keypair for the escrow account
    const escrowAccount = Keypair.generate();
    const buyerPublicKey = new PublicKey(buyerAddress);
    const sellerPublicKey = new PublicKey(sellerAddress);

    // Calculate the protection fee (1.8%)
    const protectionFee = amount * 0.018;
    const escrowAmount = amount - protectionFee;

    // Create instructions
    const createEscrowIx = SystemProgram.createAccount({
      fromPubkey: buyerPublicKey,
      newAccountPubkey: escrowAccount.publicKey,
      lamports: escrowAmount,
      space: 0,
      programId: this.escrowProgramId,
    });

    const protectionFeeIx = SystemProgram.transfer({
      fromPubkey: buyerPublicKey,
      toPubkey: this.treasuryAddress,
      lamports: protectionFee,
    });

    const initEscrowIx = new TransactionInstruction({
      keys: [
        { pubkey: escrowAccount.publicKey, isSigner: false, isWritable: true },
        { pubkey: buyerPublicKey, isSigner: true, isWritable: false },
        { pubkey: sellerPublicKey, isSigner: false, isWritable: false },
      ],
      programId: this.escrowProgramId,
      data: Buffer.from([0]), // init instruction
    });

    // Create and return transaction
    const transaction = new Transaction().add(
      createEscrowIx,
      protectionFeeIx,
      initEscrowIx
    );

    return {
      transaction,
      escrowAddress: escrowAccount.publicKey.toString(),
    };
  }

  /**
   * Releases funds from escrow to seller
   */
  async releaseToSeller(escrowAddress: string, sellerAddress: string) {
    const escrowPublicKey = new PublicKey(escrowAddress);
    const sellerPublicKey = new PublicKey(sellerAddress);

    const releaseIx = new TransactionInstruction({
      keys: [
        { pubkey: escrowPublicKey, isSigner: false, isWritable: true },
        { pubkey: sellerPublicKey, isSigner: false, isWritable: true },
      ],
      programId: this.escrowProgramId,
      data: Buffer.from([1]), // release instruction
    });

    const transaction = new Transaction().add(releaseIx);
    return transaction;
  }

  /**
   * Returns funds from escrow to buyer
   */
  async returnToBuyer(escrowAddress: string, buyerAddress: string) {
    const escrowPublicKey = new PublicKey(escrowAddress);
    const buyerPublicKey = new PublicKey(buyerAddress);

    const returnIx = new TransactionInstruction({
      keys: [
        { pubkey: escrowPublicKey, isSigner: false, isWritable: true },
        { pubkey: buyerPublicKey, isSigner: false, isWritable: true },
      ],
      programId: this.escrowProgramId,
      data: Buffer.from([2]), // return instruction
    });

    const transaction = new Transaction().add(returnIx);
    return transaction;
  }
}
