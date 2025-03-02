'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Listing } from '@/types/conversation';
import { type Currency, normalizeCurrency } from '@/lib/price';
import { usePrice } from '@/hooks/usePrice';

interface ListingBannerProps {
  listing: Listing;
}

export default function ListingBanner({ listing }: ListingBannerProps) {
  // Ensure currency is properly typed as Currency and use the actual listing currency
  // This is critical - we must use the currency that was stored with the listing
  // Use normalizeCurrency to ensure proper currency handling regardless of input type
  const listingCurrency = normalizeCurrency(listing.currency);
  
  // Debug the currency value
  console.log('ListingBanner - Original currency:', listing.currency, 'Normalized currency:', listingCurrency);
  console.log('ListingBanner - Currency type check:', typeof listing.currency, 'Is null?', listing.currency === null, 'Is undefined?', listing.currency === undefined);
  
  // Use consolidated price hook
  // IMPORTANT: We must directly pass the currency from the listing to ensure proper conversion
  const { 
    preferredCurrency,
    preferredAmount,
    solAmount: convertedSolAmount,
    isSolLoading: solConversionLoading,
    isPreferredLoading: fiatConversionLoading,
    formattedOriginal,
    formattedPreferred,
    formattedSol,
    showConverted
  } = usePrice(listing.price, listingCurrency);

  return (
    <div className="flex items-center gap-4 border-b p-4">
      <div className="relative h-16 w-16 shrink-0">
        <Image
          src={listing.mainImage}
          alt={listing.title}
          fill
          className="rounded-md object-cover"
        />
      </div>
      <div>
        <h2 className="font-medium">{listing.title}</h2>
        <div className="mt-1">
          {/* Main price display - always show in user's preferred currency */}
          <span className="font-medium">
            {showConverted ? formattedPreferred : formattedOriginal}
            {fiatConversionLoading && showConverted && 
              <span className="text-xs font-normal ml-1 text-gray-500">(converting...)</span>}
          </span>
          
          {/* SOL equivalent */}
          <div className="text-sm text-gray-500">
            {solConversionLoading 
              ? 'Converting to SOL...' 
              : formattedSol}
          </div>
        </div>
      </div>
    </div>
  );
}
