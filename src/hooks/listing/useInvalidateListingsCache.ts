import { useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

type InvalidationType = 'featured' | 'latest' | 'all' | 'recommended' | 'favorites';

export function useInvalidateListingsCache() {
  const { publicKey } = useWallet();

  const invalidateCache = useCallback(
    async (type: InvalidationType) => {
      try {
        const response = await fetch('/api/listings/cache/invalidate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type,
            userId: publicKey?.toBase58(),
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to invalidate cache');
        }

        return true;
      } catch (error) {
        console.error('Error invalidating cache:', error);
        return false;
      }
    },
    [publicKey]
  );

  return { invalidateCache };
}
