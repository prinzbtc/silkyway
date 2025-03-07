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
    const searchMode = searchParams.get('searchMode') || 'listings';

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
      searchMode: searchMode === 'listings' || searchMode === 'users' 
        ? searchMode as 'listings' | 'users' 
        : 'listings',
    });
  }, [searchParams]);

  // Set multiple filters at once
  const setFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    console.log('Setting multiple filters:', newFilters);
    
    setFiltersState(prev => {
      // Create a new filters object
      const updatedFilters = { ...prev };
      let hasChanges = false;
      
      // Process each filter
      for (const [key, value] of Object.entries(newFilters)) {
        const k = key as keyof SearchFilters;
        
        // Special handling for category and brand
        if ((k === 'category' || k === 'brand') && value === '__all__') {
          // If we're setting to '__all__', treat it as undefined
          if (prev[k] !== undefined) {
            updatedFilters[k] = undefined;
            hasChanges = true;
          }
          continue;
        }
        
        // Special handling for searchMode
        if (k === 'searchMode') {
          const validSearchModes: ('listings' | 'users')[] = ['listings', 'users'];
          const searchModeValue = value as string | undefined;
          
          if (searchModeValue !== undefined && !validSearchModes.includes(searchModeValue as any)) {
            console.warn(`Invalid searchMode: ${searchModeValue}. Defaulting to 'listings'`);
            updatedFilters[k] = 'listings' as any;
          } else {
            updatedFilters[k] = searchModeValue as any;
          }
          hasChanges = true;
          continue;
        }
        
        // For all other cases, only update if different
        if (JSON.stringify(prev[k]) !== JSON.stringify(value)) {
          updatedFilters[k] = value as any; // Use type assertion to avoid TypeScript errors
          hasChanges = true;
        }
      }
      
      // Only return updated state if there are changes
      return hasChanges ? updatedFilters : prev;
    });
  }, []);

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

    setFilters({ [key]: value });
  }, [setFilters]);

  // Reset filters to defaults
  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

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
    setParamIfNeeded('category', filters.category ? filters.category : null);
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
          console.log(`Setting brand URL param (array): ${brandParam}`);
        } else {
          setParamIfNeeded('brand', null);
        }
      } else if (filters.brand !== '__all__') {
        // If it's a string and not the default
        setParamIfNeeded('brand', filters.brand);
        console.log(`Setting brand URL param (string): ${filters.brand}`);
      } else {
        setParamIfNeeded('brand', null);
      }
    } else {
      setParamIfNeeded('brand', null);
    }
    
    setParamIfNeeded('q', filters.q || null);
    setParamIfNeeded('region', filters.region || null);
    
    // Handle sellerLocation (CountrySelectValue object or array)
    if (filters.sellerLocation) {
      const sellerLocationParam = JSON.stringify(filters.sellerLocation);
      setParamIfNeeded('sellerLocation', sellerLocationParam);
      console.log(`Setting sellerLocation URL param:`, filters.sellerLocation);
    } else {
      setParamIfNeeded('sellerLocation', null);
    }
    
    setParamIfNeeded('noDelivery', filters.noDelivery ? 'true' : null);
    setParamIfNeeded('handDelivery', filters.handDelivery ? 'true' : null);
    setParamIfNeeded('postalService', filters.postalService ? 'true' : null);
    setParamIfNeeded('searchMode', filters.searchMode || null);
    
    // Only update URL if there are actual changes
    if (hasChanges) {
      const newUrl = `${pathname}?${newParams.toString()}`;
      console.log(`Updating URL: ${newUrl}`);
      router.push(newUrl);
    } else {
      console.log('No URL changes needed');
    }
  }, [filters, pathname, router, searchParams]);

  // Use a ref to store the timeout ID for debouncing
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-sync filters to URL when they change with debouncing
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
      // Clear any existing timeout
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      // Store the current filters for comparison
      const currentFilters = { ...filters };
      
      // Set a new timeout to debounce the URL sync
      syncTimeoutRef.current = setTimeout(() => {
        // Only sync if filters haven't changed since timeout was set
        if (JSON.stringify(currentFilters) === JSON.stringify(filters)) {
          syncFiltersToURL();
        }
      }, 300); // Increased debounce time for better performance
    }
    
    // Cleanup function to clear the timeout
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
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
