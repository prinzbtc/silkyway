import { useCallback, useEffect, useState } from 'react';
import { ListingWithFavorite } from '@/types/listing';

interface UseListingsFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  createdBy?: string;
  favoritedBy?: string;
  status?: 'active' | 'sold' | 'deleted';
  brand?: string;
  region?: string;
  noDelivery?: boolean;
  handDelivery?: boolean;
  postalService?: boolean;
}

interface UseListingsOptions {
  type: 'featured' | 'latest' | 'recommended' | 'price-low' | 'price-high' | 'most-favorited';
  limit?: number;
  filters?: UseListingsFilters;
}

interface UseListingsResult {
  listings: ListingWithFavorite[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

export function useListings(
  {
    type,
    limit = 8,
    filters = {},
  }: UseListingsOptions,
  dependencies: any[] = []
): UseListingsResult {
  const [listings, setListings] = useState<ListingWithFavorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchListings = useCallback(
    async (cursor?: string) => {
      try {
        setError(null);
        setIsLoading(true);

        const params = new URLSearchParams({
          type,
          limit: limit.toString(),
          ...(filters?.category && { category: filters.category }),
          ...(filters?.minPrice !== undefined && { minPrice: filters.minPrice.toString() }),
          ...(filters?.maxPrice !== undefined && { maxPrice: filters.maxPrice.toString() }),
          ...(filters?.createdBy && { createdBy: filters.createdBy }),
          ...(filters?.status && { status: filters.status }),
          ...(filters?.brand && { brand: filters.brand }),
          ...(filters?.noDelivery && { noDelivery: 'true' }),
          ...(filters?.handDelivery && { handDelivery: 'true' }),
          ...(filters?.postalService && { postalService: 'true' }),
        });
        
        console.log('Fetching listings with params:', Object.fromEntries(params.entries()));

        if (cursor) {
          params.append('cursor', cursor);
        }
        
        // Add a cache-busting timestamp to ensure we get fresh data
        params.append('_t', Date.now().toString());
        
        const response = await fetch(`/api/listings?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch listings');
        }

        const data = await response.json();
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch listings'));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [type, limit, filters.category, filters.minPrice, filters.maxPrice, filters.createdBy, filters.status, filters.brand, filters.region, filters.noDelivery, filters.handDelivery, filters.postalService]
  );

  // Initial fetch
  useEffect(() => {
    const initialFetch = async () => {
      console.log('Fetching listings with dependencies:', dependencies);
      const data = await fetchListings();
      if (data) {
        setListings(data.listings);
        setNextCursor(data.nextCursor);
      }
    };

    initialFetch();
  }, [fetchListings, ...dependencies]);

  // Load more function
  const loadMore = async () => {
    if (!nextCursor || isLoading) return;

    const data = await fetchListings(nextCursor);
    if (data) {
      setListings((prev) => [...prev, ...data.listings]);
      setNextCursor(data.nextCursor);
    }
  };

  return {
    listings,
    isLoading,
    error,
    hasMore: Boolean(nextCursor),
    loadMore,
  };
}
