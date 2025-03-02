'use client';

import { FC } from 'react';
import Link from 'next/link';
import { formatDistance } from 'date-fns';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrencyPreference } from '@/hooks/useCurrencyPreference';
import { useTransactions } from '@/hooks/transaction/useTransactions';

interface LatestTransactionsProps {
  userId: string;
}

export const LatestTransactions: FC<LatestTransactionsProps> = ({ userId }) => {
  const { formatPrice } = useCurrencyPreference();

  const {
    transactions,
    isLoading,
    error,
  } = useTransactions({
    userId,
    limit: 6,
  });

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md dark:shadow-[0_4px_12px_0px_rgba(0,0,0,0.5)] p-6">
        <p className="text-center text-gray-500">
          Failed to load transactions
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md dark:shadow-[0_4px_12px_0px_rgba(0,0,0,0.5)] p-6 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-48 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md dark:shadow-[0_4px_12px_0px_rgba(0,0,0,0.5)] p-6 text-center">
        <p className="text-gray-500">
          No transactions yet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md dark:shadow-[0_4px_12px_0px_rgba(0,0,0,0.5)] p-6">
      <div className="space-y-4">
        {transactions.map((transaction) => (
          <div
            key={transaction.id}
            className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50"
          >
            {/* Listing Image */}
            <Link
              href={`/listings/${transaction.listing.id}`}
              className="block h-12 w-12 rounded-lg overflow-hidden bg-gray-100"
            >
              <img
                src={transaction.listing.media?.[0]?.url || '/placeholder-image.jpg'}
                alt={transaction.listing.title}
                className="h-full w-full object-cover"
              />
            </Link>

            {/* Transaction Info */}
            <div className="flex-1 min-w-0">
              <Link
                href={`/listings/${transaction.listing.id}`}
                className="text-sm font-medium text-gray-900 hover:text-primary truncate block"
              >
                {transaction.listing.title}
              </Link>
              <p className="text-sm text-gray-500">
                {formatDistance(new Date(transaction.createdAt), new Date(), {
                  addSuffix: true,
                })}
              </p>
            </div>

            {/* Price */}
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {formatPrice(transaction.amount)}
              </p>
              <p className="text-xs text-gray-500">
                {transaction.status}
              </p>
            </div>
          </div>
        ))}
      </div>

      {transactions.length >= 6 && (
        <div className="mt-4 text-center">
          <Button variant="outline" asChild>
            <Link href="/transactions">
              See All Transactions
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
};
