'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { Transaction, User, Listing } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';

interface TransactionDetails extends Transaction {
  buyer: User;
  seller: User;
  listing: Listing;
  escrow?: {
    id: string;
    status: string;
    createdAt: Date;
    events: {
      id: string;
      type: string;
      data: any;
      createdAt: Date;
    }[];
  };
}

export default function TransactionPage({
  params,
}: {
  params: { id: string };
}) {
  const { isAdmin } = useAdminAuth();
  const router = useRouter();
  const [transaction, setTransaction] = useState<TransactionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        const response = await fetch(`/api/admin/transactions/${params.id}`);
        if (!response.ok) throw new Error('Failed to fetch transaction');
        const data = await response.json();
        setTransaction(data);
      } catch (error) {
        console.error('Error fetching transaction:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAdmin) {
      fetchTransaction();
    }
  }, [isAdmin, params.id]);

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

  if (!isAdmin || !transaction) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Transaction Details
          </h1>
          <p className="text-gray-500">ID: {transaction.id}</p>
        </div>
        <div className="space-x-4">
          <Button onClick={() => window.print()} variant="outline">
            Print Details
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Transaction Status */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Transaction Status</h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                    transaction.status
                  )}`}
                >
                  {transaction.status}
                </span>
                <span className="text-gray-500">
                  {new Date(transaction.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="text-2xl font-semibold text-green-600">
                    ${transaction.amount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Protection Fee</p>
                  <p className="text-2xl font-semibold text-blue-600">
                    ${(transaction.protectionFee ?? 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Listing Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Listing Details</h2>
            <div className="space-y-4">
              <div className="relative aspect-video">
                <Image
                  src={transaction.listing.images[0] || '/placeholder.png'}
                  alt={transaction.listing.title}
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
              <h3 className="text-lg font-medium">{transaction.listing.title}</h3>
              <p className="text-gray-600">{transaction.listing.description}</p>
              <div className="flex space-x-4 text-sm text-gray-600">
                <span>Category: {transaction.listing.category}</span>
                <span>Condition: {transaction.listing.condition}</span>
              </div>
              <Link
                href={`/admin/listings/${transaction.listing.id}`}
                className="text-indigo-600 hover:text-indigo-500"
              >
                View Full Listing
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Buyer & Seller Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Participants</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Buyer</h3>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Username:</span>{' '}
                    {transaction.buyer.username || 'Anonymous'}
                  </p>
                  <p>
                    <span className="font-medium">Wallet:</span>{' '}
                    {transaction.buyer.walletAddress}
                  </p>
                  <Link
                    href={`/admin/users/${transaction.buyer.id}`}
                    className="text-indigo-600 hover:text-indigo-500"
                  >
                    View Buyer Profile
                  </Link>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">Seller</h3>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Username:</span>{' '}
                    {transaction.seller.username || 'Anonymous'}
                  </p>
                  <p>
                    <span className="font-medium">Wallet:</span>{' '}
                    {transaction.seller.walletAddress}
                  </p>
                  <Link
                    href={`/admin/users/${transaction.seller.id}`}
                    className="text-indigo-600 hover:text-indigo-500"
                  >
                    View Seller Profile
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Escrow Information */}
          {transaction.escrow && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-4">Escrow Details</h2>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                      transaction.escrow.status
                    )}`}
                  >
                    {transaction.escrow.status}
                  </span>
                  <span className="text-gray-500">
                    Created{' '}
                    {new Date(transaction.escrow.createdAt).toLocaleString()}
                  </span>
                </div>

                {/* Escrow Timeline */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Timeline</h3>
                  <div className="space-y-4">
                    {transaction.escrow.events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start space-x-3"
                      >
                        <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-indigo-600" />
                        <div>
                          <p className="font-medium">{event.type}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(event.createdAt).toLocaleString()}
                          </p>
                          {event.data && (
                            <pre className="mt-1 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                              {JSON.stringify(event.data, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
