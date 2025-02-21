import { FC } from 'react';
import { ListingWithFavorite } from '@/types/listing';
import { ListingCard } from './ListingCard';
import { SmallListingCard } from './SmallListingCard';
import { cn } from '@/lib/utils';

interface ListingGridProps {
  listings: ListingWithFavorite[];
  variant?: 'default' | 'small';
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
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
  return `grid-cols-${columns}`;
};

export const ListingGrid: FC<ListingGridProps> = ({
  listings,
  variant = 'default',
  columns = { sm: 2, md: 3, lg: 4, xl: 4 },
  gap = 'md',
  className,
}) => {
  const CardComponent = variant === 'small' ? SmallListingCard : ListingCard;

  return (
    <div
      className={cn(
        'grid',
        // Default mobile layout (1 column)
        'grid-cols-1',
        // Responsive columns
        columns.sm && `sm:${getColumnsClass(columns.sm, 'sm')}`,
        columns.md && `md:${getColumnsClass(columns.md, 'md')}`,
        columns.lg && `lg:${getColumnsClass(columns.lg, 'lg')}`,
        columns.xl && `xl:${getColumnsClass(columns.xl, 'xl')}`,
        // Gap
        gapClasses[gap],
        className
      )}
    >
      {listings.map((listing) => (
        <CardComponent key={listing.id} listing={listing} />
      ))}
    </div>
  );
};
