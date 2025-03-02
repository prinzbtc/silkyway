'use client';

import { FC, useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import { cn } from '@/lib/utils';

export const CurrencySelector: FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { preferredCurrency, setPreferredCurrency } = useCurrencyPreference();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = [
    { value: 'USD', label: 'USD' },
    { value: 'EUR', label: 'EUR' },
    { value: 'GBP', label: 'GBP' },
  ] as const;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'inline-flex w-full items-center justify-center gap-x-1.5 rounded-md',
            'bg-white dark:bg-[hsl(222.2,84%,4.9%)] px-3 py-2 text-sm font-semibold',
            'text-midnight dark:text-[#ffffff] shadow-sm border border-midnight dark:border-[#ffffff]',
            'hover:bg-gray-50 dark:hover:bg-[hsl(222.2,84%,4.9%)] focus:outline-none',
            'focus:ring-2 focus:ring-midnight dark:focus:ring-[#ffffff] focus:ring-offset-2'
          )}
          id="currency-selector"
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          {options.find(opt => opt.value === preferredCurrency)?.label}
          <ChevronDown 
            className={cn(
              '-mr-1 h-5 w-5 transition-transform duration-200',
              'text-midnight dark:text-[#ffffff]',
              isOpen ? 'transform rotate-180' : ''
            )} 
            aria-hidden="true" 
          />
        </button>
      </div>

      {isOpen && (
        <div
          className={cn(
            'absolute right-0 z-10 mt-2 w-32 origin-top-right rounded-md',
            'bg-[#ffffff] dark:bg-[hsl(222.2,84%,4.9%)] shadow-lg',
            'border border-midnight dark:border-[#ffffff]',
            'focus:outline-none divide-y divide-midnight/20 dark:divide-[#ffffff]/20'
          )}
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="currency-selector"
        >
        <div className="py-1" role="none">
          {options.map((option) => (
            <button
              key={option.value}
              className={cn(
                'block w-full text-left px-4 py-2 text-sm',
                'text-midnight dark:text-[#ffffff]',
                'hover:bg-gray-50 dark:hover:bg-[hsl(222.2,84%,4.9%)]/90',
                option.value === preferredCurrency && 'bg-gray-50 dark:bg-[hsl(222.2,84%,4.9%)]/90'
              )}
              role="menuitem"
              onClick={() => {
                setPreferredCurrency(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        </div>
      )}
    </div>
  );
};
