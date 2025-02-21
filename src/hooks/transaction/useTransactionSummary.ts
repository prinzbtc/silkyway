import useSWR from 'swr';

interface TransactionSummary {
  totalSales: number;
  totalSalesCount: number;
  totalPurchases: number;
  totalPurchasesCount: number;
}

interface UseTransactionSummaryOptions {
  userId?: string;
}

interface UseTransactionSummaryResult {
  summary: TransactionSummary;
  isLoading: boolean;
  error: any;
}

export function useTransactionSummary(
  options: UseTransactionSummaryOptions
): UseTransactionSummaryResult {
  // Construct the API URL with query parameters
  const apiUrl = new URL('/api/transactions/summary', window.location.origin);
  if (options.userId) apiUrl.searchParams.set('userId', options.userId);

  // Fetch summary
  const { data, error, isLoading } = useSWR<TransactionSummary>(
    options.userId ? apiUrl.toString() : null
  );

  return {
    summary: data || {
      totalSales: 0,
      totalSalesCount: 0,
      totalPurchases: 0,
      totalPurchasesCount: 0,
    },
    isLoading,
    error,
  };
}
