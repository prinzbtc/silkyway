'use client';

import { Skeleton } from '@/components/ui/skeleton';

type FavoritesSkeletonGridProps = {
  variant?: 'default' | 'small';
  count?: number;
};

export default function FavoritesSkeletonGrid({ 
  variant = 'default',
  count = variant === 'small' ? 4 : 8
}: FavoritesSkeletonGridProps) {
  const gridClassName = variant === 'small'
    ? 'grid grid-cols-1 sm:grid-cols-2 gap-4'
    : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6';

  const cardClassName = variant === 'small'
    ? 'bg-white rounded-lg shadow-sm p-3 space-y-3 flex gap-3'
    : 'bg-white rounded-lg shadow-sm p-4 space-y-4';

  if (variant === 'small') {
    return (
      <div className={gridClassName}>
        {[...Array(count)].map((_, index) => (
          <div key={index} className={cardClassName}>
            <Skeleton className="w-24 h-24 rounded-md flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex justify-between items-center pt-1">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={gridClassName}>
      {[...Array(count)].map((_, index) => (
        <div key={index} className={cardClassName}>
          <Skeleton className="w-full h-48 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="flex justify-between items-center pt-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
