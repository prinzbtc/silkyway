'use client';

import { FC } from 'react';
import { useListings } from '@/hooks/listing/useListings';
import { ListingGrid } from '../ListingGrid';
import { ListingGridSkeleton } from '../ListingGridSkeleton';

export const FeaturedListings: FC = () => {
  const { listings, isLoading, error } = useListings({
    type: 'featured',
    limit: 8,
  });

  if (error) {
    return (
      <div className="text-center text-gray-500">
        Failed to load featured listings
      </div>
    );
  }

  if (isLoading) {
    return <ListingGridSkeleton count={8} />;
  }

  if (listings.length === 0) {
    return (
      <div className="text-center text-gray-500">
        No featured listings found
      </div>
    );
  }

  return <ListingGrid listings={listings} />;
};
