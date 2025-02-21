'use client';

import useSWR from 'swr';
import { ListingCard } from '@/components/listings/ListingCard';
import { SmallListingCard } from '@/components/listings/SmallListingCard';
import FavoritesSkeletonGrid from './FavoritesSkeletonGrid';
import { Listing } from '@prisma/client';
import { useSessionContext } from '@/providers/SessionProvider';

import { ListingWithFavorite } from '@/types/listing';

type ListingWithUser = {
  user: {
    id: string;
    username: string | null;
    avatar: string | null;
  };
  images: {
    url: string;
  }[];
};

interface FavoriteWithListing {
  id: string;
  listing: Omit<ListingWithFavorite, 'isFavorite' | 'favoritesCount'> & ListingWithUser;
}

type FavoritesGridProps = {
  variant?: 'default' | 'small';
  limit?: number;
  className?: string;
};

export default function FavoritesGrid({ 
  variant = 'default',
  limit,
  className = ''
}: FavoritesGridProps) {
  const { session } = useSessionContext();
  const url = limit ? `/api/user/favorites?limit=${limit}` : '/api/user/favorites';
  const { data: favorites, error, isLoading } = useSWR<FavoriteWithListing[]>(
    session?.user?.id ? url : null,
    async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch favorites');
      }
      return response.json();
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
      keepPreviousData: true  // Keep showing old data while fetching new data
    }
  );

  if (isLoading) {
    return <FavoritesSkeletonGrid variant={variant} />;
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-8">
        Failed to load favorites
      </div>
    );
  }

  if (!favorites || favorites.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No favorites found. Start exploring listings to add some!
      </div>
    );
  }

  const gridClassName = variant === 'small'
    ? 'grid grid-cols-1 sm:grid-cols-2 gap-4 ' + className
    : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 ' + className;

  const ListingComponent = variant === 'small' ? SmallListingCard : ListingCard;

  return (
    <div className={gridClassName}>
      {favorites.map((favorite) => (
        <ListingComponent
          key={favorite.id}
          listing={{
            ...favorite.listing,
            brand: favorite.listing.brand || undefined,
            isFavorite: true,
            favoritesCount: 1
          }}
        />
      ))}
    </div>
  );
}
