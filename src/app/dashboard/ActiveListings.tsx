'use client';

import { FC, useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { DashboardActiveListingGrid } from '@/components/dashboard/DashboardActiveListingGrid';
import { ListingGridSkeleton } from '@/components/listings/ListingGridSkeleton';
import { useListings } from '@/hooks/listing/useListings';

interface ActiveListingsProps {
  userId: string;
}

export const ActiveListings: FC<ActiveListingsProps> = ({ userId }) => {
  // Use state to force refresh
  const [refreshKey, setRefreshKey] = useState(Date.now());
  
  // Force refresh when component mounts
  useEffect(() => {
    console.log('ActiveListings component mounted, forcing refresh');
    setRefreshKey(Date.now());
  }, []);
  
  const {
    listings,
    isLoading,
    error,
  } = useListings({
    type: 'latest',
    limit: 6,
    filters: {
      createdBy: userId,
      status: 'active',
    },
    // Add the refreshKey as a dependency to force refresh
    // This will cause the hook to refetch when refreshKey changes
  }, [refreshKey]);

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md dark:shadow-[0_4px_12px_0px_rgba(0,0,0,0.5)] p-6">
        <p className="text-center text-gray-500">
          Failed to load listings
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md dark:shadow-[0_4px_12px_0px_rgba(0,0,0,0.5)] p-6">
        <ListingGridSkeleton count={6} />
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md dark:shadow-[0_4px_12px_0px_rgba(0,0,0,0.5)] p-6">
  
        <div className="text-center">
          <p className="text-gray-500 mb-4">
            You don&apos;t have any active listings yet
          </p>
          <Button asChild>
            <Link href="/create">
              Create Your First Listing
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md dark:shadow-[0_4px_12px_0px_rgba(0,0,0,0.5)] p-6">
      <DashboardActiveListingGrid
        listings={listings}
        columns={{ sm: 2, md: 3 }}
        gap="md"
      />
      {listings.length >= 6 && (
        <div className="mt-4 text-center">
          <Button variant="outline" asChild>
            <Link href="/listings/my">
              See All Listings
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
};
