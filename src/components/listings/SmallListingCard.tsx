import { FC } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ListingWithFavorite } from '@/types/listing';
import { formatPrice, formatSOL } from '@/lib/price';
import { useConvertedPrice } from '@/hooks/price/useConvertedPrice';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';

interface SmallListingCardProps {
  listing: ListingWithFavorite;
}

export const SmallListingCard: FC<SmallListingCardProps> = ({ listing }) => {
  const { preferredCurrency } = useCurrencyPreference();
  const { convertedAmount } = useConvertedPrice(listing.price);

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group relative flex bg-white rounded-md shadow-sm overflow-hidden hover:shadow-md transition-all duration-200"
    >
      {/* Image */}
      <div className="relative w-20 h-20 flex-shrink-0 bg-gray-100">
        <Image
          src={listing.images[0].url}
          alt={listing.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-200"
          sizes="80px"
        />
      </div>

      {/* Content */}
      <div className="flex-grow min-w-0 p-2">
        <h3 className="text-sm font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
          {listing.title}
        </h3>

        {/* Price */}
        <div className="mt-1 space-y-0.5">
          <div className="text-sm font-semibold text-gray-900">
            {formatSOL(listing.price)}
          </div>
          {convertedAmount && (
            <div className="text-xs text-gray-500">
              {formatPrice(convertedAmount, preferredCurrency)}
            </div>
          )}
        </div>
      </div>


    </Link>
  );
};
