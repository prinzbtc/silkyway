'use client';

import { Transaction, User, Listing } from '@prisma/client';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface AdmTransactionCardProps {
  transaction: Transaction & {
    buyer: User;
    seller: User;
    listing: Listing;
    escrow?: {
      id: string;
      status: string;
      createdAt: Date;
    };
  };
}

export function AdmTransactionCard({ transaction }: AdmTransactionCardProps) {
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-medium text-gray-900">
              {transaction.listing.title}
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-sm font-medium ${getStatusColor(
                transaction.status
              )}`}
            >
              {transaction.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <p className="font-medium">Buyer</p>
              <p>{transaction.buyer.username || 'Anonymous'}</p>
              <p className="text-xs text-gray-500">{transaction.buyer.walletAddress}</p>
            </div>
            <div>
              <p className="font-medium">Seller</p>
              <p>{transaction.seller.username || 'Anonymous'}</p>
              <p className="text-xs text-gray-500">{transaction.seller.walletAddress}</p>
            </div>
          </div>

          <div className="flex space-x-6 text-sm">
            <div>
              <span className="font-medium">Amount:</span>{' '}
              <span className="text-green-600">${transaction.amount.toFixed(2)}</span>
            </div>
            <div>
              <span className="font-medium">Protection Fee:</span>{' '}
              <span className="text-gray-600">${(transaction.protectionFee || 0).toFixed(2)}</span>
            </div>
            {transaction.shippingFee ? (
              <div>
                <span className="font-medium">Shipping Fee:</span>{' '}
                <span className="text-gray-600">${transaction.shippingFee.toFixed(2)}</span>
              </div>
            ) : null}
            {transaction.escrow && (
              <div>
                <span className="font-medium">Escrow:</span>{' '}
                <span
                  className={`${getStatusColor(transaction.escrow.status)}`}
                >
                  {transaction.escrow.status}
                </span>
              </div>
            )}
          </div>

          <p className="text-sm text-gray-500">
            Created {formatDistanceToNow(new Date(transaction.createdAt))} ago
          </p>
        </div>

        <Link
          href={`/admin/transactions/${transaction.id}`}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Control
        </Link>
      </div>
    </div>
  );
}
