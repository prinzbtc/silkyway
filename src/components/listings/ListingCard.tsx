import { FC } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ListingWithFavorite } from '@/types/listing';
import { formatPrice, formatSOL } from '@/lib/price';
import { useFavorite } from '@/hooks/useFavorite';
import { useConvertedPrice } from '@/hooks/price/useConvertedPrice';
import { cn } from '@/lib/utils';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import { useSessionContext } from '@/providers/SessionProvider';

interface ListingCardProps {
  listing: ListingWithFavorite;
}

export const ListingCard: FC<ListingCardProps> = ({ listing: initialListing }) => {
  const { publicKey } = useWallet();
  const { session } = useSessionContext();
  
  // Debug user IDs
  console.log('ListingCard - Listing Creator ID:', initialListing.user.id);
  console.log('ListingCard - Current User ID:', session?.user?.id);
  console.log('ListingCard - Should show heart?', session?.user?.id && initialListing.user.id !== session.user.id);
  // Get the favorite status
  const { data: listing, isFavorited, isLoading, toggleFavorite } = useFavorite(
    initialListing.id,
    initialListing
  );
  const { preferredCurrency } = useCurrencyPreference();
  const { convertedAmount } = useConvertedPrice(initialListing.price);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation(); // Stop event from bubbling up to the Link
    if (!session?.user?.id) {
      return;
    }
    if (initialListing.user.id === session.user.id) {
      // Users can't favorite their own listings
      return;
    }
    await toggleFavorite();
  };

  return (
    <Link
      href={`/listings/${initialListing.id}`}
      className="group relative flex flex-col bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all duration-200"
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        <Image
          src={initialListing.images[0].url}
          alt={initialListing.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-200"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        
        {/* Favorite Button - Only show if user is connected and not the listing creator */}
        {session?.user?.id && initialListing.user.id !== session.user.id && (
          <button
            onClick={handleFavoriteClick}
            disabled={isLoading}
            className={cn(
              'absolute top-2 right-2 z-10',
              'p-2 rounded-full',
              'bg-white/90 backdrop-blur-sm shadow-sm',
              'hover:bg-white transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-transform active:scale-90'
            )}
            aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart 
              className={`w-5 h-5 transition-all ${isFavorited ? 'scale-110' : 'scale-100'} ${isLoading ? 'opacity-50' : ''}`}
              fill={isFavorited ? '#800808' : 'none'}
              stroke={isFavorited ? '#800808' : 'currentColor'}
            />
          </button>
        )}

        {/* Category Tag */}
        <div className="absolute bottom-2 left-2">
          <span className="px-2 py-1 text-xs font-medium bg-black/60 text-white rounded-md backdrop-blur-sm">
            {initialListing.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-grow p-4 space-y-1">
        <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-primary transition-colors">
          {initialListing.title}
        </h3>

        {/* User Info */}
        <div className="flex items-center space-x-2">
          <div className="relative w-5 h-5 rounded-full overflow-hidden bg-gray-200">
            {initialListing.user.avatar && (
              <Image
                src={initialListing.user.avatar}
                alt={initialListing.user.username || 'User avatar'}
                fill
                className="object-cover"
              />
            )}
          </div>
          <span className="text-sm text-gray-600 truncate">
            {initialListing.user.username || initialListing.user.id.slice(0, 8)}
          </span>
        </div>

        {/* Price and Stats */}
        <div className="flex items-end justify-between mt-auto pt-2">
          <div className="flex flex-col">
            <div className="text-lg font-bold text-gray-900">
              {formatSOL(initialListing.price)}
            </div>
            {convertedAmount && (
              <div className="text-sm text-gray-500">
                {formatPrice(convertedAmount, preferredCurrency)}
              </div>
            )}
          </div>

          {/* Favorites Count */}
          <div className="flex items-center text-sm text-gray-500">
            <Heart className="w-4 h-4 mr-1 stroke-gray-500" />
            {(listing?.favoritesCount ?? initialListing.favoritesCount).toLocaleString()}
          </div>
        </div>
      </div>
    </Link>
  );
};
