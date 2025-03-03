'use client';

import { FC, useEffect } from 'react';
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
import { useSearch } from '@/context/SearchProvider';

// Sort options for listings
const sortOptions = [
  { value: 'latest', label: 'Latest' },
  { value: 'featured', label: 'Featured' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'most-favorited', label: 'Most Favorited' },
];

// Region options
const regions = [
  { value: 'eu', label: 'European Union' },
  { value: 'na', label: 'North America' },
  { value: 'sa', label: 'South America' },
  { value: 'as', label: 'Asia' },
  { value: 'af', label: 'Africa' },
  { value: 'oc', label: 'Oceania' },
];

// Popular brands
const popularBrands = [
  { value: 'nike', label: 'Nike' },
  { value: 'adidas', label: 'Adidas' },
  { value: 'apple', label: 'Apple' },
  { value: 'samsung', label: 'Samsung' },
  { value: 'sony', label: 'Sony' },
];

interface SearchFiltersProps {
  className?: string;
}

export const SearchFilters: FC<SearchFiltersProps> = ({ className }) => {
  const { 
    filters, 
    setFilter, 
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
              Brand: {filters.brand}
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
        {/* Search Bar */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <SearchBar className="w-full" autoFocus />
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
          <Select
            value={filters.brand || ""}
            onValueChange={(value) => setFilter('brand', value || undefined)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Brands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Brands</SelectItem>
              {popularBrands.map((brand) => (
                <SelectItem key={brand.value} value={brand.value}>
                  {brand.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
