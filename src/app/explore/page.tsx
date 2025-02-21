'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { ListingGridSkeleton } from '@/components/listings/ListingGridSkeleton';
import { ExploreFilters } from './ExploreFilters';
import { useListings } from '@/hooks/listing/useListings';

export default function ExplorePage() {
  const searchParams = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const [selectedSort, setSelectedSort] = useState<string>('latest');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [selectedBrand, setSelectedBrand] = useState<string>();
  const [deliveryOptions, setDeliveryOptions] = useState({
    noDelivery: false,
    handDelivery: false,
    postalService: false,
  });
  const [selectedRegion, setSelectedRegion] = useState<string>();

  // Initialize filters from URL params
  useEffect(() => {
    const category = searchParams.get('category');
    const sort = searchParams.get('sort') || 'latest';
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const brand = searchParams.get('brand');
    const region = searchParams.get('region');
    const noDelivery = searchParams.get('noDelivery') === 'true';
    const handDelivery = searchParams.get('handDelivery') === 'true';
    const postalService = searchParams.get('postalService') === 'true';

    if (category) setSelectedCategory(category);
    if (sort) setSelectedSort(sort);
    if (minPrice && maxPrice) {
      setPriceRange([parseFloat(minPrice), parseFloat(maxPrice)]);
    }
    if (brand) setSelectedBrand(brand);
    if (region) setSelectedRegion(region);
    setDeliveryOptions({
      noDelivery,
      handDelivery,
      postalService,
    });
  }, [searchParams]);

  // Get listings with infinite scroll
  const {
    listings,
    isLoading,
    error,
    hasMore,
    loadMore,
  } = useListings({
    type: selectedSort as any,
    limit: 12,
    filters: {
      category: selectedCategory,
      minPrice: priceRange[0],
      maxPrice: priceRange[1],
      brand: selectedBrand,
      region: selectedRegion,
      noDelivery: deliveryOptions.noDelivery,
      handDelivery: deliveryOptions.handDelivery,
      postalService: deliveryOptions.postalService,
    },
  });

  // Handle infinite scroll
  const handleScroll = useCallback(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop
      === document.documentElement.offsetHeight
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Explore Listings
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Find the perfect item from our curated collection
          </p>
        </div>

        {/* Filters */}
        <ExploreFilters
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          selectedSort={selectedSort}
          onSortChange={setSelectedSort}
          priceRange={priceRange}
          onPriceRangeChange={setPriceRange}
          brand={selectedBrand}
          onBrandChange={setSelectedBrand}
          deliveryOptions={deliveryOptions}
          onDeliveryOptionsChange={setDeliveryOptions}
          region={selectedRegion}
          onRegionChange={setSelectedRegion}
        />

        {/* Results */}
        <div className="mt-8">
          {error ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Failed to load listings</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 text-primary hover:text-primary/90"
              >
                Try again
              </button>
            </div>
          ) : listings.length > 0 ? (
            <ListingGrid
              listings={listings}
              columns={{ sm: 2, md: 3, lg: 4 }}
              gap="lg"
            />
          ) : isLoading ? (
            <ListingGridSkeleton count={12} />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No listings found</p>
            </div>
          )}

          {/* Loading more indicator */}
          {isLoading && listings.length > 0 && (
            <div className="mt-8">
              <ListingGridSkeleton count={4} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
