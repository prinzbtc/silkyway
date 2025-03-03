'use client';

import { FC, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSearch } from '@/context/SearchProvider';

interface SearchBarProps {
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  variant?: 'default' | 'minimal';
}

export const SearchBar: FC<SearchBarProps> = ({
  className = '',
  placeholder = 'Search listings...',
  autoFocus = false,
  variant = 'default',
}) => {
  const { filters, setFilter } = useSearch();
  const [inputValue, setInputValue] = useState(filters.q || '');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Sync input value with filters.q when it changes externally
  useEffect(() => {
    setInputValue(filters.q || '');
  }, [filters.q]);
  
  // Auto-focus if enabled
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // First update the filter in the context
    setFilter('q', inputValue || undefined);
    
    // Then navigate to the explore page with the search query
    // Only if we're not already on the explore page
    if (!window.location.pathname.includes('/explore')) {
      router.push(`/explore${inputValue ? `?q=${encodeURIComponent(inputValue)}` : ''}`);
    }
    
    // If we're already on the explore page, the SearchProvider will handle URL updates
    // This prevents double navigation
  };

  const handleClear = () => {
    setInputValue('');
    setFilter('q', undefined);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className={`relative flex items-center ${className}`}
    >
      <div className="relative w-full">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="w-4 h-4 text-gray-400 dark:text-[hsl(222.2,84%,4.9%)]" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          className={`
            block w-full pl-10 pr-12
            py-2 border border-gray-300 dark:border-gray-600 rounded-md
            bg-white dark:bg-white text-gray-900 dark:text-[hsl(222.2,84%,4.9%)]
            placeholder:text-gray-400 dark:placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
            ${variant === 'minimal' ? 'text-sm' : ''}
          `}
        />
        
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-10 flex items-center pr-2"
          >
            <X className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:text-[hsl(222.2,84%,4.9%)] dark:hover:text-[hsl(222.2,84%,4.9%)]" />
          </button>
        )}
      </div>
      
      <Button 
        type="submit"
        variant="ghost"
        size="sm"
        className="ml-2"
      >
        Search
      </Button>
    </form>
  );
};
