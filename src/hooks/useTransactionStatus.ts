'use client';

import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

export function useTransactionStatus(signature: string | null) {
  const { connection } = useConnection();
  const [status, setStatus] = useState<TransactionStatus>('pending');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signature) return;

    const checkStatus = async () => {
      try {
        const result = await connection.getSignatureStatus(signature);
        
        if (!result?.value) {
          setStatus('pending');
          return;
        }

        if (result.value.err) {
          setStatus('failed');
          setError(result.value.err.toString());
          return;
        }

        if (result.value.confirmationStatus === 'confirmed' || 
            result.value.confirmationStatus === 'finalized') {
          setStatus('confirmed');
        }
      } catch (error) {
        console.error('Error checking transaction status:', error);
        setStatus('failed');
        setError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    // Check immediately
    checkStatus();

    // Set up subscription
    const subscriptionId = connection.onSignature(
      signature,
      (result, context) => {
        if (result.err) {
          setStatus('failed');
          setError(result.err.toString());
        } else {
          setStatus('confirmed');
        }
      },
      'confirmed'
    );

    // Clean up subscription
    return () => {
      connection.removeSignatureListener(subscriptionId);
    };
  }, [connection, signature]);

  return { status, error };
}
