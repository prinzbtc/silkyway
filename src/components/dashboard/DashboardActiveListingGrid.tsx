import { FC } from 'react';
import { ListingWithFavorite } from '@/types/listing';
import { SmallListingCard } from '@/components/listings/SmallListingCard';
import { cn } from '@/lib/utils';

interface DashboardActiveListingGridProps {
  listings: ListingWithFavorite[];
  columns?: {
    sm?: number;
    md?: number;
  };
  gap?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}

const gapClasses = {
  none: 'gap-0',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
};

const getColumnsClass = (columns: number, breakpoint: string) => {
  return `${breakpoint}:grid-cols-${columns}`;
};

export const DashboardActiveListingGrid: FC<DashboardActiveListingGridProps> = ({
  listings,
  columns = { sm: 2, md: 3 },
  gap = 'md',
  className,
}) => {
  return (
    <div
      className={cn(
        'grid',
        'grid-cols-1',
        columns.sm && getColumnsClass(columns.sm, 'sm'),
        columns.md && getColumnsClass(columns.md, 'md'),
        gapClasses[gap],
        className
      )}
    >
      {listings.map((listing) => (
        <SmallListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
};
