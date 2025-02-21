'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConnection, useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { SmallListingCard } from '@/components/listings/SmallListingCard';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import type { Currency } from '@/lib/price';
import { useEscrow } from '@/lib/escrow';
import { formatPrice, formatSOL, getSolPrice } from '@/lib/price';
import { cn } from '@/lib/utils';
import { useRetry } from '@/hooks/useRetry';
import { useTransactionStatus } from '@/hooks/useTransactionStatus';
import { TransactionProgress } from './TransactionProgress';

import { ListingWithFavorite } from '@/types/listing';

interface BuyPageContentProps {
  listing: ListingWithFavorite;
  offerPrice: number | null;
  protectionFee: number;
  shippingFee: number;
}

export default function BuyPageContent({
  listing,
  offerPrice,
  protectionFee,
  shippingFee,
}: BuyPageContentProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { preferredCurrency } = useCurrencyPreference();
  const { publicKey, sendTransaction } = useSolanaWallet();
  const { connection } = useConnection();
  const { createEscrow } = useEscrow();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'escrow' | 'confirmation' | 'record'>('escrow');
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);

  useEffect(() => {
    const updatePrice = async () => {
      const price = await getSolPrice(preferredCurrency);
      setSolPrice(price);
    };

    updatePrice();
  }, [preferredCurrency]);

  const listingPrice = offerPrice || listing.price;
  const totalPrice = listingPrice + protectionFee + shippingFee;

  const handleCancel = () => {
    setIsConfirmOpen(true);
  };

  const handleConfirmCancel = () => {
    router.back();
  };

  const { status: transactionStatus, error: transactionError } = useTransactionStatus(transactionSignature);

  const createEscrowOperation = async () => {
    if (!publicKey) throw new Error('Wallet not connected');

    // Calculate total amount in lamports
    const totalLamports = Math.floor(totalPrice * LAMPORTS_PER_SOL);

    // Create escrow transaction
    const { transaction, escrowAddress } = await createEscrow(
      totalLamports,
      publicKey.toBase58(),
      listing.user.id
    );

    // Send transaction
    const signature = await sendTransaction(transaction, connection);
    if (!signature) throw new Error('Transaction rejected');

    setTransactionSignature(signature);
    setCurrentStep('confirmation');

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    setCurrentStep('record');

    // Create transaction record
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        listingId: listing.id,
        escrowAddress,
        amount: totalPrice,
        protectionFee,
        shippingFee,
        signature,
        offerId: offerPrice ? listing.id : null, // Use listing ID if there's an offer
      }),
    });

    if (!response.ok) throw new Error('Failed to create transaction record');
    
    const { transactionId } = await response.json();

    // Send notifications
    await Promise.all([
      // Notify seller
      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sale',
          title: 'New Sale!',
          message: `Your item ${listing.title} has been purchased`,
          metadata: {
            listingId: listing.id,
            transactionId,
            actionUrl: `/dashboard/sales/${transactionId}`,
          },
        }),
      }),
      // Notify buyer
      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'purchase',
          title: 'Purchase Successful!',
          message: `You have successfully purchased ${listing.title}`,
          metadata: {
            listingId: listing.id,
            transactionId,
            actionUrl: `/dashboard/purchases/${transactionId}`,
          },
        }),
      }),
    ]);

    return transactionId;

  };

  const { execute: executeWithRetry, isRetrying } = useRetry(createEscrowOperation, {
    maxAttempts: 3,
    initialDelay: 1000,
  });

  const handleBuyNow = async () => {
    if (!publicKey) {
      toast({
        variant: 'destructive',
        title: 'Wallet not connected',
        description: 'Please connect your wallet to continue.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await executeWithRetry();
      
      if (result.success) {
        router.push(`/buy/success/${result.data}`);
      } else {
        toast({
          variant: 'destructive',
          title: 'Transaction failed',
          description: result.error.message,
        });
      }
    } catch (error) {
      console.error('Buy error:', error);
      toast({
        variant: 'destructive',
        title: 'Transaction failed',
        description: error instanceof Error ? error.message : 'Failed to complete purchase',
      });
    } finally {
      setIsLoading(false);
    }

  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-8 text-3xl font-bold">
        Buy {listing.title}
      </h1>

      <Card>
        <CardContent className="p-6">
          {/* Listing Card */}
          <div className="mb-6">
            <SmallListingCard listing={listing} />
          </div>

          {/* Price Breakdown */}
          <div className="space-y-4">
            <PriceRow
              label="Listing Price"
              amount={listingPrice}
              solPrice={solPrice}
              currency={preferredCurrency}
              isOriginalPrice={!offerPrice}
              originalPrice={offerPrice ? listing.price : undefined}
            />

            {shippingFee > 0 && (
              <PriceRow
                label="Shipping Fee"
                amount={shippingFee}
                solPrice={solPrice}
                currency={preferredCurrency}
              />
            )}

            <PriceRow
              label="Protection Fee"
              amount={protectionFee}
              solPrice={solPrice}
              currency={preferredCurrency}
            />

            <div className="border-t pt-4">
              <PriceRow
                label="Total"
                amount={totalPrice}
                solPrice={solPrice}
                currency={preferredCurrency}
                isTotal
              />
            </div>
          </div>

          {/* Transaction Progress */}
          {isLoading && (
            <div className="mb-6 rounded-lg border bg-card p-6">
              <TransactionProgress
                step={currentStep}
                status={transactionStatus}
                error={transactionError}
                retryFn={isRetrying ? undefined : handleBuyNow}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex gap-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              className={cn(
                'w-full',
                isLoading && 'cursor-not-allowed opacity-50'
              )}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBuyNow}
              disabled={isLoading}
              className={cn(
                'w-full',
                isLoading && 'cursor-not-allowed opacity-50'
              )}
            >
              {isLoading ? 'Processing...' : 'Buy Now'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel your purchase. You can always come back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancel}>
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PriceRow({
  label,
  amount,
  solPrice,
  currency,
  isTotal = false,
  isOriginalPrice = false,
  originalPrice,
}: {
  label: string;
  amount: number;
  solPrice: number | null;
  currency: Currency;
  isTotal?: boolean;
  isOriginalPrice?: boolean;
  originalPrice?: number;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between',
        isTotal && 'font-medium'
      )}
    >
      <span>{label}</span>
      <div className="text-right">
        {originalPrice && (
          <div className="text-sm text-gray-500 line-through">
            {formatSOL(originalPrice)}
            {solPrice && (
              <span className="ml-1">
                {formatPrice(originalPrice * solPrice, currency)}
              </span>
            )}
          </div>
        )}
        <div
          className={cn(
            isOriginalPrice && 'text-gray-500 line-through'
          )}
        >
          {formatSOL(amount)}
          {solPrice && (
            <span className="ml-1 text-sm text-gray-500">
              {formatPrice(amount * solPrice, currency)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
