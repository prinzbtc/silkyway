import { FC } from 'react';
import { cn } from '@/lib/utils';

interface ListingGridSkeletonProps {
  count?: number;
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

export const ListingGridSkeleton: FC<ListingGridSkeletonProps> = ({
  count = 8,
  variant = 'default',
  columns = { sm: 2, md: 3, lg: 4, xl: 4 },
  gap = 'md',
  className,
}) => {
  return (
    <div
      className={cn(
        'grid',
        'grid-cols-1',
        columns.sm && `sm:${getColumnsClass(columns.sm, 'sm')}`,
        columns.md && `md:${getColumnsClass(columns.md, 'md')}`,
        columns.lg && `lg:${getColumnsClass(columns.lg, 'lg')}`,
        columns.xl && `xl:${getColumnsClass(columns.xl, 'xl')}`,
        gapClasses[gap],
        className
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'bg-background rounded-lg shadow-sm overflow-hidden border',
            'animate-pulse'
          )}
        >
          {variant === 'small' ? (
            // Small card skeleton
            <div className="flex">
              <div className="w-20 h-20 bg-muted" />
              <div className="flex-grow p-2 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            </div>
          ) : (
            // Default card skeleton
            <>
              <div className="aspect-square bg-muted" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-muted rounded-full" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
                <div className="flex justify-between items-end pt-2">
                  <div className="space-y-1">
                    <div className="h-5 bg-muted rounded w-20" />
                    <div className="h-4 bg-muted rounded w-16" />
                  </div>
                  <div className="h-4 bg-muted rounded w-8" />
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};
