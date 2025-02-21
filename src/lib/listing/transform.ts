import { Listing, ListingWithFavorite } from '@/types/listing';

export function transformToListingWithFavorite(
  listing: any,
  userId?: string
): ListingWithFavorite {
  return {
    ...listing,
    isFavorite: listing.favorites?.length > 0,
    favoritesCount: listing._count?.favorites || 0,
    user: listing.user || { id: listing.userId },
    favorites: undefined,
    _count: undefined,
  };
}
