'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { useSessionContext } from '@/providers/SessionProvider';
import useSWR, { mutate } from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch favorite status');
  return res.json();
};

export function useFavorite(listingId: string, initialData?: any) {
  const router = useRouter();
  const { toast } = useToast();
  const { session } = useSessionContext();

  // Use SWR to manage favorite status
  const cacheKey = session?.user?.id ? `/api/listings/${listingId}/with-favorite` : null;
  const { data, error, mutate: mutateStatus } = useSWR(
    cacheKey,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: true,
      fallbackData: initialData
    }
  );

  const isFavorited = data?.isFavorite ?? false;
  const isLoading = !error && !data;

  const toggleFavorite = useCallback(async () => {
    if (!session?.user?.id) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to favorite listings',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Optimistically update the UI
      const newFavoriteState = !isFavorited;
      
      // Update this specific listing in the cache with optimistic count
      await mutateStatus(
        { 
          ...data, 
          isFavorite: newFavoriteState,
          favoritesCount: data.favoritesCount + (newFavoriteState ? 1 : -1)
        },
        { revalidate: false }
      );

      // Also update the specific listing in favorites if it exists
      await mutate(
        `/api/user/favorites`,
        (cachedData: any) => {
          if (!cachedData?.listings) return cachedData;
          return {
            ...cachedData,
            listings: cachedData.listings.map((listing: any) =>
              listing.id === listingId
                ? { 
                    ...listing, 
                    isFavorite: newFavoriteState,
                    favoritesCount: listing.favoritesCount + (newFavoriteState ? 1 : -1)
                  }
                : listing
            )
          };
        },
        { revalidate: false }
      );

      const response = await fetch(`/api/user/favorites/${listingId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to toggle favorite');
      }

      // Revalidate only the affected data
      await Promise.all([
        // Revalidate the current listing
        mutateStatus(),
        // Revalidate the favorites list
        mutate(`/api/user/favorites`)
      ]);

      toast({
        title: !isFavorited ? 'Added to Favorites' : 'Removed from Favorites',
        description: !isFavorited
          ? 'This listing has been added to your favorites'
          : 'This listing has been removed from your favorites',
      });
    } catch (error) {
      // Revert the optimistic update on error
      await mutateStatus();
      
      console.error('Error toggling favorite:', error);
      toast({
        title: 'Error',
        description: 'Failed to update favorite status',
        variant: 'destructive',
      });
    }
  }, [session?.user?.id, listingId, toast, data, isFavorited, mutateStatus]);

  return {
    data,
    isFavorited,
    isLoading,
    toggleFavorite
  };
}
