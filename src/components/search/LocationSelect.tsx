import { FC, useState, useEffect, useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import countries from 'world-countries';
import { CountrySelectValue } from '@/components/ui/country-select';

interface LocationSelectProps {
  value: CountrySelectValue[] | undefined;
  onChange: (value: CountrySelectValue[] | undefined) => void;
}

const LocationSelect: FC<LocationSelectProps> = ({ value, onChange }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountries, setSelectedCountries] = useState<CountrySelectValue[]>(value || []);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setSelectedCountries(value || []);
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

  // Map all countries to options format
  const countryOptions = countries.map((country) => ({
    value: country.cca2,
    label: country.name.common,
    flag: country.flag,
  }));
  
  const filteredCountries = searchQuery
    ? countryOptions.filter(country => 
        country.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        country.value.toLowerCase().includes(searchQuery.toLowerCase()))
    : countryOptions;

  const handleCountryToggle = (country: CountrySelectValue) => {
    const isSelected = selectedCountries.some(c => c.value === country.value);
    let newSelectedCountries: CountrySelectValue[];
    
    if (isSelected) {
      newSelectedCountries = selectedCountries.filter(c => c.value !== country.value);
    } else {
      newSelectedCountries = [...selectedCountries, country];
    }
    
    setSelectedCountries(newSelectedCountries);
    onChange(newSelectedCountries.length > 0 ? newSelectedCountries : undefined);
  };

  const handleClearAll = () => {
    setSelectedCountries([]);
    onChange(undefined);
  };

  const isCountrySelected = (countryValue: string) => {
    return selectedCountries.some(country => country.value === countryValue);
  };

  return (
    <div className="relative" ref={menuRef}>
      <div 
        className="flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedCountries.length > 0 ? (
          <div className="flex flex-wrap gap-1 items-center">
            {selectedCountries.length <= 2 ? (
              selectedCountries.map((country) => (
                <div key={country.value} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                  <span>{country.flag}</span>
                  <span className="dark:text-white">{country.label}</span>
                  <X 
                    className="h-3 w-3 cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCountryToggle(country);
                    }}
                  />
                </div>
              ))
            ) : (
              <>
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                  <span>{selectedCountries[0].flag}</span>
                  <span className="dark:text-white">{selectedCountries[0].label}</span>
                  <X 
                    className="h-3 w-3 cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCountryToggle(selectedCountries[0]);
                    }}
                  />
                </div>
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                  <span className="dark:text-white">+{selectedCountries.length - 1} more</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <span className="text-[hsl(222.2,84%,4.9%)] dark:text-[#ffffff]">All Locations</span>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 rounded-md border bg-[#ffffff] dark:bg-[hsl(222.2,84%,4.9%)] shadow-lg">
          <div className="sticky top-0 z-10 p-2 bg-[#ffffff] dark:bg-[hsl(222.2,84%,4.9%)] border-b border-gray-100 dark:border-gray-600">
            <input
              className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-[#ffffff] dark:bg-[#ffffff] text-gray-900 dark:text-[hsl(222.2,84%,4.9%)] placeholder:text-gray-400 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Search countries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          
          <div className="p-2 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-[#ffffff] dark:bg-[hsl(222.2,84%,4.9%)]">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {selectedCountries.length} selected
            </div>
            {selectedCountries.length > 0 && (
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
            {filteredCountries.map((country) => (
              <div 
                key={country.value} 
                className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer country-item bg-[#ffffff] dark:bg-[hsl(222.2,84%,4.9%)]"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCountryToggle(country);
                }}
              >
                <Checkbox 
                  checked={isCountrySelected(country.value)}
                  className="mr-2"
                  onCheckedChange={() => handleCountryToggle(country)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <span>{country.flag}</span>
                  <span>{country.label}</span>
                </div>
              </div>
            ))}
            {filteredCountries.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-gray-500 dark:text-gray-400 bg-[#ffffff] dark:bg-[hsl(222.2,84%,4.9%)]">
                No countries found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationSelect;
