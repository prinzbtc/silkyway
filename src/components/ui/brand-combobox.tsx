'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface BrandComboboxProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
}

export function BrandCombobox({
  value,
  onChange,
  suggestions,
  placeholder = 'Start typing to see suggestions...',
  className,
}: BrandComboboxProps) {
  const [inputValue, setInputValue] = React.useState(value);
  const [suggestion, setSuggestion] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Update internal state when external value changes
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);

    // Find suggestion
    if (newValue) {
      const match = suggestions.find(
        (s) => s.toLowerCase().startsWith(newValue.toLowerCase())
      );
      setSuggestion(match || '');
    } else {
      setSuggestion('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && suggestion && suggestion !== inputValue) {
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
    </div>
  );
}
