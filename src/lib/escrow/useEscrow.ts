'use client';

import { useConnection } from '@solana/wallet-adapter-react';
import { useCallback, useMemo } from 'react';
import { EscrowService } from './escrow';

export function useEscrow() {
  const { connection } = useConnection();
  
  const escrowService = useMemo(() => new EscrowService(connection), [connection]);

  const createEscrow = useCallback(
    async (amount: number, buyerAddress: string, sellerAddress: string) => {
      return escrowService.createEscrow(amount, buyerAddress, sellerAddress);
    },
    [escrowService]
  );

  const releaseToSeller = useCallback(
    async (escrowAddress: string, sellerAddress: string) => {
      return escrowService.releaseToSeller(escrowAddress, sellerAddress);
    },
    [escrowService]
  );

  const returnToBuyer = useCallback(
    async (escrowAddress: string, buyerAddress: string) => {
      return escrowService.returnToBuyer(escrowAddress, buyerAddress);
    },
    [escrowService]
  );

  return {
    createEscrow,
    releaseToSeller,
    returnToBuyer,
  };
}
