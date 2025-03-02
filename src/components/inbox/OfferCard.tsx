'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { type Currency, normalizeCurrency } from '@/lib/price';
import { usePrice } from '@/hooks/usePrice';
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
  
  // Ensure currency is properly typed as Currency and use the actual listing currency
  // This is critical - we must use the currency that was stored with the listing
  // Use normalizeCurrency to ensure proper currency handling regardless of input type
  const listingCurrency = normalizeCurrency(listing.currency);
  
  // Debug the currency value
  console.log('OfferCard - Original currency:', listing.currency, 'Normalized currency:', listingCurrency);
  console.log('OfferCard - Currency type check:', typeof listing.currency, 'Is null?', listing.currency === null, 'Is undefined?', listing.currency === undefined);
  
  // Use consolidated price hook for listing price
  // IMPORTANT: We must directly pass the currency from the listing to ensure proper conversion
  const { 
    preferredAmount: listingFiatAmount,
    preferredCurrency,
    solAmount: listingSolAmount,
    isSolLoading: listingSolLoading,
    isPreferredLoading: listingFiatLoading,
    formattedOriginal: listingFormattedOriginal,
    formattedPreferred: listingFormattedPreferred,
    formattedSol: listingFormattedSol,
    showConverted: listingShowConverted
  } = usePrice(listing.price, listingCurrency);
  
  // Use consolidated price hook for offer price
  const { 
    preferredAmount: offerFiatAmount,
    solAmount: offerSolAmount,
    isSolLoading: offerSolLoading,
    isPreferredLoading: offerFiatLoading,
    formattedOriginal: offerFormattedOriginal,
    formattedPreferred: offerFormattedPreferred,
    formattedSol: offerFormattedSol,
    showConverted: offerShowConverted
  } = usePrice(offer.amount, listingCurrency);

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
        {/* Original listing price - crossed out */}
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-gray-500 line-through">
            {listingFormattedOriginal}
          </span>
          <span className="text-xs text-gray-500 line-through">
            {listingSolLoading 
              ? 'Converting...' 
              : listingSolAmount !== null 
                ? `≈ ${listingSolAmount.toFixed(6)} SOL` 
                : 'SOL price unavailable'}
          </span>
        </div>
        
        {/* Offer price */}
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-medium">
            {offerShowConverted ? offerFormattedPreferred : offerFormattedOriginal}
            {offerFiatLoading && offerShowConverted && 
              <span className="text-xs font-normal ml-1 text-gray-500">(converting...)</span>}
          </span>
        </div>
        
        {/* SOL equivalent for offer */}
        <div className="text-sm text-gray-500 mt-1">
          {offerSolLoading 
            ? 'Converting to SOL...' 
            : offerFormattedSol}
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
