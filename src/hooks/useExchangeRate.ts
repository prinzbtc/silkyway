import { useState, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { Currency } from '@/lib/price';
import { getSolPrice } from '@/lib/price';

type FiatCurrency = Exclude<Currency, 'SOL'>;

interface ExchangeRateState {
  currency: FiatCurrency;
  rate: number;
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_CURRENCY: FiatCurrency = 'USD';
const DEFAULT_RATE = 100; // 1 SOL = 100 USD by default

export function useExchangeRate() {
  const [preferredCurrency, setPreferredCurrency] = useLocalStorage<FiatCurrency>(
    'preferredCurrency',
    DEFAULT_CURRENCY
  );

  const [state, setState] = useState<ExchangeRateState>({
    currency: preferredCurrency,
    rate: DEFAULT_RATE,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchExchangeRate = async () => {
      try {
        // Use the centralized price conversion system
        const rate = await getSolPrice(preferredCurrency);
        
        if (rate === null) {
          throw new Error('Failed to fetch exchange rate');
        }

        if (isMounted) {
          setState({
            currency: preferredCurrency,
            rate,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (isMounted) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: 'Failed to fetch exchange rate',
          }));
        }
      }
    };

    fetchExchangeRate();

    return () => {
      isMounted = false;
    };
  }, [preferredCurrency]);

  const setCurrency = (newCurrency: FiatCurrency) => {
    setPreferredCurrency(newCurrency);
  };

  return {
    ...state,
    setCurrency,
  };
}
