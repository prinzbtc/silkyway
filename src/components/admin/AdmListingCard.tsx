'use client';

import { Listing, User } from '@prisma/client';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';

interface AdmListingCardProps {
  listing: Listing & {
    user: User;
    _count?: {
      favorites: number;
      offers: number;
      reports: number;
    };
  };
}

export function AdmListingCard({ listing }: AdmListingCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex gap-6">
        {/* Listing Image */}
        <div className="relative h-32 w-32 flex-shrink-0">
          <Image
            src={listing.images[0] || '/placeholder.png'}
            alt={listing.title}
            fill
            className="object-cover rounded-md"
          />
        </div>

        {/* Listing Details */}
        <div className="flex-grow space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {listing.title}
              </h3>
              <p className="text-sm text-gray-500">
                Listed by {listing.user.username || 'Anonymous'}
              </p>
            </div>
            <Link
              href={`/admin/listings/${listing.id}`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Control
            </Link>
          </div>

          <p className="text-lg font-medium text-gray-900">
            ${listing.price.toFixed(2)}
          </p>

          <div className="flex space-x-4 text-sm text-gray-600">
            <span>Category: {listing.category}</span>
            <span>Condition: {listing.condition}</span>
            <span>Status: {listing.status}</span>
          </div>

          <div className="flex space-x-4 text-sm text-gray-600">
            <span>Favorites: {listing._count?.favorites || 0}</span>
            <span>Offers: {listing._count?.offers || 0}</span>
            <span className={listing._count?.reports ? 'text-red-600 font-medium' : ''}>
              Reports: {listing._count?.reports || 0}
            </span>
          </div>

          <p className="text-sm text-gray-500">
            Listed {formatDistanceToNow(new Date(listing.createdAt))} ago
          </p>
        </div>
      </div>
    </div>
  );
}
