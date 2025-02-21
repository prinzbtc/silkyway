'use client';

import { useState, useEffect } from 'react';
import { ListingCard } from '@/components/listings/ListingCard';
import UserListingsSkeletonGrid from './UserListingsSkeletonGrid';
import { getUserListings } from '@/lib/actions/listing';

export default function UserListingsGrid({ 
  userId 
}: { 
  userId: string 
}) {
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserListings() {
      try {
        setIsLoading(true);
        const fetchedListings = await getUserListings(userId);
        setListings(fetchedListings);
      } catch (err) {
        setError('Failed to load listings');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserListings();
  }, [userId]);

  if (isLoading) {
    return <UserListingsSkeletonGrid />;
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-8">
        {error}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No listings found
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {listings.map((listing) => (
        <ListingCard 
          key={listing.id} 
          listing={listing} 
        />
      ))}
    </div>
  );
}
