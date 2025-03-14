'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Listing } from '@/types/conversation';
import type { ChatListing, ChatListingMedia } from '@/types/chat';
import { type Currency, normalizeCurrency } from '@/lib/price';
import { usePrice } from '@/hooks/usePrice';

// Helper function to get the main image from a listing
function getListingMainImage(listing: Listing | ChatListing): string {
  // First try to get the main media from the media array
  if (listing.media && listing.media.length > 0) {
    // Try to find the main media first
    const mainMedia = listing.media.find(media => media.isMainMedia);
    if (mainMedia && mainMedia.url) {
      return mainMedia.url;
    }
    
    // If no main media is marked, use the first one
    if (listing.media[0].url) {
      return listing.media[0].url;
    }
  }
  
  // Fallback to mainImage if available (for backward compatibility)
  if (listing.mainImage) {
    return listing.mainImage;
  }
  
  // Final fallback
  return '/placeholder-image.jpg';
}

interface ListingBannerProps {
  listing: Listing | ChatListing | null | undefined;
}

export default function ListingBanner({ listing, compact = false }: ListingBannerProps & { compact?: boolean }) {
  // Check if listing is null or undefined
  if (!listing) {
    console.warn('ListingBanner: Listing is null or undefined');
    return (
      <div className={`flex items-center gap-4 ${!compact ? 'border-b' : ''} p-3`}>
        <div className="text-gray-500 text-sm">No listing information available</div>
      </div>
    );
  }
  
  // Ensure currency is properly typed as Currency and use the actual listing currency
  // This is critical - we must use the currency that was stored with the listing
  // Use normalizeCurrency to ensure proper currency handling regardless of input type
  const listingCurrency = normalizeCurrency(listing.currency || 'USD');
  
  // For debugging only - can be removed in production
  try {
    console.log('ListingBanner - Original currency:', listing.currency, 'Normalized currency:', listingCurrency);
  } catch (error) {
    console.warn('Error logging listing currency:', error);
  }
  
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
  
  // Get seller information from the listing
  // In the ChatListing type, the seller is represented by the user property
  // Define a type for the seller to ensure TypeScript knows what properties it has
  type SellerType = {
    id?: string;
    username?: string;
    avatar?: string | null;
  };
  
  // Initialize seller as null
  let seller: SellerType | null = null;
  
  // Extract seller information based on the listing type
  if (listing) {
    if ('user' in listing && listing.user) {
      // ChatListing type has user property
      seller = listing.user as SellerType;
    } else if ('seller' in listing && listing.seller) {
      // Listing type might have seller property
      seller = listing.seller as SellerType;
    }
  }

  return (
    <div className={`flex items-start gap-3 ${!compact ? 'border-b' : ''} ${compact ? 'p-3' : 'p-4'}`}>
      {/* Listing's main media */}
      <div className={`relative ${compact ? 'h-16 w-16' : 'h-20 w-20'} shrink-0`}>
        <Image
          src={getListingMainImage(listing)}
          alt={listing.title || 'Listing'}
          fill
          className="rounded-md object-cover"
        />
      </div>
      
      <div className="flex-grow">
        {/* Listing title */}
        <h2 className={`font-medium ${compact ? 'text-sm line-clamp-1' : 'line-clamp-2'}`}>{listing.title}</h2>
        
        {/* Listing price */}
        <div className="mt-1">
          {/* Main price display - always show in user's preferred currency */}
          <span className={`font-medium ${compact ? 'text-sm' : ''}`}>
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
        
        {/* Seller information */}
        {seller && (
          <div className="flex items-center space-x-1 mt-2">
            <div className="relative w-4 h-4 rounded-full overflow-hidden bg-gray-200">
              {seller.avatar && (
                <Image
                  src={seller.avatar}
                  alt={seller.username || 'Seller avatar'}
                  fill
                  className="object-cover"
                />
              )}
            </div>
            <span className="text-xs text-gray-600">
              Seller: {seller.username || (seller.id && seller.id.slice(0, 8))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
