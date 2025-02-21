'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import { formatPrice, formatSOL, getSolPrice } from '@/lib/price';
import { cn } from '@/lib/utils';
import type { Offer, Listing } from '@/types/conversation';

interface OfferCardProps {
  offer: Offer;
  listing: Listing;
  isBuyer: boolean;
}

export default function OfferCard({
  offer,
  listing,
  isBuyer,
}: OfferCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { preferredCurrency } = useCurrencyPreference();
  const [solPrice, setSolPrice] = useState<number | null>(null);

  useEffect(() => {
    const updatePrice = async () => {
      const price = await getSolPrice(preferredCurrency);
      setSolPrice(price);
    };

    updatePrice();
  }, [preferredCurrency]);

  const handleAcceptOffer = async () => {
    try {
      const response = await fetch(`/api/offers/${offer.id}/accept`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to accept offer');

      toast({
        title: 'Offer accepted',
        description: 'The listing price has been updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to accept offer',
        variant: 'destructive',
      });
    }
  };

  const handleRejectOffer = async () => {
    try {
      const response = await fetch(`/api/offers/${offer.id}/reject`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to reject offer');

      toast({
        title: 'Offer rejected',
        description: 'The offer has been rejected',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reject offer',
        variant: 'destructive',
      });
    }
  };

  const handleBuyNow = () => {
    router.push(`/buy/${listing.id}?offerId=${offer.id}`);
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        isBuyer ? 'ml-auto w-3/4' : 'mr-auto w-3/4'
      )}
    >
      {/* Offer Status */}
      <div className="mb-2 text-sm font-medium">
        {isBuyer ? 'You made this offer' : 'You received an offer'}
      </div>

      {/* Price Comparison */}
      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-gray-500 line-through">
            {formatSOL(listing.price)}
          </span>
          {solPrice && (
            <span className="text-xs text-gray-500 line-through">
              {formatPrice(listing.price * solPrice, preferredCurrency)}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-medium">
            {formatSOL(offer.amount)}
          </span>
          {solPrice && (
            <span className="text-sm text-gray-500">
              {formatPrice(offer.amount * solPrice, preferredCurrency)}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {offer.status === 'pending' && !isBuyer && (
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRejectOffer}
            className="w-full"
          >
            <X className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button
            size="sm"
            onClick={handleAcceptOffer}
            className="w-full"
          >
            <Check className="mr-2 h-4 w-4" />
            Accept
          </Button>
        </div>
      )}

      {offer.status === 'accepted' && isBuyer && (
        <Button
          className="mt-4 w-full"
          onClick={handleBuyNow}
        >
          Buy Now
        </Button>
      )}

      {/* Status Badge */}
      {offer.status !== 'pending' && (
        <div
          className={cn(
            'mt-2 text-sm',
            offer.status === 'accepted'
              ? 'text-green-600'
              : 'text-destructive'
          )}
        >
          {offer.status === 'accepted'
            ? 'Offer accepted'
            : 'Offer rejected'}
        </div>
      )}
    </div>
  );
}
