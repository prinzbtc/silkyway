import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

type Currency = 'USD' | 'EUR' | 'GBP';

const RATES = {
  USD: 25000, // 1 SOL = $25000
  EUR: 23000, // 1 SOL = €23000
  GBP: 20000, // 1 SOL = £20000
};

export function useCurrencyPreference() {
  const [currency, setCurrency] = useLocalStorage<Currency>('currency', 'USD');

  const formatPrice = useCallback((amount: number) => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    });
    return formatter.format(amount);
  }, [currency]);

  const solToFiat = useCallback((solAmount: number) => {
    return solAmount * RATES[currency];
  }, [currency]);

  const fiatToSol = useCallback((fiatAmount: number) => {
    return fiatAmount / RATES[currency];
  }, [currency]);

  return {
    currency,
    setCurrency,
    formatPrice,
    solToFiat,
    fiatToSol,
  };
}
