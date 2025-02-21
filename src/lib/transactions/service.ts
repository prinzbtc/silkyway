import prisma from '@/lib/prisma';
import { updateUserTransactionCount } from '@/lib/jobs/updateTransactionCounts';

export class TransactionService {
  private static instance: TransactionService;

  private constructor() {}

  public static getInstance(): TransactionService {
    if (!TransactionService.instance) {
      TransactionService.instance = new TransactionService();
    }
    return TransactionService.instance;
  }

  async updateTransactionStatus(
    transactionId: string,
    status: 'pending' | 'completed' | 'cancelled'
  ) {
    const transaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: { status },
      include: {
        buyer: true,
        seller: true,
      },
    });

    // If transaction is completed, update counts for both users
    if (status === 'completed') {
      await Promise.all([
        updateUserTransactionCount(transaction.buyer.id),
        updateUserTransactionCount(transaction.seller.id),
      ]);
    }

    return transaction;
  }

  async getTransactionById(id: string) {
    return prisma.transaction.findUnique({
      where: { id },
      include: {
        buyer: true,
        seller: true,
        listing: true,
        escrow: true,
      },
    });
  }

  async getTransactionsByUser(userId: string) {
    return prisma.transaction.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId },
        ],
      },
      include: {
        buyer: true,
        seller: true,
        listing: true,
        escrow: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
