import { Transaction } from '@prisma/client';

export interface Escrow {
  id: string;
  transactionId: string;
  status: 'pending' | 'completed' | 'cancelled';
  amount: number;
  escrowAddress: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  transaction?: Transaction;
}
