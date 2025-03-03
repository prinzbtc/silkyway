import { useState, useEffect } from 'react';

export function useMaxPrice() {
  const [maxPrice, setMaxPrice] = useState<number>(1000);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchMaxPrice() {
      try {
        setIsLoading(true);
        console.log('Fetching max price from API...');
        const response = await fetch('/api/listings/max-price');
        
        if (!response.ok) {
          // Try to get the error message from the response
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData && errorData.error) {
              errorMessage = `${errorMessage} - ${errorData.error}`;
            }
          } catch (e) {
            // If we can't parse the JSON, just use the status code error
          }
          throw new Error(errorMessage);
        }
        
        const data = await response.json();
        console.log('Received max price data:', data);
        
        if ('error' in data) {
          throw new Error(data.error);
        }
        
        if (typeof data.maxPrice !== 'number') {
          throw new Error(`Invalid max price received: ${JSON.stringify(data)}`);
        }
        
        setMaxPrice(data.maxPrice);
        console.log('Max price set to:', data.maxPrice);
      } catch (err) {
        console.error('Error fetching max price:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        // Default to 10000 if there's an error
        console.log('Setting default max price to 10000 due to error');
        setMaxPrice(10000);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMaxPrice();
  }, []);

  return { maxPrice, isLoading, error };
}
