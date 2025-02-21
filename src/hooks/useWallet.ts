'use client';

import { useCallback } from 'react';
import { useConnection, useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js';

export function useWallet() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction: sendSolanaTransaction } = useSolanaWallet();

  const sendTransaction = useCallback(
    async (toAddress: string, amount: number) => {
      if (!publicKey) return null;

      try {
        const toPublicKey = new PublicKey(toAddress);
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: toPublicKey,
            lamports: amount * LAMPORTS_PER_SOL,
          })
        );

        const signature = await sendSolanaTransaction(
          transaction,
          connection
        );

        return signature;
      } catch (error) {
        console.error('Error sending transaction:', error);
        return null;
      }
    },
    [publicKey, connection, sendSolanaTransaction]
  );

  return {
    publicKey,
    sendTransaction,
  };
}
