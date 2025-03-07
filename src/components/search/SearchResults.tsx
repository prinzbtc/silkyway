'use client';

import { FC, useCallback, useEffect } from 'react';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { ListingGridSkeleton } from '@/components/listings/ListingGridSkeleton';
import { useListings } from '@/hooks/listing/useListings';
import { useSearch } from '@/context/SearchProvider';

interface SearchResultsProps {
  className?: string;
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'none' | 'sm' | 'md' | 'lg';
}

export const SearchResults: FC<SearchResultsProps> = ({
  className,
  columns = { sm: 2, md: 3, lg: 4 },
  gap = 'lg',
}) => {
  const { filters } = useSearch();
  
  // Get listings with infinite scroll
  const {
    listings,
    isLoading,
    error,
    hasMore,
    loadMore,
  } = useListings({
    type: filters.sort as any || 'latest',
    limit: 12,
    filters: {
      category: filters.category,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      brand: filters.brand,
      region: filters.region,
      sellerLocation: filters.sellerLocation, // Add seller location filter
      noDelivery: filters.noDelivery,
      handDelivery: filters.handDelivery,
      postalService: filters.postalService,
      q: filters.q, // Add search query parameter
    },
  }, [
    filters.category,
    filters.sort,
    filters.minPrice,
    filters.maxPrice,
    filters.brand,
    filters.region,
    filters.sellerLocation, // Add seller location to dependencies
    filters.noDelivery,
    filters.handDelivery,
    filters.postalService,
    filters.q,
  ]);

  // Handle infinite scroll
  const handleScroll = useCallback(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop
      >= document.documentElement.offsetHeight - 200
    ) {
      if (hasMore && !isLoading) {
        loadMore();
      }
    }
  }, [hasMore, isLoading, loadMore]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // If there's an error
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load listings</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 text-primary hover:text-primary/90"
        >
          Try again
        </button>
      </div>
    );
  }

  // If there are listings
  if (listings.length > 0) {
    return (
      <div className={className}>
        <ListingGrid
          listings={listings}
          columns={columns}
          gap={gap}
        />
        
        {/* Loading more indicator */}
        {isLoading && listings.length > 0 && (
          <div className="mt-8">
            <ListingGridSkeleton count={4} />
          </div>
        )}
      </div>
    );
  }

  // If loading initial results
  if (isLoading) {
    return (
      <div className={className}>
        <ListingGridSkeleton count={12} />
      </div>
    );
  }

  // If no results found
  return (
    <div className="text-center py-12">
      <p className="text-gray-500">No listings found</p>
      <p className="text-sm text-gray-400 mt-2">
        Try adjusting your filters or search terms
      </p>
    </div>
  );
};
