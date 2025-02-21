'use client';

import { useState, useEffect } from 'react';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import { getSolPrice } from '@/lib/price';

export function useConvertedPrice(solAmount: number) {
  const { preferredCurrency } = useCurrencyPreference();
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    console.log('useConvertedPrice effect triggered:', {
      solAmount,
      preferredCurrency,
      retryCount
    });

    let isMounted = true;
    let retryTimeout: NodeJS.Timeout;

    async function updatePrice() {
      if (!isMounted) return;
      console.log('Starting price update...');

      try {
        setIsLoading(true);
        console.log('Fetching price for currency:', preferredCurrency);
        const price = await getSolPrice(preferredCurrency);
        console.log('Received price:', price);
        
        if (!isMounted) return;

        if (price !== null) {
          const amount = solAmount * price;
          console.log('Calculated converted amount:', amount);
          setConvertedAmount(amount);
          setRetryCount(0); // Reset retry count on success
        } else {
          console.log('Price is null, throwing error');
          throw new Error('Price not available');
        }
      } catch (error) {
        console.error('Error converting price:', error);
        if (!isMounted) return;

        setConvertedAmount(null);
        
        // Retry up to 3 times with exponential backoff
        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          console.log(`Scheduling retry ${retryCount + 1} in ${delay}ms`);
          retryTimeout = setTimeout(() => {
            if (isMounted) {
              setRetryCount(prev => prev + 1);
              updatePrice();
            }
          }, delay);
        } else {
          console.log('Max retries reached');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    updatePrice();

    // Update price every 30 seconds
    const interval = setInterval(updatePrice, 30000);

    return () => {
      console.log('Cleaning up useConvertedPrice effect');
      isMounted = false;
      clearInterval(interval);
      clearTimeout(retryTimeout);
    };
  }, [solAmount, preferredCurrency, retryCount]);

  return { convertedAmount, isLoading };
}
