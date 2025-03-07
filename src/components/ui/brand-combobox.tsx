'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { BrandCategories } from '@/lib/brands';

interface BrandComboboxProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  category?: BrandCategories;
}

export function BrandCombobox({
  value,
  onChange,
  suggestions: initialSuggestions,
  placeholder = 'Start typing to see suggestions...',
  className,
  category,
}: BrandComboboxProps) {
  // State for storing suggestions from the database
  const [suggestions, setSuggestions] = React.useState<string[]>(initialSuggestions);
  const [isLoading, setIsLoading] = React.useState(false);
  
  // Fetch initial brands from the database when the component mounts or category changes
  React.useEffect(() => {
    console.log('BrandCombobox: category changed to', category);
    console.log('BrandCombobox: initialSuggestions', initialSuggestions);
    
    async function fetchInitialBrands() {
      setIsLoading(true);
      try {
        // Always start with the static suggestions
        let combinedSuggestions = [...initialSuggestions];
        
        // Only attempt to fetch from API if we have a valid category
        if (category && category.trim() !== '') {
          const url = `/api/brands?category=${encodeURIComponent(category)}`;
          console.log('BrandCombobox: fetching from URL', url);
          
          try {
            const response = await fetch(url);
            if (response.ok) {
              const data = await response.json();
              console.log('BrandCombobox: API response data', data);
              
              // Ensure data is an array before processing
              if (Array.isArray(data)) {
                // Add database brands to our suggestions
                data.forEach(brand => {
                  if (typeof brand === 'string' && !combinedSuggestions.includes(brand)) {
                    combinedSuggestions.push(brand);
                  }
                });
              } else {
                console.warn('Expected array of brand names but got:', data);
              }
            } else {
              console.warn('BrandCombobox: API response not OK', response.status);
            }
          } catch (fetchError) {
            console.error('BrandCombobox: Error fetching from API:', fetchError);
            // Continue with just the initial suggestions
          }
        } else {
          console.log('BrandCombobox: No valid category provided, skipping API call');
        }
        
        // Sort alphabetically and remove duplicates
        combinedSuggestions = Array.from(new Set(combinedSuggestions)).sort((a, b) => a.localeCompare(b));
        console.log('BrandCombobox: final suggestions', combinedSuggestions);
        
        // Update the suggestions state
        setSuggestions(combinedSuggestions);
      } catch (error) {
        console.error('Error in fetchInitialBrands:', error);
        // Fall back to initial suggestions
        setSuggestions(initialSuggestions);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchInitialBrands();
  }, [category, initialSuggestions]);

  const [inputValue, setInputValue] = React.useState(value);
  const [suggestion, setSuggestion] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Update internal state when external value changes
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Debounce timer for API calls
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);

    // Find suggestion from current suggestions
    if (newValue) {
      console.log('BrandCombobox: looking for suggestions starting with', newValue);
      console.log('BrandCombobox: available suggestions', suggestions);
      
      // Find a suggestion that starts with the input value (case-insensitive)
      const match = suggestions.find(
        (s) => s.toLowerCase().startsWith(newValue.toLowerCase())
      );
      console.log('BrandCombobox: found match?', match || 'No match');
      setSuggestion(match || '');
      
      // Debounce API call to fetch matching brands
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Only fetch from API if we have at least 2 characters and a valid category
      if (newValue.length >= 2 && category && category.trim() !== '') {
        debounceTimerRef.current = setTimeout(async () => {
          setIsLoading(true);
          try {
            const url = `/api/brands?category=${encodeURIComponent(category)}&query=${encodeURIComponent(newValue)}`;
            console.log('BrandCombobox: fetching suggestions with query:', url);
            
            const response = await fetch(url);
            
            if (response.ok) {
              const data = await response.json();
              console.log('BrandCombobox: API query response:', data);
              
              if (Array.isArray(data)) {
                // Start with initial suggestions
                let combinedSuggestions = [...initialSuggestions];
                
                // Add matching brands from API that aren't already in the suggestions
                data.forEach(brand => {
                  if (typeof brand === 'string' && !combinedSuggestions.includes(brand)) {
                    combinedSuggestions.push(brand);
                  }
                });
                
                // Remove duplicates and sort alphabetically
                combinedSuggestions = Array.from(new Set(combinedSuggestions)).sort((a, b) => a.localeCompare(b));
                console.log('BrandCombobox: updated suggestions after API query:', combinedSuggestions);
                
                setSuggestions(combinedSuggestions);
                
                // Update the current suggestion if needed (only if user is still typing the same value)
                if (inputValue === newValue) {
                  const newMatch = combinedSuggestions.find(
                    (s) => s.toLowerCase().startsWith(newValue.toLowerCase())
                  );
                  setSuggestion(newMatch || '');
                }
              }
            } else {
              console.warn('BrandCombobox: API query response not OK', response.status);
            }
          } catch (error) {
            console.error('Error fetching matching brands:', error);
          } finally {
            setIsLoading(false);
          }
        }, 300); // 300ms debounce
      }
    } else {
      setSuggestion('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Tab key completes the suggestion
    if (e.key === 'Tab' && suggestion && suggestion !== inputValue) {
      e.preventDefault();
      setInputValue(suggestion);
      onChange(suggestion);
      setSuggestion('');
    }
    // Enter key also completes the suggestion
    else if (e.key === 'Enter' && suggestion && suggestion !== inputValue) {
      e.preventDefault();
      setInputValue(suggestion);
      onChange(suggestion);
      setSuggestion('');
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'relative z-1',
          'bg-white dark:bg-[hsl(222.2,84%,4.9%)]',
          'text-black dark:text-white',
          className
        )}
      />
      {suggestion && suggestion !== inputValue && (
        <div 
          className="absolute inset-0 flex items-center pointer-events-none z-0"
          aria-hidden="true"
        >
          <span className="truncate pl-3 flex text-sm">
            <span className="invisible">{inputValue}</span>
            <span className="text-muted-foreground/60">
              {suggestion.slice(inputValue.length)}
            </span>
          </span>
        </div>
      )}
      
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin h-4 w-4 border-2 border-gray-500 rounded-full border-t-transparent"></div>
        </div>
      )}
    </div>
  );
}
