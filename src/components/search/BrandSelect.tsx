import { FC, useState, useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Brand option interface
export interface BrandOption {
  value: string;
  label: string;
}

// Props for the BrandSelect component
interface BrandSelectProps {
  value: BrandOption[] | undefined;
  options: BrandOption[];
  onChange: (value: BrandOption[]) => void;
  isLoading?: boolean;
}

const BrandSelect: FC<BrandSelectProps> = ({ 
  value, 
  options, 
  onChange,
  isLoading = false
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<BrandOption[]>(value || []);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setSelectedBrands(value || []);
  }, [value]);
  
  // Handle click outside to close the menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!isMounted) {
    return null;
  }

  // Filter brands based on search query with more robust matching
  const filteredBrands = options.filter(brand => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    const label = brand.label.toLowerCase();
    const value = brand.value.toLowerCase();
    
    // Match against label or value
    return label.includes(query) || value.includes(query);
  });
  
  // Sort brands: selected first, then alphabetically
  const sortedBrands = [...filteredBrands].sort((a, b) => {
    // First sort by selection status
    const aSelected = selectedBrands.some(brand => brand.value === a.value);
    const bSelected = selectedBrands.some(brand => brand.value === b.value);
    
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    
    // Then sort alphabetically
    return a.label.localeCompare(b.label);
  });

  // Handle brand selection/deselection
  const handleBrandToggle = (brand: BrandOption) => {
    const isSelected = selectedBrands.some(b => b.value === brand.value);
    
    let updatedBrands: BrandOption[];
    
    if (isSelected) {
      // Remove brand if already selected
      updatedBrands = selectedBrands.filter(b => b.value !== brand.value);
    } else {
      // Add brand if not selected
      updatedBrands = [...selectedBrands, brand];
    }
    
    setSelectedBrands(updatedBrands);
    onChange(updatedBrands);
  };

  // Clear all selected brands
  const handleClearAll = () => {
    setSelectedBrands([]);
    onChange([]);
  };

  return (
    <div className="relative" ref={menuRef}>
      <div 
        className="flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedBrands.length > 0 ? (
          <div className="flex flex-wrap gap-1 items-center">
            {selectedBrands.length === 1 ? (
              <span>{selectedBrands[0].label}</span>
            ) : (
              <span>{selectedBrands.length} brands selected</span>
            )}
          </div>
        ) : (
          <span className="text-[hsl(222.2,84%,4.9%)] dark:text-[#ffffff]">All Brands</span>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 rounded-md border bg-[#ffffff] dark:bg-[hsl(222.2,84%,4.9%)] shadow-lg">
          <div className="sticky top-0 z-10 p-2 bg-[#ffffff] dark:bg-[hsl(222.2,84%,4.9%)] border-b border-gray-100 dark:border-gray-600">
            <input
              className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-[#ffffff] dark:bg-[#ffffff] text-gray-900 dark:text-[hsl(222.2,84%,4.9%)] placeholder:text-gray-400 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Search brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          <div className="p-2 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-[#ffffff] dark:bg-[hsl(222.2,84%,4.9%)]">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {selectedBrands.length} selected
            </div>
            {selectedBrands.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearAll();
                }}
                className="h-8 px-2 text-xs"
              >
                Clear All
              </Button>
            )}
          </div>

          <div className="overflow-y-auto max-h-[240px] py-1 bg-[#ffffff] dark:bg-[hsl(222.2,84%,4.9%)]">
            {isLoading ? (
              <div className="px-2 py-4 text-center text-sm text-gray-500 dark:text-gray-400 bg-[#ffffff] dark:bg-[hsl(222.2,84%,4.9%)]">
                Loading brands...
              </div>
            ) : sortedBrands.length > 0 ? (
              sortedBrands.map((brand) => (
              <div 
                key={brand.value} 
                className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer brand-item bg-[#ffffff] dark:bg-[hsl(222.2,84%,4.9%)]"
                onClick={(e) => {
                  e.stopPropagation();
                  handleBrandToggle(brand);
                }}
              >
                <div className="flex items-center flex-1">
                  <div className="flex items-center justify-center w-5 h-5 mr-2 border rounded-sm border-gray-300 dark:border-gray-600">
                    {selectedBrands.some(b => b.value === brand.value) && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <span className="text-sm text-gray-900 dark:text-white">{brand.label}</span>
                </div>
              </div>
            ))) : (
              <div className="px-2 py-4 text-center text-sm text-gray-500 dark:text-gray-400 bg-[#ffffff] dark:bg-[hsl(222.2,84%,4.9%)]">
                No brands found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandSelect;
