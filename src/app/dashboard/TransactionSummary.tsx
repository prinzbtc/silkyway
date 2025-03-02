'use client';

import { FC } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { type Currency } from '@/lib/price';
import { usePrice } from '@/hooks/usePrice';
import { useTransactionSummary } from '@/hooks/transaction/useTransactionSummary';
import { Skeleton } from '@/components/ui/skeleton';

interface TransactionSummaryProps {
  userId: string;
}

export const TransactionSummary: FC<TransactionSummaryProps> = ({ userId }) => {
  const {
    summary,
    isLoading,
    error,
  } = useTransactionSummary({
    userId,
  });

  console.log('Transaction summary:', { summary, isLoading, error });

  // Use the consolidated price hook for sales and purchases
  const { 
    preferredCurrency,
    solAmount: totalSalesSol, 
    isSolLoading: salesPriceLoading,
    formattedSol: formattedSalesSol,
    formattedPreferred: formattedSalesPreferred
  } = usePrice(summary ? summary.totalSales : 0, 'USD');
  
  const { 
    solAmount: totalPurchasesSol, 
    isSolLoading: purchasesPriceLoading,
    formattedSol: formattedPurchasesSol,
    formattedPreferred: formattedPurchasesPreferred
  } = usePrice(summary ? summary.totalPurchases : 0, 'USD');

  console.log('Price conversion states:', {
    totalSalesSol,
    salesPriceLoading,
    totalPurchasesSol,
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

  // Format function for SOL amount when no conversion is available
  const formatSolAmount = (amount: number) => amount.toFixed(2);

  return (
    <div className="bg-white rounded-lg shadow-md dark:shadow-[0_4px_12px_0px_rgba(0,0,0,0.5)] p-6">
      {/* Total Sales */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500">
          Total Sales
        </h3>
        <div className="mt-1">
          <div className="text-2xl font-semibold text-gray-900">
            {formattedSalesPreferred}
          </div>
          <div className="text-sm text-gray-500">
            {salesPriceLoading ? 'Converting...' : formattedSalesSol}
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
            {formattedPurchasesPreferred}
          </div>
          <div className="text-sm text-gray-500">
            {purchasesPriceLoading ? 'Converting...' : formattedPurchasesSol}
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {summary.totalPurchasesCount} items bought
        </p>
      </div>
    </div>
  );
};
