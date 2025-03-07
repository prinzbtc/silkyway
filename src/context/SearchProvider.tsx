'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, FC, ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// Import CountrySelectValue type
import { CountrySelectValue } from '@/components/ui/country-select';
// Import BrandOption type
import { BrandOption } from '@/components/search/BrandSelect';

// Define the types for search filters
export interface SearchFilters {
  category?: string;
  sort?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string | BrandOption[];
  q?: string;
  region?: string;
  sellerLocation?: CountrySelectValue | CountrySelectValue[];
  noDelivery?: boolean;
  handDelivery?: boolean;
  postalService?: boolean;
  searchMode?: 'listings' | 'users';
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
  searchMode: 'listings',
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
  
  // Sync filters to URL
  const syncFiltersToURL = useCallback(() => {
    // Get current URL params
    const currentParams = new URLSearchParams(searchParams.toString());
    const newParams = new URLSearchParams();
    let hasChanges = false;
    
    // Helper to check if we need to set a param
    const setParamIfNeeded = (key: string, value: string | null) => {
      const currentValue = currentParams.get(key);
      if (value === null) {
        // If param should be removed
        if (currentValue !== null) {
          hasChanges = true;
        }
      } else if (currentValue !== value) {
        // If param should be added/changed
        newParams.set(key, value);
        hasChanges = true;
      } else {
        // Keep existing value
        newParams.set(key, value);
      }
    };
    
    // Add filter params to URL
    setParamIfNeeded('category', filters.category || null);
    setParamIfNeeded('sort', filters.sort && filters.sort !== DEFAULT_FILTERS.sort ? filters.sort : null);
    
    // Safely handle minPrice
    if (filters.minPrice !== undefined && filters.minPrice !== null && filters.minPrice !== DEFAULT_FILTERS.minPrice) {
      setParamIfNeeded('minPrice', filters.minPrice.toString());
    } else {
      setParamIfNeeded('minPrice', null);
    }
    
    // Safely handle maxPrice
    if (filters.maxPrice !== undefined && filters.maxPrice !== null) {
      setParamIfNeeded('maxPrice', filters.maxPrice.toString());
    } else {
      setParamIfNeeded('maxPrice', null);
    }
    
    // Handle brand which could be a string or array of BrandOption
    if (filters.brand) {
      if (Array.isArray(filters.brand)) {
        // If it's an array of BrandOption, stringify it
        if (filters.brand.length > 0) {
          const brandParam = JSON.stringify(filters.brand);
          setParamIfNeeded('brand', brandParam);
        } else {
          setParamIfNeeded('brand', null);
        }
      } else if (filters.brand !== '__all__') {
        // If it's a string and not the default
        setParamIfNeeded('brand', filters.brand);
      } else {
        setParamIfNeeded('brand', null);
      }
    } else {
      setParamIfNeeded('brand', null);
    }
    
    // Handle search query
    setParamIfNeeded('q', filters.q || null);
    
    // Handle region
    setParamIfNeeded('region', filters.region || null);
    
    // Handle sellerLocation (CountrySelectValue object or array)
    if (filters.sellerLocation) {
      const sellerLocationParam = JSON.stringify(filters.sellerLocation);
      setParamIfNeeded('sellerLocation', sellerLocationParam);
    } else {
      setParamIfNeeded('sellerLocation', null);
    }
    
    // Handle delivery options
    setParamIfNeeded('noDelivery', filters.noDelivery ? 'true' : null);
    setParamIfNeeded('handDelivery', filters.handDelivery ? 'true' : null);
    setParamIfNeeded('postalService', filters.postalService ? 'true' : null);
    
    // Always include searchMode in URL
    setParamIfNeeded('searchMode', filters.searchMode || 'listings');
    
    // Only update URL if there are actual changes
    if (hasChanges) {
      const newUrl = `${pathname}?${newParams.toString()}`;
      router.push(newUrl);
    }
  }, [filters, pathname, router, searchParams]);
  
  // Initialize filters from URL params
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    const category = categoryParam && categoryParam !== '__all__' ? categoryParam : undefined;
    
    const sort = searchParams.get('sort') || 'latest';
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    
    const q = searchParams.get('q') || undefined;
    const region = searchParams.get('region') || undefined;
    
    // Parse sellerLocation from URL (it's stored as JSON string)
    let sellerLocation: CountrySelectValue | CountrySelectValue[] | undefined = undefined;
    const sellerLocationParam = searchParams.get('sellerLocation');
    if (sellerLocationParam) {
      try {
        const parsedLocation = JSON.parse(sellerLocationParam);
        sellerLocation = Array.isArray(parsedLocation) ? parsedLocation : parsedLocation;
      } catch (error) {
        console.error('Failed to parse sellerLocation from URL:', error);
      }
    }
    
    // Parse brand from URL (it could be a string or JSON array of BrandOption)
    let brand: string | BrandOption[] | undefined = undefined;
    const brandParam = searchParams.get('brand');
    if (brandParam) {
      try {
        // Try to parse as JSON first (for array of BrandOption)
        const parsedBrand = JSON.parse(brandParam);
        brand = Array.isArray(parsedBrand) ? parsedBrand : parsedBrand;
      } catch (error) {
        // If parsing fails, treat it as a string
        brand = brandParam;
      }
    }
    
    // Set initial filters from URL
    const initialFilters: SearchFilters = {
      ...DEFAULT_FILTERS,
      category,
      sort,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      brand,
      q,
      region,
      sellerLocation,
      noDelivery: searchParams.get('noDelivery') === 'true',
      handDelivery: searchParams.get('handDelivery') === 'true',
      postalService: searchParams.get('postalService') === 'true',
      searchMode: searchParams.get('searchMode') as 'listings' | 'users' || 'listings'
    };
    
    setFiltersState(initialFilters);
  }, [searchParams]);
  
  // Set filters from a partial object
  const setFilters = useCallback((partialFilters: Partial<SearchFilters>) => {
    setFiltersState(prev => {
      const updatedFilters = { ...prev, ...partialFilters };
      return updatedFilters;
    });
  }, []);
  
  // Set a single filter
  const setFilter = useCallback(<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    // Handle '__all__' value for category and brand
    if ((key === 'category' || key === 'brand') && value === '__all__') {
      value = undefined as any;
    }
    
    // Special handling for searchMode changes
    if (key === 'searchMode') {
      setFilters({ [key]: value });
      setTimeout(syncFiltersToURL, 0);
      return;
    }
    
    setFilters({ [key]: value });
  }, [setFilters, syncFiltersToURL]);
  
  // Reset filters to defaults
  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);
  
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
