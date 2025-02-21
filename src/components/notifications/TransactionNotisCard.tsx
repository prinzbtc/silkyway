'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TransactionNotisCardProps {
  type: 'buyer' | 'seller' | 'buyerCancel' | 'sellerCancel';
  listingTitle: string;
  counterpartyUsername: string;
  transactionId: string;
  className?: string;
}

export function TransactionNotisCard({
  type,
  listingTitle,
  counterpartyUsername,
  transactionId,
  className,
}: TransactionNotisCardProps) {
  const getMessage = () => {
    switch (type) {
      case 'buyer':
        return `You successfully bought ${listingTitle} from ${counterpartyUsername}`;
      case 'seller':
        return `You successfully sold ${listingTitle} to ${counterpartyUsername}`;
      case 'buyerCancel':
        return `Sorry, ${counterpartyUsername} cancelled the transaction for ${listingTitle}`;
      case 'sellerCancel':
        return `You cancelled the transaction for ${listingTitle}`;
      default:
        return '';
    }
  };

  const getRedirectUrl = () => {
    const baseUrl = type.startsWith('buyer')
      ? '/dashboard/purchases'
      : '/dashboard/sales';
    return `${baseUrl}/${transactionId}`;
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="flex flex-col gap-4 p-4">
        <p className="text-sm">{getMessage()}</p>
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => window.location.href = getRedirectUrl()}
        >
          See transaction
        </Button>
      </CardContent>
    </Card>
  );
}
