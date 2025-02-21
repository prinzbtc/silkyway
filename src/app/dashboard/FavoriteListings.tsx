'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import FavoritesGrid from '@/components/favorites/FavoritesGrid';

export default function FavoriteListings() {
  return (
    <div className="bg-white rounded-lg shadow-md dark:shadow-[0_4px_12px_0px_rgba(0,0,0,0.5)] p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Your Favorites</h2>
        <Button variant="outline" asChild>
          <Link href="/favorites">
            View All
          </Link>
        </Button>
      </div>

      <FavoritesGrid 
        variant="small" 
        limit={4} 
      />

      <div className="mt-4 text-center">
        <Button variant="outline" asChild>
          <Link href="/explore">
            Explore Listings
          </Link>
        </Button>
      </div>
    </div>
  );
}
