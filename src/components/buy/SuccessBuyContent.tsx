'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SmallListingCard } from '@/components/listings/SmallListingCard';
import { Transaction } from '@/types/transaction';

interface SuccessBuyContentProps {
  transaction: Transaction;
}

export default function SuccessBuyContent({
  transaction,
}: SuccessBuyContentProps) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="mb-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <Check className="h-6 w-6 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold">Purchase Successful!</h1>
        <p className="mt-2 text-gray-500">
          Your transaction has been confirmed
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="mb-6">
            <SmallListingCard listing={transaction.listing} />
          </div>

          <div className="space-y-4 text-left">
            <div>
              <h3 className="font-medium">Next Steps:</h3>
              <ul className="mt-2 list-inside list-disc text-gray-500">
                <li>The seller will be notified of your purchase</li>
                {transaction.listing.shippingRequired && (
                  <li>
                    Once the seller adds tracking information, you&apos;ll be
                    notified
                  </li>
                )}
                <li>
                  Your payment is held in escrow until you confirm receipt
                </li>
                <li>
                  You can track this transaction in your transaction history
                </li>
              </ul>
            </div>

            <div className="pt-4">
              <div className="flex justify-between gap-4">
                <Button
                  variant="outline"
                  className="w-full"
                  asChild
                >
                  <Link href="/transactions">View Transaction</Link>
                </Button>
                <Button
                  className="w-full"
                  asChild
                >
                  <Link href="/">Continue Shopping</Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
