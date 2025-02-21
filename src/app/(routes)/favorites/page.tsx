import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth/session';
import FavoritesGrid from '@/components/favorites/FavoritesGrid';
import FavoritesSkeletonGrid from '@/components/favorites/FavoritesSkeletonGrid';

export const metadata: Metadata = {
  title: 'Your Favorites - Silkyway',
  description: 'View your favorite listings on Silkyway',
};

export default async function FavoritesPage() {
  const session = await getSession();
  
  if (!session?.user?.id) {
    redirect('/');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Your Favorites</h1>
      <Suspense fallback={<FavoritesSkeletonGrid variant="default" />}>
        <FavoritesGrid variant="default" />
      </Suspense>
    </div>
  );
}
