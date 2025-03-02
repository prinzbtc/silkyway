'use client';

import { useState, useEffect } from 'react';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import { Currency, convertCurrency, normalizeCurrency, formatPrice } from '@/lib/price';

interface PriceConversion {
  // Original values
  originalAmount: number;
  originalCurrency: Currency;
  
  // Converted values based on user preference
  preferredAmount: number | null;
  preferredCurrency: Currency;
  isPreferredLoading: boolean;
  
  // SOL equivalent (always calculated from original currency)
  solAmount: number | null;
  isSolLoading: boolean;
  
  // Formatted values for display
  formattedOriginal: string;
  formattedPreferred: string;
  formattedSol: string;
  
  // Helper to check if we need to show the converted amount
  // (when original currency differs from preferred currency)
  showConverted: boolean;
}

interface PriceHookOptions {
  refreshInterval?: number;
  maxRetries?: number;
}

const defaultOptions: PriceHookOptions = {
  refreshInterval: 30000, // 30 seconds
  maxRetries: 3,
};

/**
 * Unified hook for all price conversion needs
 * 
 * @param amount - The original price amount
 * @param currency - The currency of the original amount
 * @param options - Configuration options
 * @returns All price conversion data and loading states
 */
export function usePrice(
  amount: number,
  currency: Currency | string,
  options: PriceHookOptions = defaultOptions
): PriceConversion {
  const { preferredCurrency } = useCurrencyPreference();
  
  // Ensure we properly normalize the input currency and preferred currency
  // This is critical for proper comparison between currencies
  const normalizedCurrency = normalizeCurrency(currency);
  const normalizedPreferredCurrency = normalizeCurrency(preferredCurrency);
  
  // Debug the currency normalization
  console.log(`usePrice - Currency normalization: original=${currency}, normalized=${normalizedCurrency}, preferred=${preferredCurrency}, normalizedPreferred=${normalizedPreferredCurrency}`);
  
  // State for preferred currency conversion
  const [preferredAmount, setPreferredAmount] = useState<number | null>(null);
  const [isPreferredLoading, setIsPreferredLoading] = useState(true);
  
  // State for SOL conversion
  const [solAmount, setSolAmount] = useState<number | null>(null);
  const [isSolLoading, setIsSolLoading] = useState(true);
  
  // Retry counters
  const [preferredRetryCount, setPreferredRetryCount] = useState(0);
  const [solRetryCount, setSolRetryCount] = useState(0);
  
  // Debug logging
  console.log(`usePrice - amount: ${amount}, original currency: ${currency}, normalized: ${normalizedCurrency}, preferredCurrency: ${preferredCurrency}`);

  // Effect for preferred currency conversion
  useEffect(() => {
    // If no amount is provided, don't attempt conversion
    if (amount === undefined || amount === null || isNaN(amount)) {
      console.log(`usePrice - Invalid amount: ${amount}, skipping conversion`);
      setPreferredAmount(null);
      setIsPreferredLoading(false);
      return;
    }

    // If the currency is already the preferred currency, just return the original amount
    if (normalizedCurrency === normalizedPreferredCurrency) {
      console.log(`usePrice - Currency matches preferred currency (${normalizedCurrency} === ${normalizedPreferredCurrency}), returning original amount: ${amount}`);
      setPreferredAmount(amount);
      setIsPreferredLoading(false);
      return;
    }

    let isMounted = true;
    let retryTimeout: NodeJS.Timeout;

    async function updatePreferredPrice() {
      if (!isMounted) return;

      try {
        setIsPreferredLoading(true);
        console.log(`updatePreferredPrice - Converting ${amount} from ${normalizedCurrency} to ${preferredCurrency}`);
        
        // Use the centralized conversion function
        const result = await convertCurrency(
          amount,
          normalizedCurrency,
          preferredCurrency
        );
        
        if (!isMounted) return;

        if (result !== null) {
          console.log(`updatePreferredPrice - Conversion successful: ${amount} ${normalizedCurrency} = ${result} ${preferredCurrency}`);
          setPreferredAmount(result);
          setPreferredRetryCount(0); // Reset retry count on success
        } else {
          console.error(`updatePreferredPrice - Conversion failed: ${amount} ${normalizedCurrency} to ${preferredCurrency}`);
          throw new Error('Conversion not available');
        }
      } catch (error) {
        console.error('Error converting to preferred currency:', error);
        if (!isMounted) return;

        // Keep the previous value if available, otherwise set to null
        if (preferredAmount === null) {
          setPreferredAmount(null);
        }
        
        // Retry up to max retries with exponential backoff
        if (preferredRetryCount < (options.maxRetries || defaultOptions.maxRetries!)) {
          const delay = Math.pow(2, preferredRetryCount) * 1000; // 1s, 2s, 4s
          retryTimeout = setTimeout(() => {
            if (isMounted) {
              setPreferredRetryCount(prev => prev + 1);
              updatePreferredPrice();
            }
          }, delay);
        }
      } finally {
        if (isMounted) {
          setIsPreferredLoading(false);
        }
      }
    }

    updatePreferredPrice();

    // Update price at the specified interval
    const interval = setInterval(updatePreferredPrice, options.refreshInterval || defaultOptions.refreshInterval!);

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearTimeout(retryTimeout);
    };
  }, [amount, normalizedCurrency, preferredCurrency, preferredRetryCount, options.refreshInterval, options.maxRetries]);

  // Effect for SOL conversion
  useEffect(() => {
    // If no amount is provided, don't attempt conversion
    if (amount === undefined || amount === null || isNaN(amount)) {
      setSolAmount(null);
      setIsSolLoading(false);
      return;
    }

    // If the currency is already SOL, just return the original amount
    if (normalizedCurrency === 'SOL') {
      setSolAmount(amount);
      setIsSolLoading(false);
      return;
    }

    let isMounted = true;
    let retryTimeout: NodeJS.Timeout;

    async function updateSolPrice() {
      if (!isMounted) return;

      try {
        setIsSolLoading(true);
        console.log(`updateSolPrice - Converting ${amount} from ${normalizedCurrency} to SOL`);
        
        // Use the centralized conversion function
        const result = await convertCurrency(
          amount,
          normalizedCurrency,
          'SOL'
        );
        
        if (!isMounted) return;

        if (result !== null) {
          console.log(`updateSolPrice - Conversion successful: ${amount} ${normalizedCurrency} = ${result} SOL`);
          setSolAmount(result);
          setSolRetryCount(0); // Reset retry count on success
        } else {
          console.error(`updateSolPrice - Conversion failed: ${amount} ${normalizedCurrency} to SOL`);
          throw new Error('Conversion not available');
        }
      } catch (error) {
        console.error('Error converting to SOL:', error);
        if (!isMounted) return;

        // Keep the previous value if available, otherwise set to null
        if (solAmount === null) {
          setSolAmount(null);
        }
        
        // Retry up to max retries with exponential backoff
        if (solRetryCount < (options.maxRetries || defaultOptions.maxRetries!)) {
          const delay = Math.pow(2, solRetryCount) * 1000; // 1s, 2s, 4s
          retryTimeout = setTimeout(() => {
            if (isMounted) {
              setSolRetryCount(prev => prev + 1);
              updateSolPrice();
            }
          }, delay);
        }
      } finally {
        if (isMounted) {
          setIsSolLoading(false);
        }
      }
    }

    updateSolPrice();

    // Update price at the specified interval
    const interval = setInterval(updateSolPrice, options.refreshInterval || defaultOptions.refreshInterval!);

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearTimeout(retryTimeout);
    };
  }, [amount, normalizedCurrency, solRetryCount, options.refreshInterval, options.maxRetries]);

  // Format values for display
  const formattedOriginal = amount !== null && !isNaN(amount) 
    ? formatPrice(amount, normalizedCurrency) 
    : '—';
    
  const formattedPreferred = preferredAmount !== null && !isNaN(preferredAmount) 
    ? formatPrice(preferredAmount, normalizedPreferredCurrency) 
    : isPreferredLoading 
      ? '(converting...)' 
      : '—';
      
  const formattedSol = solAmount !== null && !isNaN(solAmount) 
    ? formatPrice(solAmount, 'SOL') 
    : isSolLoading 
      ? '(converting...)' 
      : '—';

  return {
    // Original values
    originalAmount: amount,
    originalCurrency: normalizedCurrency,
    
    // Converted values
    preferredAmount,
    preferredCurrency: normalizedPreferredCurrency,
    isPreferredLoading,
    
    // SOL equivalent
    solAmount,
    isSolLoading,
    
    // Formatted values
    formattedOriginal,
    formattedPreferred,
    formattedSol,
    
    // Helper - use direct comparison of normalized values
    showConverted: normalizedCurrency !== normalizedPreferredCurrency
  };
}
