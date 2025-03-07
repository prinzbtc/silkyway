'use client';

import { FC, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchBar } from '@/components/search/SearchBar';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import { formatPrice } from '@/lib/price';
import { useMaxPrice } from '@/hooks/listing/useMaxPrice';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { categories } from '@/lib/constants';
import { BrandCategories } from '@/lib/brands';
import { useSearch } from '@/context/SearchProvider';

// Sort options for listings
const sortOptions = [
  { value: 'latest', label: 'Latest' },
  { value: 'featured', label: 'Featured' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'most-favorited', label: 'Most Favorited' },
];

// Import RegionSelect component
import RegionSelect, { regions } from '@/components/search/RegionSelect';

// Import CountrySelect value type and LocationSelect component
import { CountrySelectValue } from '@/components/ui/country-select';
import LocationSelect from '@/components/search/LocationSelect';
import BrandSelect, { BrandOption } from '@/components/search/BrandSelect';

// Initial popular brands (will be supplemented with database brands)
const initialPopularBrands = [
  { value: 'Nike', label: 'Nike' },
  { value: 'Adidas', label: 'Adidas' },
  { value: 'Apple', label: 'Apple' },
  { value: 'Samsung', label: 'Samsung' },
  { value: 'Sony', label: 'Sony' },
];

// Log the initial popular brands for debugging
console.log('Initial popular brands:', initialPopularBrands);

interface SearchFiltersProps {
  className?: string;
}

export const SearchFilters: FC<SearchFiltersProps> = ({ className }) => {
  // State for brands fetched from the database
  const [popularBrands, setPopularBrands] = useState(initialPopularBrands);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  
  // Fetch brands from the database when the component mounts
  useEffect(() => {
    async function fetchBrands() {
      setIsLoadingBrands(true);
      try {
        const response = await fetch('/api/brands');
        if (!response.ok) {
          throw new Error('Failed to fetch brands');
        }
        
        const brandsByCategory = await response.json();
        
        // Create a set of unique brand names from all categories
        const brandSet = new Set<string>();
        // Add type assertion to handle the unknown type from Object.values
        Object.values(brandsByCategory).forEach((brands) => {
          // Ensure brands is treated as a string array
          if (Array.isArray(brands)) {
            brands.forEach(brand => {
              if (typeof brand === 'string') {
                brandSet.add(brand);
              }
            });
          }
        });
        
        // Convert to the format needed for the select component
        const brandOptions = Array.from(brandSet).map(brand => {
          console.log(`Processing brand from database: ${brand}`);
          return {
            value: brand, // Keep original case to match database values
            label: brand
          };
        });
        
        // Combine with initial popular brands, ensuring no duplicates
        const combinedBrands = [...initialPopularBrands];
        brandOptions.forEach(option => {
          if (!combinedBrands.some(b => b.value === option.value)) {
            combinedBrands.push(option);
          }
        });
        
        // Sort alphabetically by label
        combinedBrands.sort((a, b) => a.label.localeCompare(b.label));
        
        setPopularBrands(combinedBrands);
      } catch (error) {
        console.error('Error fetching brands:', error);
        // Fall back to initial popular brands
      } finally {
        setIsLoadingBrands(false);
      }
    }
    
    fetchBrands();
  }, []);
  const { 
    filters, 
    setFilter, 
    setFilters,
    resetFilters, 
    hasActiveFilters,
    activeFilterCount
  } = useSearch();
  
  const { preferredCurrency } = useCurrencyPreference();
  const { maxPrice, isLoading: isLoadingMaxPrice, error: maxPriceError } = useMaxPrice();
  
  // Update maxPrice filter when the dynamic maxPrice changes
  useEffect(() => {
    if (!isLoadingMaxPrice && (!filters.maxPrice || filters.maxPrice === 1000)) {
      setFilter('maxPrice', maxPrice);
    }
  }, [maxPrice, isLoadingMaxPrice, filters.maxPrice, setFilter]);
  
  // Log any errors with maxPrice
  useEffect(() => {
    if (maxPriceError) {
      console.warn('Error loading max price, using fallback:', maxPriceError.message);
    }
  }, [maxPriceError]);

  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 ${className}`}>
      {/* Search Bar */}
      <div className="mb-4">
        <SearchBar className="w-full" autoFocus />
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Active Filters:</span>
          
          {filters.category && (
            <Badge variant="outline" className="flex items-center gap-1">
              Category: {filters.category}
              <button 
                onClick={() => setFilter('category', undefined)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {filters.brand && (
            <Badge variant="outline" className="flex items-center gap-1">
              Brand: {Array.isArray(filters.brand) 
                ? `${filters.brand.length} ${filters.brand.length === 1 ? 'brand' : 'brands'} selected` 
                : filters.brand}
              <button 
                onClick={() => setFilter('brand', undefined)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {(filters.minPrice !== 0 || filters.maxPrice !== 1000) && (
            <Badge variant="outline" className="flex items-center gap-1">
              Price: {filters.minPrice} - {filters.maxPrice} SOL
              <button 
                onClick={() => {
                  setFilter('minPrice', 0);
                  setFilter('maxPrice', 1000);
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {(filters.noDelivery || filters.handDelivery || filters.postalService) && (
            <Badge variant="outline" className="flex items-center gap-1">
              Delivery Options
              <button 
                onClick={() => {
                  setFilter('noDelivery', false);
                  setFilter('handDelivery', false);
                  setFilter('postalService', false);
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {filters.region && (
            <Badge variant="outline" className="flex items-center gap-1">
              Region: {regions.find(r => r.value === filters.region)?.label || filters.region}
              <button 
                onClick={() => setFilter('region', undefined)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {filters.sellerLocation && (
            <Badge variant="outline" className="flex items-center gap-1">
              Seller Location: {
                Array.isArray(filters.sellerLocation) 
                  ? `${filters.sellerLocation.length} countries` 
                  : filters.sellerLocation.label
              }
              <button 
                onClick={() => setFilter('sellerLocation', undefined)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={resetFilters}
            className="text-sm text-gray-500 hover:text-destructive"
          >
            Clear All
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        
        {/* Price Range Filter */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price Range ({preferredCurrency})
          </label>
          <div className="px-2">
            <Slider
              value={[filters.minPrice || 0, filters.maxPrice || maxPrice]}
              min={0}
              max={maxPrice}
              step={Math.max(1, Math.floor(maxPrice / 100))}
              onValueChange={(value) => {
                setFilter('minPrice', value[0]);
                setFilter('maxPrice', value[1]);
              }}
            />
            <div className="mt-2 flex justify-between text-sm text-gray-500">
              <span>{formatPrice(filters.minPrice || 0, preferredCurrency)}</span>
              <span>{formatPrice(filters.maxPrice || maxPrice, preferredCurrency)}</span>
            </div>
          </div>
        </div>
        
        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <Select
            value={filters.category || ""}
            onValueChange={(value) => setFilter('category', value || undefined)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sort Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sort By
          </label>
          <Select
            value={filters.sort || 'latest'}
            onValueChange={(value) => setFilter('sort', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Brand Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Brand
          </label>
          <BrandSelect
            value={Array.isArray(filters.brand) ? filters.brand as BrandOption[] : undefined}
            options={popularBrands}
            onChange={(value) => {
              console.log('Brands selected:', value);
              // Only set the filter if there are brands selected, otherwise set to undefined
              if (value.length > 0) {
                setFilter('brand', value);
              } else {
                setFilter('brand', undefined);
              }
            }}
            isLoading={isLoadingBrands}
          />
        </div>



        {/* Region Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Region
          </label>
          <RegionSelect
            value={filters.region}
            onChange={(regionValue, countries) => {
              console.log('Region selected:', regionValue);
              console.log('Countries in region:', countries);
              
              // Use a single operation to update both filters at once
              setFilters({
                region: regionValue,
                sellerLocation: countries
              });
            }}
          />
        </div>

        {/* Seller Location Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Seller Location
          </label>
          <LocationSelect
            value={Array.isArray(filters.sellerLocation) ? filters.sellerLocation as CountrySelectValue[] : filters.sellerLocation ? [filters.sellerLocation as CountrySelectValue] : undefined}
            onChange={(value) => {
              console.log('Countries selected:', value);
              // When manually selecting countries, clear any region filter and update sellerLocation in one operation
              setFilters({
                region: undefined,
                sellerLocation: value
              });
            }}
          />
        </div>
        
        {/* Delivery Options */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Delivery Options
          </label>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="noDelivery" 
                checked={filters.noDelivery}
                onCheckedChange={(checked) => setFilter('noDelivery', !!checked)}
              />
              <Label htmlFor="noDelivery">Pickup Only</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="handDelivery" 
                checked={filters.handDelivery}
                onCheckedChange={(checked) => setFilter('handDelivery', !!checked)}
              />
              <Label htmlFor="handDelivery">Hand Delivery</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="postalService" 
                checked={filters.postalService}
                onCheckedChange={(checked) => setFilter('postalService', !!checked)}
              />
              <Label htmlFor="postalService">Postal Service</Label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
