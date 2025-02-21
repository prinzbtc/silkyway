'use client';

import { useEffect, useState } from 'react';
import { RatingCard } from './RatingCard';

interface RatingListProps {
  userId: string;
  type: 'received' | 'given';
}

export default function RatingList({ userId, type }: RatingListProps) {
  type Rating = {
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

  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRatings() {
      try {
        const response = await fetch(
          `/api/users/${userId}/ratings?type=${type}`
        );
        if (!response.ok) throw new Error('Failed to fetch ratings');
        const data = await response.json();
        setRatings(data);
      } catch (error) {
        console.error('Error fetching ratings:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchRatings();
  }, [userId, type]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (ratings.length === 0) {
    return <div className="text-gray-500">No ratings yet</div>;
  }

  return (
    <div className="space-y-4">
      {ratings.map((rating) => (
        <RatingCard key={rating.id} rating={rating} />
      ))}
    </div>
  );
}
