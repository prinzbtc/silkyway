'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Rating {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  user: {
    username: string;
    avatar: string | null;
  };
}

interface RatingCardProps {
  userId: string;
}

export default function RatingCard({ userId }: RatingCardProps) {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRatings() {
      try {
        const response = await fetch(`/api/users/${userId}/ratings`);
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
  }, [userId]);

  const averageRating =
    ratings.length > 0
      ? ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length
      : 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ratings</CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Ratings</span>
          <div className="flex items-center">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-5 w-5 ${
                    i < averageRating ? 'fill-yellow-400' : 'fill-gray-200'
                  }`}
                />
              ))}
            </div>
            <span className="ml-2">
              {averageRating.toFixed(1)} ({ratings.length})
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ratings.length === 0 ? (
          <p className="text-center text-gray-500">No ratings yet</p>
        ) : (
          <div className="space-y-4">
            {ratings.map((rating) => (
              <div key={rating.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {rating.user.username || 'Anonymous'}
                  </span>
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < rating.rating ? 'fill-yellow-400' : 'fill-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-600">{rating.comment}</p>
                <p className="text-xs text-gray-400">
                  {new Date(rating.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
