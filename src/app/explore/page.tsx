'use client';

import { Suspense } from 'react';
import { SearchFilters } from '@/components/search/SearchFilters';
import { SearchResults } from '@/components/search/SearchResults';

export default function ExplorePage() {
  return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Explore Listings
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Browse all available items or use filters to narrow your search
            </p>
          </div>

          {/* Filters */}
          <SearchFilters className="mb-8" />

          {/* Results */}
          <Suspense fallback={<div className="h-96 flex items-center justify-center">Loading...</div>}>
            <SearchResults 
              className="mt-8"
              columns={{ sm: 2, md: 3, lg: 4 }}
              gap="lg"
            />
          </Suspense>
        </div>
      </div>
  );
}
