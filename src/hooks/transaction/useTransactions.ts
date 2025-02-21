import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { Transaction } from '@/types/transaction';

interface UseTransactionsOptions {
  userId?: string;
  limit?: number;
  cursor?: string;
}

interface UseTransactionsResult {
  transactions: Transaction[];
  isLoading: boolean;
  error: any;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

export function useTransactions(options: UseTransactionsOptions): UseTransactionsResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hasMore, setHasMore] = useState(true);

  // Construct the API URL with query parameters
  const apiUrl = new URL('/api/transactions', window.location.origin);
  if (options.userId) apiUrl.searchParams.set('userId', options.userId);
  if (options.limit) apiUrl.searchParams.set('limit', options.limit.toString());
  if (options.cursor) apiUrl.searchParams.set('cursor', options.cursor);

  // Fetch transactions
  const { data, error, isLoading } = useSWR<{
    transactions: Transaction[];
    nextCursor?: string;
  }>(apiUrl.toString());

  // Update state when data changes
  const updateTransactions = useCallback(() => {
    if (data?.transactions) {
      setTransactions((prev) => {
        if (options.cursor) {
          return [...prev, ...data.transactions];
        }
        return data.transactions;
      });
      setHasMore(!!data.nextCursor);
    }
  }, [data, options.cursor]);

  // Load more transactions
  const loadMore = useCallback(async () => {
    if (!data?.nextCursor || isLoading) return;

    const nextUrl = new URL(apiUrl.toString());
    nextUrl.searchParams.set('cursor', data.nextCursor);

    const response = await fetch(nextUrl.toString());
    const newData = await response.json();

    if (newData.transactions) {
      setTransactions((prev) => [...prev, ...newData.transactions]);
      setHasMore(!!newData.nextCursor);
    }
  }, [data?.nextCursor, isLoading, apiUrl]);

  return {
    transactions,
    isLoading,
    error,
    hasMore,
    loadMore,
  };
}
