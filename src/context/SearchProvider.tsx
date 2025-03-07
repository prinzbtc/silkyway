'use client';

import { createContext, useContext, useState, useEffect, useCallback, FC, ReactNode } from 'react';
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
    
    // We'll handle brand parsing in a more comprehensive way below
    
    const q = searchParams.get('q') || undefined;
    const region = searchParams.get('region') || undefined;
    
    // Parse sellerLocation from URL (it's stored as JSON string)
    let sellerLocation: CountrySelectValue | CountrySelectValue[] | undefined = undefined;
    const sellerLocationParam = searchParams.get('sellerLocation');
    if (sellerLocationParam) {
      try {
        const parsedLocation = JSON.parse(sellerLocationParam);
        // Check if it's an array or a single object
        sellerLocation = Array.isArray(parsedLocation) ? parsedLocation : parsedLocation;
        console.log('Parsed sellerLocation from URL:', sellerLocation);
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
        // If it's an array, use it directly
        if (Array.isArray(parsedBrand)) {
          brand = parsedBrand;
          console.log('Parsed brand array from URL:', parsedBrand);
        } else {
          // If it's not an array but parsed successfully, it might be a single brand object
          brand = parsedBrand;
          console.log('Parsed single brand object from URL:', parsedBrand);
        }
      } catch (error) {
        // If parsing fails, it's likely a simple string
        if (brandParam !== '__all__') {
          brand = brandParam;
          console.log('Using brand string from URL:', brandParam);
        } else {
          brand = undefined;
        }
      }
    }
    
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
      sellerLocation,
      noDelivery,
      handDelivery,
      postalService,
    });
  }, [searchParams]);

  // Set a single filter
  const setFilter = useCallback(<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    // Handle '__all__' value for category and brand
    if ((key === 'category' || key === 'brand') && value === '__all__') {
      console.log(`Converting ${key} value '__all__' to undefined`);
      value = undefined as any;
    }
    
    // Special handling for brand filter
    if (key === 'brand') {
      console.log(`Brand filter being set to: ${value}, type: ${typeof value}`);
      console.log(`Raw brand value: ${JSON.stringify(value)}`);
    }
    
    setFiltersState(prev => {
      const newFilters = {
        ...prev,
        [key]: value
      };
      console.log(`New filters state after setting ${key}:`, newFilters);
      return newFilters;
    });
    
    // Log the filter change for debugging
    console.log(`Filter changed: ${key} = ${value}`);
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
    
    // Handle brand which could be a string or array of BrandOption
    if (filters.brand) {
      if (Array.isArray(filters.brand)) {
        // If it's an array of BrandOption, stringify it
        if (filters.brand.length > 0) {
          const brandParam = JSON.stringify(filters.brand);
          params.set('brand', brandParam);
          console.log(`Setting brand URL param (array): ${brandParam}`);
          console.log('Brand filter array:', filters.brand);
        }
      } else if (filters.brand !== '__all__') {
        // If it's a string and not the default
        params.set('brand', filters.brand);
        console.log(`Setting brand URL param (string): ${filters.brand}`);
      }
    }
    
    if (filters.q) params.set('q', filters.q);
    if (filters.region) params.set('region', filters.region);
    
    // Handle sellerLocation (CountrySelectValue object)
    if (filters.sellerLocation) {
      params.set('sellerLocation', JSON.stringify(filters.sellerLocation));
      console.log(`Setting sellerLocation URL param:`, filters.sellerLocation);
    }
    
    if (filters.noDelivery) params.set('noDelivery', 'true');
    if (filters.handDelivery) params.set('handDelivery', 'true');
    if (filters.postalService) params.set('postalService', 'true');
    
    // Log the URL we're pushing to
    console.log(`Updating URL: ${pathname}?${params.toString()}`);
    
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
