'use client';

import { useCallback, useState } from 'react';

interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
}

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
};

export function useRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
) {
  const [attempts, setAttempts] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const {
    maxAttempts,
    initialDelay,
    maxDelay,
    backoffFactor,
  } = { ...defaultOptions, ...options };

  const calculateDelay = useCallback(
    (attempt: number) => {
      const delay = initialDelay * Math.pow(backoffFactor, attempt);
      return Math.min(delay, maxDelay);
    },
    [initialDelay, maxDelay, backoffFactor]
  );

  const execute = useCallback(async () => {
    setIsRetrying(true);
    let currentAttempt = 0;

    while (currentAttempt < maxAttempts) {
      try {
        const result = await operation();
        setIsRetrying(false);
        setAttempts(0);
        return { success: true as const, data: result };
      } catch (error) {
        currentAttempt++;
        setAttempts(currentAttempt);

        if (currentAttempt === maxAttempts) {
          setIsRetrying(false);
          return {
            success: false as const,
            error: error instanceof Error ? error : new Error('Operation failed'),
          };
        }

        // Wait before retrying
        await new Promise(resolve => 
          setTimeout(resolve, calculateDelay(currentAttempt))
        );
      }
    }

    setIsRetrying(false);
    return {
      success: false as const,
      error: new Error('Max attempts reached'),
    };
  }, [operation, maxAttempts, calculateDelay]);

  return {
    execute,
    attempts,
    isRetrying,
    hasMoreAttempts: attempts < maxAttempts,
  };
}
