import { FC } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { categories } from '@/lib/constants';

interface DeliveryOptions {
  noDelivery: boolean;
  handDelivery: boolean;
  postalService: boolean;
}

interface ExploreFiltersProps {
  selectedCategory?: string;
  onCategoryChange: (category?: string) => void;
  selectedSort: string;
  onSortChange: (sort: string) => void;
  priceRange: [number, number];
  onPriceRangeChange: (range: [number, number]) => void;
  brand?: string;
  onBrandChange: (brand?: string) => void;
  deliveryOptions: DeliveryOptions;
  onDeliveryOptionsChange: (options: DeliveryOptions) => void;
  region?: string;
  onRegionChange: (region?: string) => void;
}

const sortOptions = [
  { value: 'latest', label: 'Latest' },
  { value: 'featured', label: 'Featured' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'most-favorited', label: 'Most Favorited' },
];

const regions = [
  { value: 'eu', label: 'European Union' },
  { value: 'na', label: 'North America' },
  { value: 'sa', label: 'South America' },
  { value: 'as', label: 'Asia' },
  { value: 'af', label: 'Africa' },
  { value: 'oc', label: 'Oceania' },
];

export const ExploreFilters: FC<ExploreFiltersProps> = ({
  selectedCategory,
  onCategoryChange,
  selectedSort,
  onSortChange,
  priceRange,
  onPriceRangeChange,
  brand,
  onBrandChange,
  deliveryOptions,
  onDeliveryOptionsChange,
  region,
  onRegionChange,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Update URL when filters change
  const updateUrl = (
    category?: string,
    sort?: string,
    range?: [number, number]
  ) => {
    const params = new URLSearchParams();

    if (category) params.set('category', category);
    if (sort) params.set('sort', sort);
    if (range) {
      params.set('minPrice', range[0].toString());
      params.set('maxPrice', range[1].toString());
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search Bar */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            value={searchParams.get('q') || ''}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams.toString());
              if (e.target.value) {
                params.set('q', e.target.value);
              } else {
                params.delete('q');
              }
              router.push(`${pathname}?${params.toString()}`);
            }}
            placeholder="Search listings..."
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          />
        </div>
        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <Select
            value={selectedCategory}
            onValueChange={(value) => {
              onCategoryChange(value);
              updateUrl(value, selectedSort, priceRange);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
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
            value={selectedSort}
            onValueChange={(value) => {
              onSortChange(value);
              updateUrl(selectedCategory, value, priceRange);
            }}
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

        {/* Price Range Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price Range (SOL)
          </label>
          <div className="px-2">
            <Slider
              value={[priceRange[0], priceRange[1]]}
              min={0}
              max={1000}
              step={1}
              onValueChange={(value) => {
                const range: [number, number] = [value[0], value[1]];
                onPriceRangeChange(range);
                updateUrl(selectedCategory, selectedSort, range);
              }}
            />
            <div className="mt-2 flex justify-between text-sm text-gray-500">
              <span>{priceRange[0]} SOL</span>
              <span>{priceRange[1]} SOL</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
