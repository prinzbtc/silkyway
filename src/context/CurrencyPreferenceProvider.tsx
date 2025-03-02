'use client';

import { createContext, useContext, useState, useEffect, FC, ReactNode } from 'react';
import { Currency } from '@/lib/price';

interface CurrencyPreferenceContextType {
  preferredCurrency: Currency;
  setPreferredCurrency: (currency: Currency) => void;
}

const CurrencyPreferenceContext = createContext<CurrencyPreferenceContextType | undefined>(undefined);

interface CurrencyPreferenceProviderProps {
  children: ReactNode;
}

export const CurrencyPreferenceProvider: FC<CurrencyPreferenceProviderProps> = ({ children }) => {
  const [preferredCurrency, setPreferredCurrency] = useState<Currency>('USD');

  useEffect(() => {
    // Load preference from localStorage
    const savedPreference = localStorage.getItem('preferredCurrency') as Currency | null;
    
    // Only accept USD, EUR, GBP as valid currencies
    // If SOL was previously selected, default to USD
    if (savedPreference && ['USD', 'EUR', 'GBP'].includes(savedPreference)) {
      setPreferredCurrency(savedPreference);
    } else if (savedPreference === 'SOL') {
      // If SOL was previously selected, reset to USD
      setPreferredCurrency('USD');
      localStorage.setItem('preferredCurrency', 'USD');
    }
  }, []);

  const updatePreferredCurrency = (currency: Currency) => {
    setPreferredCurrency(currency);
    localStorage.setItem('preferredCurrency', currency);
  };

  return (
    <CurrencyPreferenceContext.Provider
      value={{
        preferredCurrency,
        setPreferredCurrency: updatePreferredCurrency,
      }}
    >
      {children}
    </CurrencyPreferenceContext.Provider>
  );
};

export const useCurrencyPreference = () => {
  const context = useContext(CurrencyPreferenceContext);
  if (context === undefined) {
    throw new Error('useCurrencyPreference must be used within a CurrencyPreferenceProvider');
  }
  return context;
};
