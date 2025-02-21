'use client';

import { User } from '@prisma/client';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface AdmUserProfileCardProps {
  user: User & {
    _count?: {
      listings: number;
      reviews: number;
      receivedReviews: number;
    };
  };
}

export function AdmUserProfileCard({ user }: AdmUserProfileCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-900">
            {user.username || 'Anonymous'}
          </h3>
          <p className="text-sm text-gray-500">
            {user.walletAddress}
          </p>
          <div className="flex space-x-4 text-sm text-gray-600">
            <span>Listings: {user._count?.listings || 0}</span>
            <span>Reviews Given: {user._count?.reviews || 0}</span>
            <span>Reviews Received: {user._count?.receivedReviews || 0}</span>
          </div>
          <p className="text-sm text-gray-500">
            Joined {formatDistanceToNow(new Date(user.createdAt))} ago
          </p>
        </div>
        <Link
          href={`/admin/users/${user.id}`}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Control
        </Link>
      </div>
    </div>
  );
}
