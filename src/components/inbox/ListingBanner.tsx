'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import type { Listing } from '@/types/conversation';
import { formatPrice, formatSOL, getSolPrice } from '@/lib/price';

interface ListingBannerProps {
  listing: Listing;
}

export default function ListingBanner({ listing }: ListingBannerProps) {
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
          <span className="font-medium">{formatSOL(listing.price)}</span>
          {solPrice && (
            <span className="ml-1 text-sm text-gray-500">
              {formatPrice(listing.price * solPrice, preferredCurrency)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
