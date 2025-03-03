import { FC, useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { ListingWithFavorite } from '@/types/listing';
import { type Currency, normalizeCurrency } from '@/lib/price';
import { usePrice } from '@/hooks/usePrice';
import { MediaType } from '@/types/media';

interface SmallListingCardProps {
  listing: ListingWithFavorite;
}

export const SmallListingCard: FC<SmallListingCardProps> = ({ listing }) => {
  // Ensure currency is properly typed as Currency and use the actual listing currency
  // This is critical - we must use the currency that was stored with the listing
  // Use normalizeCurrency to ensure proper currency handling regardless of input type
  const listingCurrency = normalizeCurrency(listing.currency);
  
  // Debug the entire listing object
  console.log('SmallListingCard - Raw listing object:', JSON.stringify(listing, null, 2));
  console.log('SmallListingCard - Original currency:', listing.currency, 'Normalized currency:', listingCurrency, 'Price:', listing.price);
  console.log('SmallListingCard - Currency type check:', typeof listing.currency, 'Is null?', listing.currency === null, 'Is undefined?', listing.currency === undefined);
  
  // Use the consolidated price hook
  // IMPORTANT: We must directly pass the currency from the listing to ensure proper conversion
  const { 
    originalAmount,
    originalCurrency,
    preferredAmount,
    preferredCurrency,
    formattedOriginal,
    formattedPreferred,
    formattedSol,
    solAmount,
    isSolLoading,
    isPreferredLoading,
    showConverted
  } = usePrice(listing.price, listingCurrency);
  
  // Debug the price conversion
  console.log('SmallListingCard - Price conversion:', {
    originalAmount,
    originalCurrency,
    preferredAmount,
    preferredCurrency,
    showConverted,
    formattedOriginal,
    formattedPreferred,
    formattedSol
  });
  
  // Force log the comparison
  console.log(`SmallListingCard - Currency comparison: originalCurrency=${originalCurrency}, preferredCurrency=${preferredCurrency}, equal=${originalCurrency === preferredCurrency}`);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Get the main media or first media
  const mainMedia = listing.media?.[0] || null;

  const isVideo = mainMedia?.type === MediaType.VIDEO;

  // Initialize video element when component mounts
  useEffect(() => {
    if (videoRef.current && isVideo) {
      // Ensure video is muted and ready to play
      videoRef.current.muted = true;
      videoRef.current.load();
      console.log('Video element initialized in SmallListingCard:', mainMedia?.url);
    }
  }, [isVideo, mainMedia?.url]);

  // Auto-play video on hover
  useEffect(() => {
    if (!isVideo || !videoRef.current) return;
    
    if (isVideoPlaying) {
      // Reset video to beginning for better user experience
      videoRef.current.currentTime = 0;
      // Ensure video is muted
      videoRef.current.muted = true;
      // Play the video
      const playPromise = videoRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.error('Error playing video in SmallListingCard:', err);
          // If autoplay was prevented, try again with explicit user activation
          if (err.name === 'NotAllowedError') {
            console.log('Autoplay prevented, will try again on next user interaction');
          }
        });
      }
    } else {
      // Pause the video when not hovering
      videoRef.current.pause();
    }
    
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, [isVideoPlaying, isVideo]);

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group relative flex bg-white rounded-md shadow-sm overflow-hidden hover:shadow-md transition-all duration-200"
      onMouseEnter={() => setIsVideoPlaying(true)}
      onMouseLeave={() => setIsVideoPlaying(false)}
    >
      {/* Media */}
      <div className="relative w-20 h-20 flex-shrink-0 bg-gray-100">
        {isVideo ? (
          <div className="w-full h-full">
            <video
              ref={videoRef}
              src={mainMedia?.url}
              poster={mainMedia?.thumbnail}
              className="w-full h-full object-cover"
              muted
              loop
              playsInline
              preload="metadata"
            />
            {!isVideoPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Play className="w-4 h-4 text-white drop-shadow-lg" />
              </div>
            )}
          </div>
        ) : (
          <Image
            src={mainMedia?.url || '/placeholder-image.jpg'}
            alt={listing.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-200"
            sizes="80px"
          />
        )}
        
        {/* Video indicator */}
        {isVideo && (
          <div className="absolute top-0.5 left-0.5 z-10">
            <span className="px-1 py-0.5 text-[10px] font-medium bg-[hsl(222.2,84%,4.9%)] text-[#ffffff] rounded-sm backdrop-blur-sm">
              Video
            </span>
          </div>
        )}
        
        {/* Category Tag */}
        <div className="absolute bottom-0.5 left-0.5 z-10">
          <span className="px-1 py-0.5 text-[10px] font-medium bg-[hsl(222.2,84%,4.9%)] text-[#ffffff] rounded-sm backdrop-blur-sm">
            {listing.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow min-w-0 p-2">
        <h3 className="text-sm font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
          {listing.title}
        </h3>

        {/* Price */}
        <div className="mt-1 space-y-0.5">
          {/* Main price display - always show in user's preferred currency */}
          <div className="text-sm font-semibold text-gray-900">
            {/* When original and preferred currencies match, show original amount */}
            {/* When they differ, show the converted amount */}
            {originalCurrency === preferredCurrency
              ? formattedOriginal
              : isPreferredLoading
                ? <span>{formattedOriginal} <span className="text-xs font-normal text-gray-500">(converting...)</span></span>
                : formattedPreferred
            }
          </div>
          
          {/* SOL equivalent */}
          <div className="text-xs text-gray-500">
            {isSolLoading 
              ? 'Converting to SOL...' 
              : solAmount !== null 
                ? formattedSol 
                : 'SOL price unavailable'}
          </div>
        </div>
      </div>
    </Link>
  );
};
