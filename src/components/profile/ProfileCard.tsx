'use client';

import type { User } from '@/types/user';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Star } from 'lucide-react';
import { UserBadge } from '@/components/badges/UserBadge';
import { getUserBadges } from '@/lib/badges';

interface ProfileCardProps {
  user: Partial<User> & Pick<User, 'id' | 'walletAddress'> & {
    totalRating?: number;
    completedTransactionCount?: number;
    _count?: {
      listings: number;
      receivedReviews: number;
    };
  };
  isOwner: boolean;
}

export default function ProfileCard({ user, isOwner }: ProfileCardProps) {
  const router = useRouter();
  const username = user.username || 'Anon';
  const averageRating = user._count?.receivedReviews && user.totalRating
    ? Math.round((user.totalRating / user._count.receivedReviews) * 10) / 10
    : 0;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="relative h-20 w-20">
          {user.avatar ? (
            <Image
              src={user.avatar}
              alt={username}
              fill
              className="rounded-full object-cover"
            />
          ) : (
            <div className="h-full w-full rounded-full bg-gray-200 flex items-center justify-center text-2xl font-semibold text-gray-600">
              {username.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="absolute -right-1 -top-1 flex flex-col gap-1">
            {getUserBadges(user).map((badge) => (
              <UserBadge
                key={badge}
                type={badge}
                className="shadow-sm"
              />
            ))}
          </div>
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{username}</h2>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => {
              const filled = i + 1 <= averageRating;
              const halfFilled = !filled && i + 0.5 <= averageRating;
              return (
                <Star
                  key={i}
                  className={`h-4 w-4 ${filled ? 'fill-yellow-400' : halfFilled ? 'fill-yellow-200' : 'fill-gray-200'}`}
                />
              );
            })}
            <span className="ml-2 text-sm text-gray-600">
              ({user._count?.receivedReviews || 0} reviews)
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {(isOwner || !(user.hideWalletAddress ?? false)) && (
          <div>
            <h3 className="font-semibold">Solana Address</h3>
            <p className="font-mono text-sm">{user.walletAddress}</p>
          </div>
        )}

        {user.bio && (
          <div>
            <h3 className="font-semibold">Bio</h3>
            <p className="text-sm">{user.bio}</p>
          </div>
        )}

        {user.location && (
          <div>
            <h3 className="font-semibold">Location</h3>
            <p className="text-sm">{user.location}</p>
          </div>
        )}

        <div className="flex justify-between">
          <div>
            <h3 className="font-semibold">Member Since</h3>
            <p className="text-sm">
              {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              }) : 'Unknown'}
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Completed Trades</h3>
            <p className="text-sm text-center">
              {user.completedTransactionCount || 0}
            </p>
          </div>
        </div>

        {!isOwner && user.lastLoginAt && (
          <div>
            <h3 className="font-semibold">Last Seen</h3>
            <p className="text-sm">
              {formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-4">
          <Button asChild variant="outline">
            <Link href={`/users/${user.id}/userlistings`}>Current Listings</Link>
          </Button>

          {!isOwner && (
            <Button asChild variant="outline">
              <Link href={`/users/${user.id}/ratings`}>Ratings</Link>
            </Button>
          )}

          {isOwner && (
            <>
              <Button onClick={() => router.push('/profile/edit')}>
                Edit Profile
              </Button>
              <Button onClick={() => router.push('/create')}>
                Create Listing
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                Back to Dashboard
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
