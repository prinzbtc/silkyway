'use client';

import { FC } from 'react';
import { useListings } from '@/hooks/listing/useListings';
import { ListingGrid } from '../ListingGrid';
import { ListingGridSkeleton } from '../ListingGridSkeleton';

export const RecommendedListings: FC = () => {
  const { listings, isLoading, error } = useListings({
    type: 'recommended',
    limit: 8,
  });

  if (error) {
    return (
      <div className="text-center text-gray-500">
        Failed to load recommended listings
      </div>
    );
  }

  if (isLoading) {
    return <ListingGridSkeleton count={8} />;
  }

  if (listings.length === 0) {
    return (
      <div className="text-center text-gray-500">
        No recommended listings found
      </div>
    );
  }

  return <ListingGrid listings={listings} />;
};
