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
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import { useConvertedPrice } from '@/hooks/price/useConvertedPrice';
import { formatPrice } from '@/lib/price';
import { ImageCarousel } from '@/components/listings/ImageCarousel';
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
  category: string;
  brand?: string;
  condition: string;
  images: { id: string; url: string }[];
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
  const { preferredCurrency } = useCurrencyPreference();
  const [listing, setListing] = useState<ListingType | null>(initialListing);
  const { convertedAmount: fiatAmount } = useConvertedPrice(listing?.price || 0);
  const [isLoading, setIsLoading] = useState(!initialListing);
  const [error, setError] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Use the useFavorite hook
  const { isFavorited, isLoading: isFavoriteLoading, toggleFavorite } = useFavorite(listingId);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const response = await fetch(`/api/listings/${listingId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch listing');
        }
        const data = await response.json();
        setListing(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchListing();
  }, [listingId]);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Images */}
          <div>
            <ImageCarousel
              images={listing.images}
              onImageClick={(index) => {
                setSelectedImageIndex(index);
                setShowImageModal(true);
              }}
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

            <div className="prose prose-sm max-w-none text-gray-600">
              {listing.description}
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {listing.price.toFixed(6)} SOL
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  ≈ {formatPrice(fiatAmount || 0, preferredCurrency)}
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

      {/* Image Modal */}
      {showImageModal && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
          onClick={() => setShowImageModal(false)}
        >
          <div 
            className="relative w-full h-full max-w-7xl mx-auto p-4"
            onClick={e => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              className="absolute top-4 right-4 text-white z-50"
              onClick={() => setShowImageModal(false)}
            >
              Close
            </Button>
            <div className="h-full flex items-center justify-center">
              <Image
                src={listing.images[selectedImageIndex].url}
                alt={`Image ${selectedImageIndex + 1}`}
                width={1200}
                height={800}
                className="max-h-[90vh] w-auto h-auto object-contain"
                priority={selectedImageIndex === 0}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { ListingType };
export default ListingClient;
