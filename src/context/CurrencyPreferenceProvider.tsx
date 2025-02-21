'use client';

import { createContext, useContext, useState, useEffect, FC, ReactNode } from 'react';
import { Currency } from '@/lib/price';

type FiatCurrency = Exclude<Currency, 'SOL'>;

interface CurrencyPreferenceContextType {
  preferredCurrency: FiatCurrency;
  setPreferredCurrency: (currency: FiatCurrency) => void;
}

const CurrencyPreferenceContext = createContext<CurrencyPreferenceContextType | undefined>(undefined);

interface CurrencyPreferenceProviderProps {
  children: ReactNode;
}

export const CurrencyPreferenceProvider: FC<CurrencyPreferenceProviderProps> = ({ children }) => {
  const [preferredCurrency, setPreferredCurrency] = useState<FiatCurrency>('USD');

  useEffect(() => {
    // Load preference from localStorage
    const savedPreference = localStorage.getItem('preferredCurrency') as FiatCurrency | null;
    if (savedPreference && ['USD', 'EUR', 'GBP'].includes(savedPreference)) {
      setPreferredCurrency(savedPreference);
    }
  }, []);

  const updatePreferredCurrency = (currency: FiatCurrency) => {
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
