'use client';

import { createContext, useContext, useState, useEffect, useCallback, FC, ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// Define the types for search filters
export interface SearchFilters {
  category?: string;
  sort?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  q?: string;
  region?: string;
  noDelivery?: boolean;
  handDelivery?: boolean;
  postalService?: boolean;
}

// Define the context type
interface SearchContextType {
  // Search state
  filters: SearchFilters;
  isSearching: boolean;
  
  // Search actions
  setFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  setFilters: (filters: Partial<SearchFilters>) => void;
  resetFilters: () => void;
  
  // URL sync helpers
  syncFiltersToURL: () => void;
  
  // Helper methods
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

// Create the context
const SearchContext = createContext<SearchContextType | undefined>(undefined);

// Default filters
const DEFAULT_FILTERS: SearchFilters = {
  sort: 'latest',
  minPrice: 0,
  maxPrice: undefined, // Will be set dynamically based on the highest price in the database
  noDelivery: false,
  handDelivery: false,
  postalService: false,
};

// Provider props
interface SearchProviderProps {
  children: ReactNode;
}

export const SearchProvider: FC<SearchProviderProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // State for search filters
  const [filters, setFiltersState] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [isSearching, setIsSearching] = useState(false);
  
  // Initialize filters from URL params
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    const category = categoryParam && categoryParam !== '__all__' ? categoryParam : undefined;
    
    const sort = searchParams.get('sort') || 'latest';
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    
    const brandParam = searchParams.get('brand');
    const brand = brandParam && brandParam !== '__all__' ? brandParam : undefined;
    
    const q = searchParams.get('q') || undefined;
    const region = searchParams.get('region') || undefined;
    const noDelivery = searchParams.get('noDelivery') === 'true';
    const handDelivery = searchParams.get('handDelivery') === 'true';
    const postalService = searchParams.get('postalService') === 'true';

    setFiltersState({
      category,
      sort,
      minPrice: minPrice ? parseFloat(minPrice) : DEFAULT_FILTERS.minPrice,
      maxPrice: maxPrice ? parseFloat(maxPrice) : DEFAULT_FILTERS.maxPrice,
      brand,
      q,
      region,
      noDelivery,
      handDelivery,
      postalService,
    });
  }, [searchParams]);

  // Set a single filter
  const setFilter = useCallback(<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    // Handle '__all__' value for category and brand
    if ((key === 'category' || key === 'brand') && value === '__all__') {
      value = undefined as any;
    }
    
    setFiltersState(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  // Set multiple filters at once
  const setFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    setFiltersState(prev => ({
      ...prev,
      ...newFilters
    }));
  }, []);

  // Reset filters to defaults
  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  // Sync filters to URL
  const syncFiltersToURL = useCallback(() => {
    const params = new URLSearchParams();
    
    // Only add params that are not default values
    if (filters.category) params.set('category', filters.category);
    if (filters.sort && filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
    if (filters.minPrice !== DEFAULT_FILTERS.minPrice) params.set('minPrice', filters.minPrice!.toString());
    if (filters.maxPrice) params.set('maxPrice', filters.maxPrice.toString());
    if (filters.brand) params.set('brand', filters.brand);
    if (filters.q) params.set('q', filters.q);
    if (filters.region) params.set('region', filters.region);
    if (filters.noDelivery) params.set('noDelivery', 'true');
    if (filters.handDelivery) params.set('handDelivery', 'true');
    if (filters.postalService) params.set('postalService', 'true');
    
    // Update the URL
    router.push(`${pathname}?${params.toString()}`);
  }, [filters, pathname, router]);

  // Auto-sync filters to URL when they change
  useEffect(() => {
    // We don't want to update URL on initial load
    const isInitialLoad = !searchParams.toString() && 
      Object.keys(filters).every(key => {
        const k = key as keyof SearchFilters;
        return filters[k] === DEFAULT_FILTERS[k];
      });
      
    // Only sync URL if we're on the explore page
    const isExplorePage = pathname.includes('/explore');
    
    if (!isInitialLoad && isExplorePage) {
      syncFiltersToURL();
    }
  }, [filters, syncFiltersToURL, searchParams, pathname]);

  // Calculate if there are any active filters
  const hasActiveFilters = Object.keys(filters).some(key => {
    const k = key as keyof SearchFilters;
    return filters[k] !== DEFAULT_FILTERS[k] && filters[k] !== undefined;
  });

  // Count active filters
  const activeFilterCount = Object.keys(filters).reduce((count, key) => {
    const k = key as keyof SearchFilters;
    return filters[k] !== DEFAULT_FILTERS[k] && filters[k] !== undefined ? count + 1 : count;
  }, 0);

  return (
    <SearchContext.Provider
      value={{
        filters,
        isSearching,
        setFilter,
        setFilters,
        resetFilters,
        syncFiltersToURL,
        hasActiveFilters,
        activeFilterCount,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};

// Custom hook to use the search context
export const useSearch = () => {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};
