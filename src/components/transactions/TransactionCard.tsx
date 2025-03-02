'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ExternalLink, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import { formatPrice, formatSOL, getSolPrice, type Currency } from '@/lib/price';

import { Transaction } from '@/types/transaction';
import { getTransactionBadges, formatTransactionAmount } from '@/lib/transactions';

interface TransactionCardProps {
  transaction: Transaction;
  type: 'buyer' | 'seller';
}

export function TransactionCard({ transaction, type }: TransactionCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { preferredCurrency } = useCurrencyPreference();
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [trackingNumber, setTrackingNumber] = useState(transaction.trackingNumber || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isConfirmDeliveryDialogOpen, setIsConfirmDeliveryDialogOpen] = useState(false);

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

  const badges = getTransactionBadges(transaction, type === 'buyer');
  const isOngoing = ['pending', 'awaiting_tracking', 'shipped', 'awaiting_confirmation'].includes(transaction.status);
  const hasReview = Boolean(transaction.reviewId);
  const isCompleted = transaction.status === 'completed';
  const needsTracking = transaction.shippingFee > 0 && !transaction.trackingNumber;
  const isDelivering = transaction.shippingFee > 0 && transaction.trackingNumber && !isCompleted;

  const handleTrackingUpdate = async () => {
    try {
      const response = await fetch(
        `/api/transactions/${transaction.id}/tracking`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trackingNumber }),
        }
      );

      if (!response.ok) throw new Error('Failed to update tracking number');

      setIsEditing(false);
      toast({
        title: 'Success',
        description: 'Tracking number saved successfully',
      });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update tracking number',
        variant: 'destructive',
      });
    }
  };

  const handleConfirmDelivery = async () => {
    try {
      const response = await fetch(
        `/api/transactions/${transaction.id}/confirm`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) throw new Error('Failed to confirm delivery');

      setIsConfirmDeliveryDialogOpen(false);
      toast({
        title: 'Success',
        description: 'Delivery confirmed successfully',
      });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to confirm delivery',
        variant: 'destructive',
      });
    }
  };

  const handleCancelTransaction = async () => {
    try {
      const response = await fetch(
        `/api/transactions/${transaction.id}/cancel`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) throw new Error('Failed to cancel transaction');

      setIsCancelDialogOpen(false);
      toast({
        title: 'Success',
        description: 'Transaction cancelled successfully',
      });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to cancel transaction',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-start gap-4">
          <Link
            href={`/listings/${transaction.listing.id}`}
            className="relative h-24 w-24 shrink-0"
          >
            <Image
              src={transaction.listing.images[0]}
              alt={transaction.listing.title}
              fill
              className="rounded-md object-cover"
            />
          </Link>
          <div className="flex-1">
            <Link
              href={`/listings/${transaction.listing.id}`}
              className="font-medium hover:underline"
            >
              {transaction.listing.title}
            </Link>
            <div className="mt-1 space-y-1">
              <div className="text-sm text-gray-500">
                {format(new Date(transaction.createdAt), 'MMMM yyyy')}
              </div>
              <div className="flex flex-wrap gap-2">
                {badges.map((badge, index) => (
                  <Badge key={index} variant={badge.variant === 'primary' ? 'default' : badge.variant}>
                    {badge.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-medium">
              {formatTransactionAmount(
                transaction.amount + transaction.protectionFee + transaction.shippingFee,
                preferredCurrency,
                solPrice
              )}
            </div>
            <div className="mt-1 text-sm">
              <div>Price: {formatTransactionAmount(transaction.amount, preferredCurrency, solPrice)}</div>
              {transaction.shippingFee > 0 && (
                <div>Shipping: {formatTransactionAmount(transaction.shippingFee, preferredCurrency, solPrice)}</div>
              )}
              <div>Protection: {formatTransactionAmount(transaction.protectionFee, preferredCurrency, solPrice)}</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <div className="font-medium">Transaction ID</div>
              <Link
                href={`/transactions/${transaction.id}`}
                className="text-blue-600 hover:underline"
              >
                {transaction.id}
              </Link>
            </div>
            <div>
              <div className="font-medium">Solana Transaction</div>
              <a
                href={`https://solscan.io/tx/${transaction.signature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                View on Solscan
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          {transaction.shippingFee > 0 && (
            <div className="space-y-2">
              <div className="font-medium">Tracking Number</div>
              {type === 'seller' ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={trackingNumber}
                    onChange={(e) => {
                      setTrackingNumber(e.target.value);
                      setIsEditing(true);
                    }}
                    placeholder="Enter tracking number"
                  />
                  {isEditing && (
                    <Button onClick={handleTrackingUpdate}>Save</Button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {transaction.trackingNumber || 'Awaiting tracking number'}
                </div>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-between">
          <div>
            {type === 'seller' && isOngoing && (
              <Button
                variant="destructive"
                onClick={() => setIsCancelDialogOpen(true)}
              >
                Cancel Transaction
              </Button>
            )}
          </div>
          <div className="space-x-2">
            {type === 'buyer' &&
              isDelivering &&
              !isCompleted && (
                <Button
                  onClick={() => setIsConfirmDeliveryDialogOpen(true)}
                >
                  Confirm Delivery
                </Button>
              )}
            {isCompleted && !hasReview && (
              <Button
                onClick={() =>
                  router.push(`/ratings/${transaction.id}`)
                }
              >
                {type === 'buyer' ? 'Rate Transaction' : 'Review Transaction'}
              </Button>
            )}
            {isCompleted && hasReview && (
              <Button
                variant="outline"
                asChild
              >
                <Link href={`/users/${transaction.buyerId}/ratings`}>
                  Review already sent
                </Link>
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      <Dialog
        open={isCancelDialogOpen}
        onOpenChange={setIsCancelDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this transaction? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCancelDialogOpen(false)}
            >
              No, keep it
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelTransaction}
            >
              Yes, cancel it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isConfirmDeliveryDialogOpen}
        onOpenChange={setIsConfirmDeliveryDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delivery</DialogTitle>
            <DialogDescription>
              By confirming delivery, you acknowledge that you have received the item
              and the payment will be released to the seller. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmDeliveryDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmDelivery}>
              Confirm Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
