'use client';

import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFavorite } from '@/hooks/useFavorite';

interface FavoriteButtonProps {
  listingId: string;
  isFavorited: boolean;
  className?: string;
}

export function FavoriteButton({
  listingId,
  isFavorited,
  className,
}: FavoriteButtonProps) {
  const { isLoading, toggleFavorite } = useFavorite(listingId, isFavorited);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite();
      }}
      disabled={isLoading}
    >
      <Heart
        className={`h-5 w-5 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`}
      />
      <span className="sr-only">
        {isFavorited ? 'Remove from favorites' : 'Add to favorites'}
      </span>
    </Button>
  );
}
