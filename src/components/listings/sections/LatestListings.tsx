'use client';

import { FC, useState, useEffect } from 'react';
import { useListings } from '@/hooks/listing/useListings';
import { ListingGrid } from '../ListingGrid';
import { ListingGridSkeleton } from '../ListingGridSkeleton';

export const LatestListings: FC = () => {
  // Use state to force refresh
  const [refreshKey, setRefreshKey] = useState(Date.now());
  
  // Force refresh when component mounts
  useEffect(() => {
    console.log('LatestListings component mounted, forcing refresh');
    setRefreshKey(Date.now());
  }, []);
  
  const { listings, isLoading, error } = useListings({
    type: 'latest',
    limit: 8,
  }, [refreshKey]);

  if (error) {
    return (
      <div className="text-center text-gray-500">
        Failed to load latest listings
      </div>
    );
  }

  if (isLoading) {
    return <ListingGridSkeleton count={8} />;
  }

  if (listings.length === 0) {
    return (
      <div className="text-center text-gray-500">
        No listings found
      </div>
    );
  }

  return (
    <div>
      <ListingGrid listings={listings} />
    </div>
  );
};
