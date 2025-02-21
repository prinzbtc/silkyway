import { Escrow } from '@prisma/client';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { ESCROW_PROGRAM_ID, TREASURY_ADDRESS } from '@/config';
import prisma from '@/lib/prisma';

export class EscrowService {
  private connection: Connection;
  private escrowProgramId: PublicKey;
  private treasuryAddress: PublicKey;
  private adminKeypair: Keypair;

  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL!);
    this.escrowProgramId = new PublicKey(ESCROW_PROGRAM_ID);
    this.treasuryAddress = new PublicKey(TREASURY_ADDRESS);
    
    // Initialize admin keypair from environment
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!adminPrivateKey) {
      throw new Error('Admin private key not found in environment');
    }
    this.adminKeypair = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(adminPrivateKey))
    );
  }

  /**
   * Signs and sends a transaction
   */
  private async signAndSendTransaction(transaction: Transaction): Promise<string> {
    try {
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.adminKeypair.publicKey;

      // Sign transaction
      transaction.sign(this.adminKeypair);

      // Send transaction
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize()
      );

      // Confirm transaction
      await this.connection.confirmTransaction(signature);

      return signature;
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw error;
    }
  }

  /**
   * Releases funds from escrow to the seller
   */
  async releaseFundsToSeller(escrowId: string): Promise<void> {
    // Get escrow details from database
    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: {
        transaction: {
          include: {
            seller: true,
          },
        },
      },
    });

    if (!escrow?.address || !escrow.transaction?.seller?.walletAddress) {
      throw new Error('Invalid escrow or seller data');
    }

    // Create release instruction
    const escrowPublicKey = new PublicKey(escrow.address);
    const sellerPublicKey = new PublicKey(escrow.transaction.seller.walletAddress);

    const releaseIx = new TransactionInstruction({
      keys: [
        { pubkey: escrowPublicKey, isSigner: false, isWritable: true },
        { pubkey: sellerPublicKey, isSigner: false, isWritable: true },
        { pubkey: this.adminKeypair.publicKey, isSigner: true, isWritable: false },
      ],
      programId: this.escrowProgramId,
      data: Buffer.from([1]), // release instruction
    });

    // Create and send transaction
    const transaction = new Transaction().add(releaseIx);
    await this.signAndSendTransaction(transaction);
  }

  /**
   * Returns funds from escrow back to the buyer
   */
  async returnFundsToBuyer(escrowId: string): Promise<void> {
    // Get escrow details from database
    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: {
        transaction: {
          include: {
            buyer: true,
          },
        },
      },
    });

    if (!escrow?.address || !escrow.transaction?.buyer?.walletAddress) {
      throw new Error('Invalid escrow or buyer data');
    }

    // Create return instruction
    const escrowPublicKey = new PublicKey(escrow.address);
    const buyerPublicKey = new PublicKey(escrow.transaction.buyer.walletAddress);

    const returnIx = new TransactionInstruction({
      keys: [
        { pubkey: escrowPublicKey, isSigner: false, isWritable: true },
        { pubkey: buyerPublicKey, isSigner: false, isWritable: true },
        { pubkey: this.adminKeypair.publicKey, isSigner: true, isWritable: false },
      ],
      programId: this.escrowProgramId,
      data: Buffer.from([2]), // return instruction
    });

    // Create and send transaction
    const transaction = new Transaction().add(returnIx);
    await this.signAndSendTransaction(transaction);
  }

  /**
   * Creates a new escrow account for a transaction
   */
  async createEscrow(
    amount: number,
    buyerAddress: string,
    sellerAddress: string
  ): Promise<{ escrowAddress: string }> {
    // Generate escrow account
    const escrowAccount = Keypair.generate();
    const buyerPublicKey = new PublicKey(buyerAddress);
    const sellerPublicKey = new PublicKey(sellerAddress);

    // Calculate fees
    const protectionFee = Math.floor(amount * 0.018); // 1.8% fee
    const escrowAmount = amount - protectionFee;

    // Create instructions
    const createEscrowIx = SystemProgram.createAccount({
      fromPubkey: this.adminKeypair.publicKey,
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
        { pubkey: this.adminKeypair.publicKey, isSigner: true, isWritable: false },
      ],
      programId: this.escrowProgramId,
      data: Buffer.from([0]), // init instruction
    });

    // Create and send transaction
    const transaction = new Transaction()
      .add(createEscrowIx)
      .add(protectionFeeIx)
      .add(initEscrowIx);

    // Add escrow account as signer
    transaction.sign(escrowAccount);
    await this.signAndSendTransaction(transaction);

    return {
      escrowAddress: escrowAccount.publicKey.toString(),
    };
  }
}
