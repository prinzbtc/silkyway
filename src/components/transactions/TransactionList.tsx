'use client';

import type { Transaction } from '@/types/transaction';
import { TransactionCard } from './TransactionCard';

interface TransactionListProps {
  transactions: Transaction[];
  userId: string;
}

export default function TransactionList({
  transactions,
  userId,
}: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-lg text-gray-500">No transactions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {transactions.map((transaction) => (
        <TransactionCard
          key={transaction.id}
          transaction={transaction}
          type={transaction.buyerId === userId ? 'buyer' : 'seller'}
        />
      ))}
    </div>
  );
}
