import { useCallback, useEffect, useState } from 'react';
import { ListingWithFavorite } from '@/types/listing';

// Import CountrySelectValue type
import { CountrySelectValue } from '@/components/ui/country-select';

interface UseListingsFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  createdBy?: string;
  favoritedBy?: string;
  status?: 'active' | 'sold' | 'deleted';
  brand?: string;
  region?: string;
  sellerLocation?: CountrySelectValue | CountrySelectValue[];
  noDelivery?: boolean;
  handDelivery?: boolean;
  postalService?: boolean;
  q?: string; // Search query parameter
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

        // Check if we're showing all delivery options (both filters undefined)
        const showAllDeliveryOptions = filters?.noDelivery === undefined && filters?.postalService === undefined;
        console.log('useListings - showAllDeliveryOptions:', showAllDeliveryOptions);
        
        const params = new URLSearchParams({
          type,
          limit: limit.toString(),
          ...(filters?.category && { category: filters.category }),
          ...(filters?.minPrice !== undefined && { minPrice: filters.minPrice.toString() }),
          ...(filters?.maxPrice !== undefined && { maxPrice: filters.maxPrice.toString() }),
          ...(filters?.createdBy && { createdBy: filters.createdBy }),
          ...(filters?.status && { status: filters.status }),
          // Handle brand filter (could be string or array of BrandOption objects)
          ...(filters?.brand && { 
            brand: Array.isArray(filters.brand) ? JSON.stringify(filters.brand) : filters.brand,
            _brand_debug: `Brand filter applied: ${Array.isArray(filters.brand) ? 
              `${filters.brand.length} brands` : filters.brand}` 
          }),
          
          // Handle seller location (CountrySelectValue object or array)
          ...(filters?.sellerLocation && { 
            sellerLocation: JSON.stringify(filters.sellerLocation),
            _location_debug: `Seller location filter applied: ${Array.isArray(filters.sellerLocation) ? 
              `${filters.sellerLocation.length} locations` : filters.sellerLocation.label}` 
          }),
          
          // Add additional debug logging for seller location
          _debug_seller_location: filters?.sellerLocation ? 
            `Raw: ${JSON.stringify(filters.sellerLocation)}, Value: ${Array.isArray(filters.sellerLocation) ? 
              filters.sellerLocation.map(loc => loc.value).join(',') : filters.sellerLocation.value}` : 
            'No seller location filter',
        
          // Log all filters for debugging
          _all_filters: JSON.stringify(filters),
          
          // Pass delivery options filters only when they are defined (not undefined)
          // When undefined, no filter will be applied for that option
          ...(filters?.noDelivery !== undefined && { noDelivery: filters.noDelivery ? 'true' : 'false' }),
          ...(filters?.handDelivery !== undefined && { handDelivery: filters.handDelivery ? 'true' : 'false' }),
          ...(filters?.postalService !== undefined && { postalService: filters.postalService ? 'true' : 'false' }),
          
          // Add debug info for delivery options
          _delivery_debug: `noDelivery: ${filters?.noDelivery !== undefined ? (filters.noDelivery ? 'true' : 'false') : 'undefined'}, postalService: ${filters?.postalService !== undefined ? (filters.postalService ? 'true' : 'false') : 'undefined'}`,
          
          // Add a flag to indicate if we're showing all delivery options
          _all_delivery_options: showAllDeliveryOptions ? 'true' : 'false',
          
          // Add a special flag to force showing all delivery options when both filters are undefined
          ...(showAllDeliveryOptions && { show_all_delivery: 'true' }),
          
          ...(filters?.q && { q: filters.q }), // Add search query parameter
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
    [type, limit, filters.category, filters.minPrice, filters.maxPrice, filters.createdBy, filters.status, filters.brand, filters.region, filters.sellerLocation, filters.noDelivery, filters.handDelivery, filters.postalService, filters.q]
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