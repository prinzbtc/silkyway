'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface RatingCardProps {
  rating: {
    id: string;
    rating: number;
    comment: string;
    createdAt: string;
    author: {
      id: string;
      username: string;
    };
    listing: {
      id: string;
      title: string;
      mainImage: string;
    };
    transaction: {
      buyer: {
        id: string;
        username: string;
      };
      seller: {
        id: string;
        username: string;
      };
    };
    type: 'buyer' | 'seller';
  };
}

export function RatingCard({ rating }: RatingCardProps) {
  const {
    rating: stars,
    comment,
    author,
    listing,
    transaction,
    type,
  } = rating;

  return (
    <Card>
      <CardHeader className="flex-row items-start gap-4">
        <Link
          href={`/listings/${listing.id}`}
          className="relative h-24 w-24 shrink-0"
        >
          <Image
            src={listing.mainImage}
            alt={listing.title}
            fill
            className="rounded-md object-cover"
          />
        </Link>
        <div className="flex-1">
          <Link
            href={`/listings/${listing.id}`}
            className="font-medium hover:underline"
          >
            {listing.title}
          </Link>
          <div className="mt-1">
            <p className="text-sm text-gray-500">
              Rated by{' '}
              <Link
                href={`/users/${author.id}`}
                className="font-medium hover:underline"
              >
                {author.username || 'Anon'}
              </Link>
            </p>
            <div className="mt-1 flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < stars ? 'fill-yellow-400' : 'fill-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm">{comment}</p>
        <p className="mt-2 text-xs text-gray-500">
          {type === 'buyer' ? (
            <>
              Bought by{' '}
              <Link
                href={`/users/${transaction.buyer.id}`}
                className="font-medium hover:underline"
              >
                {transaction.buyer.username || 'Anon'}
              </Link>{' '}
              from{' '}
              <Link
                href={`/users/${transaction.seller.id}`}
                className="font-medium hover:underline"
              >
                {transaction.seller.username || 'Anon'}
              </Link>
            </>
          ) : (
            <>
              Sold by{' '}
              <Link
                href={`/users/${transaction.seller.id}`}
                className="font-medium hover:underline"
              >
                {transaction.seller.username || 'Anon'}
              </Link>{' '}
              to{' '}
              <Link
                href={`/users/${transaction.buyer.id}`}
                className="font-medium hover:underline"
              >
                {transaction.buyer.username || 'Anon'}
              </Link>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
