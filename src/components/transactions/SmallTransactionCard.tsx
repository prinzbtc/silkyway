'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import { formatPrice, formatSOL, getSolPrice } from '@/lib/price';
import { cn } from '@/lib/utils';

import { Transaction } from '@/types/transaction';
import { getTransactionBadges, formatTransactionAmount } from '@/lib/transactions';

interface SmallTransactionCardProps {
  transaction: Transaction;
  type: 'buyer' | 'seller';
  className?: string;
  compact?: boolean;
}

export function SmallTransactionCard({
  transaction,
  type,
  className,
  compact = false,
}: SmallTransactionCardProps) {
  const { preferredCurrency } = useCurrencyPreference();
  const [solPrice, setSolPrice] = useState<number | null>(null);

  useEffect(() => {
    const updatePrice = async () => {
      const price = await getSolPrice(preferredCurrency);
      setSolPrice(price);
    };

    updatePrice();
    const interval = setInterval(updatePrice, 30000); // Update every 30s

    return () => clearInterval(interval);
  }, [preferredCurrency]);

  const badges = getTransactionBadges(transaction, type === 'buyer');

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-0">
        <Link
          href={`/listings/${transaction.listing.id}`}
          className={cn(
            'flex items-start gap-4',
            compact ? 'p-3' : 'p-4'
          )}
        >
          <div className={cn(
            'relative shrink-0',
            compact ? 'h-16 w-16' : 'h-20 w-20'
          )}>
            <Image
              src={transaction.listing.images[0]}
              alt={transaction.listing.title}
              fill
              className="rounded-md object-cover"
            />
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <h3 className="line-clamp-1 font-medium hover:underline">
                {transaction.listing.title}
              </h3>
              <div className="mt-1">
                <div className="font-medium">
                  {formatTransactionAmount(
                    transaction.amount + transaction.protectionFee + transaction.shippingFee,
                    preferredCurrency,
                    solPrice
                  )}
                </div>
              </div>
            </div>
            <div className={cn(
              'flex flex-wrap',
              compact ? 'gap-1.5' : 'gap-2'
            )}>
              {badges.map((badge, index) => (
                <Badge key={index} variant={badge.variant === 'primary' ? 'default' : badge.variant}>
                  {badge.label}
                </Badge>
              ))}
            </div>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
