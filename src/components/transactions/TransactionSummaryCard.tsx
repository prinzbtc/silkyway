'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import { getSolPrice, type Currency } from '@/lib/price';
import { formatTransactionAmount } from '@/lib/transactions';

interface TransactionSummaryCardProps {
  totalBuys: number;
  totalSales: number;
}

export default function TransactionSummaryCard({
  totalBuys,
  totalSales,
}: TransactionSummaryCardProps) {
  const { preferredCurrency } = useCurrencyPreference();
  const [solPrice, setSolPrice] = useState<number | null>(null);

  useEffect(() => {
    const updatePrice = async () => {
      // Make sure we're not passing 'SOL' to getSolPrice
      if (preferredCurrency !== 'SOL') {
        const price = await getSolPrice(preferredCurrency as Exclude<Currency, 'SOL'>);
        setSolPrice(price);
      }
    };

    updatePrice();
    const interval = setInterval(updatePrice, 30000); // Update every 30s

    return () => clearInterval(interval);
  }, [preferredCurrency]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Total Purchases</h3>
            <p className="text-2xl font-bold">
              {formatTransactionAmount(totalBuys, preferredCurrency, solPrice)}
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Total Sales</h3>
            <p className="text-2xl font-bold">
              {formatTransactionAmount(totalSales, preferredCurrency, solPrice)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
