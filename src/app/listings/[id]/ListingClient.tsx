'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import Image from 'next/image';
import { Heart, MessageCircle, Share2, AlertTriangle } from 'lucide-react';
import { useFavorite } from '@/hooks/useFavorite';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { usePrice } from '@/hooks/usePrice';
import { type Currency, normalizeCurrency } from '@/lib/price';
import { MediaCarousel } from '@/components/listings/MediaCarousel';
import { MediaFile, MediaType } from '@/types/media';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { cn, formatDate } from '@/lib/utils';
import { categories } from '@/lib/categories';

const getCategoryLabel = (value: string) => {
  const category = categories.find(c => c.value === value);
  return category?.label || value;
};

interface ListingType {
  id: string;
  title: string;
  description: string;
  price: number;
  currency?: Currency;
  category: string;
  brand?: string;
  condition: string;
  media: MediaFile[];
  images?: any[]; // For backward compatibility
  createdAt: string;
  user: {
    id: string;
    username: string;
    avatar?: string;
  };
  sold?: boolean;
  isFavorite?: boolean;
  favoritesCount?: number;
}

function ListingClient({ 
  initialListing,
  listingId,
  session
}: { 
  initialListing: ListingType | null;
  listingId: string;
  session: any;
}) {
  const router = useRouter();
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const [listing, setListing] = useState<ListingType | null>(initialListing);
  // Ensure currency is properly typed as Currency and use the actual listing currency
  // This is critical - we must use the currency that was stored with the listing
  // Use normalizeCurrency to ensure proper currency handling regardless of input type
  const listingCurrency = normalizeCurrency(listing?.currency);
  
  // Debug the currency value
  console.log('ListingClient - Original currency:', listing?.currency, 'Normalized currency:', listingCurrency);
  console.log('ListingClient - Currency type check:', typeof listing?.currency, 'Is null?', listing?.currency === null, 'Is undefined?', listing?.currency === undefined);
  
  // Use the consolidated price hook
  // IMPORTANT: We must directly pass the currency from the listing to ensure proper conversion
  const { 
    originalAmount,
    originalCurrency,
    preferredAmount: fiatAmount,
    preferredCurrency,
    solAmount,
    isPreferredLoading,
    isSolLoading: solConversionLoading,
    formattedOriginal,
    formattedPreferred,
    formattedSol,
    showConverted
  } = usePrice(listing?.price || 0, listingCurrency);
  
  // For backward compatibility
  const fiatConversionLoading = isPreferredLoading;
  const [isLoading, setIsLoading] = useState(!initialListing);
  const [error, setError] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [mediaDimensions, setMediaDimensions] = useState<{ width: number; height: number } | null>(null);

  // Use the useFavorite hook
  const { isFavorited, isLoading: isFavoriteLoading, toggleFavorite } = useFavorite(listingId);
  
  // Reset media dimensions when the modal is closed
  useEffect(() => {
    if (!showImageModal) {
      setMediaDimensions(null);
    }
  }, [showImageModal]);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const response = await fetch(`/api/listings/${listingId}`);
        if (!response.ok) {
          // Handle 404 specifically
          if (response.status === 404) {
            setError('Listing not found');
            setListing(null);
            return;
          }
          throw new Error('Failed to fetch listing');
        }
        
        // Check if response is valid JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Invalid response format');
        }
        
        const data = await response.json();
        
        // Validate that we have a proper listing object
        if (!data || !data.id) {
          throw new Error('Invalid listing data');
        }
        
        // Debug: Log the raw media data from the API
        console.log('Raw listing data from API:', {
          id: data.id,
          title: data.title,
          mediaCount: data.media?.length || 0,
          rawMedia: data.media?.map((m: any) => ({
            id: m.id,
            type: m.type,
            url: m.url,
            thumbnail: m.thumbnail
          }))
        });
        
        setListing(data);
      } catch (err) {
        console.error('Error fetching listing:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        setListing(null);
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if we don't already have the listing
    if (!initialListing) {
      fetchListing();
    } else {
      setIsLoading(false);
    }
  }, [listingId, initialListing]);

  const handleFavorite = async () => {
    if (!publicKey) {
      toast({
        title: 'Connect Wallet',
        description: 'Please connect your wallet to favorite listings',
        action: <ConnectButton />,
      });
      return;
    }
    await toggleFavorite();
  };

  const handleBuy = () => {
    if (!publicKey) {
      toast({
        title: 'Connect Wallet',
        description: 'Please connect your wallet to make a purchase',
        action: <ConnectButton />,
      });
      return;
    }

    // Redirect to checkout page
    router.push(`/checkout/${listingId}`);
  };

  const handleMessage = () => {
    if (!publicKey) {
      toast({
        title: 'Connect Wallet',
        description: 'Please connect your wallet to message the seller',
        action: <ConnectButton />,
      });
      return;
    }

    // Redirect to inbox with new conversation
    router.push(`/inbox/new?listingId=${listingId}`);
  };

  const handleMakeOffer = () => {
    if (!publicKey) {
      toast({
        title: 'Connect Wallet',
        description: 'Please connect your wallet to make an offer',
        action: <ConnectButton />,
      });
      return;
    }

    // Redirect to inbox with new conversation and price proposal
    router.push(`/inbox/new?listingId=${listingId}&action=offer`);
  };

  const handleReport = () => {
    // Redirect to report page
    router.push(`/report?listingId=${listingId}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <Skeleton className="w-full h-96" />
          <div className="p-6">
            <Skeleton className="h-8 w-3/4 mb-4" />
            <Skeleton className="h-4 w-1/2 mb-8" />
            <Skeleton className="h-24 w-full mb-6" />
            <div className="flex space-x-4">
              <Skeleton className="h-12 w-32" />
              <Skeleton className="h-12 w-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex flex-col items-center justify-center text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {error || 'Listing not found'}
            </h2>
            <p className="text-gray-500 mb-4">
              We couldn't find the listing you're looking for.
            </p>
            <Button onClick={() => router.push('/')}>
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = session?.user?.id === listing.user.id;

  // Convert legacy images format to media format if needed
  const listingMedia = listing.media || (listing.images ? 
    listing.images.map((img: any, index: number) => ({
      id: img.id,
      url: img.url,
      filename: `image-${index}.jpg`,
      type: MediaType.IMAGE,
      order: index,
      isMain: index === 0,
      thumbnail: img.thumbnail // Include thumbnail URL if available
    })) : []);
    
  // Debug: Log media items to check thumbnail URLs
  console.log('Listing media items:', listingMedia.map(item => ({
    id: item.id,
    type: item.type,
    url: item.url,
    thumbnail: item.thumbnail
  })));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Media */}
          <div>
            <MediaCarousel
              media={listingMedia}
              onMediaClick={(index) => {
                setSelectedMediaIndex(index);
                setMediaDimensions(null); // Reset dimensions when changing media
                setShowImageModal(true);
              }}
              autoplayVideos={false}
            />
          </div>

          {/* Listing Details */}
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {listing.title}
                  {listing.sold && (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Sold
                    </span>
                  )}
                </h1>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {getCategoryLabel(listing.category)}
                    {listing.brand && ` • ${listing.brand}`}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                    bg-white dark:bg-[hsl(222.2,84%,4.9%)]
                    text-[hsl(222.2,84%,4.9%)] dark:text-[#ffffff]
                    ring-1 ring-[hsl(222.2,84%,4.9%)] dark:ring-[#ffffff]">
                    {listing.condition.replace('-', ' ')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  ({listing.favoritesCount || 0})
                </span>
                {isOwner ? (
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/listings/${listingId}/edit`)}
                  >
                    Edit Listing
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleFavorite}
                    className={`!border-[hsl(222.2,84%,4.9%)] dark:!border-[#ffffff] ${isFavorited ? 'text-[#800808]' : ''} transition-transform active:scale-90`}
                    disabled={isOwner || isFavoriteLoading}
                  >
                    <Heart 
                      className={`h-5 w-5 transition-transform ${isFavorited ? 'scale-110' : 'scale-100'} ${isFavoriteLoading ? 'opacity-50' : ''}`} 
                      fill={isFavorited ? '#800808' : 'none'} 
                    />
                  </Button>
                )}
              </div>
            </div>

            <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-line">
              {listing.description}
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div>
                {/* Main price display - always show in user's preferred currency */}
                <p className="text-3xl font-bold text-gray-900">
                  {originalCurrency.toUpperCase() === preferredCurrency.toUpperCase()
                    ? formattedOriginal
                    : isPreferredLoading
                      ? <span>{formattedOriginal} <span className="text-lg font-normal text-gray-500">(converting...)</span></span>
                      : formattedPreferred
                  }
                </p>
                
                {/* SOL equivalent */}
                <p className="mt-1 text-sm text-gray-500">
                  {solConversionLoading 
                    ? 'Converting to SOL...' 
                    : solAmount !== null 
                      ? formattedSol 
                      : 'SOL price unavailable'}
                </p>
              </div>
            </div>

            {/* Seller Info */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-100">
                    <Image 
                      src={listing.user.avatar || '/uploads/listing/default-avatar.jpg'} 
                      alt={listing.user.username || 'Seller'} 
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <p 
                      className="text-sm font-medium text-gray-900 cursor-pointer hover:underline" 
                      onClick={() => router.push(`/users/${listing.user.id}`)}
                    >
                      {listing.user.username || 'Anon'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Listed {formatDate(listing.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    onClick={handleReport}
                    className="!bg-[#800808] !text-[#ffffff] hover:!bg-[#800808]/90 !border-0"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2 text-[#ffffff]" />
                    Report
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="!border-[hsl(222.2,84%,4.9%)] dark:!border-[#ffffff]"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-t border-gray-200 pt-6 space-y-4">
              {!listing.sold && (
                <>
                  <Button
                    className={`w-full !bg-[#0a4614] !text-[#ffffff] hover:!bg-[#0a4614]/90 !border-0 ${isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
                    size="lg"
                    onClick={handleBuy}
                    disabled={isOwner}
                  >
                    {isOwner ? 'Your Listing' : 'Buy Now'}
                  </Button>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      onClick={handleMakeOffer}
                      className={`!border-[hsl(222.2,84%,4.9%)] dark:!border-[#ffffff] ${isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={isOwner}
                    >
                      Make Offer
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleMessage}
                      className={`!border-[hsl(222.2,84%,4.9%)] dark:!border-[#ffffff] ${isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={isOwner}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Message Seller
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Media Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent 
          className="max-w-[90vw] w-auto p-0 bg-black overflow-hidden"
          style={{
            // Adjust dialog size based on content dimensions
            maxHeight: '90vh',
            height: 'auto',
            width: 'auto',
            // Set a reasonable aspect ratio based on the media dimensions
            ...(mediaDimensions && {
              aspectRatio: `${mediaDimensions.width} / ${mediaDimensions.height}`
            })
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              {listing.title} - Media {selectedMediaIndex + 1}
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative w-full h-full flex items-center justify-center">
            {listingMedia[selectedMediaIndex]?.type === MediaType.VIDEO ? (
              <div className="relative flex items-center justify-center">
                <video
                  src={listingMedia[selectedMediaIndex]?.url}
                  poster={listingMedia[selectedMediaIndex]?.thumbnail}
                  className="max-w-full max-h-[85vh] w-auto h-auto object-contain"
                  controls
                  autoPlay
                  playsInline
                  onLoadedMetadata={(e) => {
                    // Set video dimensions for dialog sizing
                    const width = e.currentTarget.videoWidth;
                    const height = e.currentTarget.videoHeight;
                    console.log('Video dimensions:', { width, height });
                    setMediaDimensions({ width, height });
                  }}
                />
              </div>
            ) : (
              <div className="relative w-full h-full max-h-[85vh] flex items-center justify-center">
                <Image
                  src={listingMedia[selectedMediaIndex]?.url || ''}
                  alt={`${listing.title} - Image ${selectedMediaIndex + 1}`}
                  className="max-w-full max-h-[85vh] object-contain"
                  width={1200}
                  height={800}
                  onLoad={(e) => {
                    // Get natural dimensions of the image
                    const img = e.currentTarget;
                    if (img.naturalWidth && img.naturalHeight) {
                      console.log('Image dimensions:', { 
                        width: img.naturalWidth, 
                        height: img.naturalHeight 
                      });
                      setMediaDimensions({
                        width: img.naturalWidth,
                        height: img.naturalHeight
                      });
                    }
                  }}
                  style={{
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '100%',
                    maxHeight: '85vh'
                  }}
                />
              </div>
            )}
          </div>
          
          <Button
            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white z-10"
            variant="ghost"
            size="sm"
            onClick={() => setShowImageModal(false)}
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export type { ListingType };
export default ListingClient;
