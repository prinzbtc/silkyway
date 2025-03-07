'use client';

import { FC, useCallback, useEffect } from 'react';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { ListingGridSkeleton } from '@/components/listings/ListingGridSkeleton';
import { useListings } from '@/hooks/listing/useListings';
import { ListingCard } from '@/components/listings/ListingCard';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSearch } from '@/context/SearchProvider';
import UserResults from './UserResults';
import { cn } from '@/lib/utils';

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
  gap = 'lg' 
}) => {
  const { filters } = useSearch();
  const { 
    listings, 
    isLoading, 
    error, 
    loadMore,
    hasMore
  } = useListings({
    type: 'latest',
    filters: {
      category: filters.category,
      brand: Array.isArray(filters.brand) 
        ? filters.brand.map(b => b.value).join(',') 
        : filters.brand,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      q: filters.q,
      region: filters.region,
      sellerLocation: filters.sellerLocation,
      noDelivery: filters.noDelivery,
      handDelivery: filters.handDelivery,
      postalService: filters.postalService,
    }
  });

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="text-center text-destructive p-4">
        <p>{error.message}</p>
      </div>
    );
  }

  // Conditionally render based on search mode
  if (filters.searchMode === 'users') {
    return <UserResults />;
  }

  // Listings search results
  return (
    <div className={cn("space-y-4", className)}>
      {/* Listings Grid */}
      {listings.length === 0 ? (
        <div className="text-center text-gray-500 p-4">
          <p>No listings found matching your search criteria.</p>
        </div>
      ) : (
        <ListingGrid 
          listings={listings}
          columns={columns} 
          gap={gap}
          className={className}
        />
      )}

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center items-center space-x-4 mt-6">
          <Button 
            variant="outline"
            onClick={loadMore}
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
};
