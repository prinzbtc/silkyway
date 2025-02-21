'use client';

import { Transaction, User, Escrow } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';

interface AdmEscrowCardProps {
  escrow: Escrow & {
    transaction: Transaction & {
      buyer: User;
      seller: User;
    };
  };
  onReturnToBuyer: (escrowId: string) => Promise<void>;
  onReleaseToSeller: (escrowId: string) => Promise<void>;
}

export function AdmEscrowCard({
  escrow,
  onReturnToBuyer,
  onReleaseToSeller,
}: AdmEscrowCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'cancelled':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const handleReturnToBuyer = async () => {
    if (!confirm('Are you sure you want to return these funds to the buyer?')) {
      return;
    }
    setIsLoading(true);
    try {
      await onReturnToBuyer(escrow.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReleaseToSeller = async () => {
    if (!confirm('Are you sure you want to release these funds to the seller?')) {
      return;
    }
    setIsLoading(true);
    try {
      await onReleaseToSeller(escrow.id);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-sm font-medium ${getStatusColor(
                escrow.status
              )}`}
            >
              {escrow.status}
            </span>
            <p className="mt-1 text-sm text-gray-500">
              Created {formatDistanceToNow(new Date(escrow.createdAt))} ago
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-medium text-gray-900">
              ${escrow.transaction.amount.toFixed(2)}
            </p>
            <p className="text-sm text-gray-500">
              Protection Fee: ${(escrow.transaction.protectionFee || 0).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium">Buyer</p>
            <p>{escrow.transaction.buyer.username || 'Anonymous'}</p>
            <p className="text-xs text-gray-500 truncate">
              {escrow.transaction.buyer.walletAddress}
            </p>
          </div>
          <div>
            <p className="font-medium">Seller</p>
            <p>{escrow.transaction.seller.username || 'Anonymous'}</p>
            <p className="text-xs text-gray-500 truncate">
              {escrow.transaction.seller.walletAddress}
            </p>
          </div>
        </div>

        {escrow.status === 'pending' && (
          <div className="flex space-x-4">
            <Button
              onClick={handleReturnToBuyer}
              variant="outline"
              className="flex-1"
              disabled={isLoading}
            >
              Return to Buyer
            </Button>
            <Button
              onClick={handleReleaseToSeller}
              className="flex-1"
              disabled={isLoading}
            >
              Release to Seller
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
