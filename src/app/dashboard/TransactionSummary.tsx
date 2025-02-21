'use client';

import { FC } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import { useConvertedPrice } from '@/hooks/price/useConvertedPrice';
import { useTransactionSummary } from '@/hooks/transaction/useTransactionSummary';
import { Skeleton } from '@/components/ui/skeleton';

interface TransactionSummaryProps {
  userId: string;
}

export const TransactionSummary: FC<TransactionSummaryProps> = ({ userId }) => {
  const { preferredCurrency } = useCurrencyPreference();

  console.log('TransactionSummary rendering with currency:', preferredCurrency);

  const {
    summary,
    isLoading,
    error,
  } = useTransactionSummary({
    userId,
  });

  console.log('Transaction summary:', { summary, isLoading, error });

  const { convertedAmount: totalSalesConverted, isLoading: salesPriceLoading } = useConvertedPrice(
    summary ? summary.totalSales : 0
  );
  const { convertedAmount: totalPurchasesConverted, isLoading: purchasesPriceLoading } = useConvertedPrice(
    summary ? summary.totalPurchases : 0
  );

  console.log('Price conversion states:', {
    totalSalesConverted,
    salesPriceLoading,
    totalPurchasesConverted,
    purchasesPriceLoading
  });

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md dark:shadow-[0_4px_12px_0px_rgba(0,0,0,0.5)] p-6">
        <p className="text-center text-gray-500">
          Failed to load summary
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md dark:shadow-[0_4px_12px_0px_rgba(0,0,0,0.5)] p-6 space-y-6">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-6 w-32" />
        </div>
      </div>
    );
  }

  // Format functions
  const formatSolAmount = (amount: number) => amount.toFixed(2);
  const formatFiatAmount = (amount: number | null) => {
    if (amount === null) return 'Price unavailable';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: preferredCurrency 
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow-md dark:shadow-[0_4px_12px_0px_rgba(0,0,0,0.5)] p-6">
      {/* Total Sales */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500">
          Total Sales
        </h3>
        <div className="mt-1">
          <div className="text-2xl font-semibold text-gray-900">
            {formatSolAmount(summary.totalSales)} SOL
          </div>
          <div className="text-sm text-gray-500">
            {salesPriceLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              `≈ ${formatFiatAmount(totalSalesConverted)}`
            )}
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {summary.totalSalesCount} items sold
        </p>
      </div>

      {/* Total Purchases */}
      <div>
        <h3 className="text-sm font-medium text-gray-500">
          Total Purchases
        </h3>
        <div className="mt-1">
          <div className="text-2xl font-semibold text-gray-900">
            {formatSolAmount(summary.totalPurchases)} SOL
          </div>
          <div className="text-sm text-gray-500">
            {purchasesPriceLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              `≈ ${formatFiatAmount(totalPurchasesConverted)}`
            )}
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {summary.totalPurchasesCount} items bought
        </p>
      </div>
    </div>
  );
};
