'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import Image from 'next/image';
import { Heart, MessageCircle, Share2, AlertTriangle } from 'lucide-react';
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

// Mock listing data
const mockListing = {
  id: 'mock-123',
  title: 'Brand New MacBook Pro M3 Max',
  category: 'Electronics',
  brand: 'Apple',
  description: 'Latest MacBook Pro with M3 Max chip. 16-inch display, 32GB RAM, 1TB SSD. Space Black color. Perfect condition, only used for 2 weeks. Comes with original packaging and accessories. Includes AppleCare+ coverage until 2026. Original purchase receipt will be provided. Local pickup preferred but shipping available.',
  price: 2.5, // 2.5 SOL
  images: [
    { id: 'img1', url: '/mockImages/laptop1.jpg' },
    { id: 'img2', url: '/mockImages/laptop2.jpg' },
    { id: 'img3', url: '/mockImages/laptop3.jpg' }
  ],
  seller: {
    username: 'TechDealer',
    id: 'seller-123'
  },
  createdAt: new Date().toISOString(),
  status: 'active',
  sold: false,
  noDelivery: false,
  handDelivery: true,
  postalService: true,
  deliveryPrice: 0.01, // 0.01 SOL for shipping
  sellerId: 'different-from-your-wallet' // This ensures you're not shown as the owner
};

export default function TestListingPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const { preferredCurrency } = useCurrencyPreference();
  const [listing, setListing] = useState<any>(null);
  const { convertedAmount: fiatAmount } = useConvertedPrice(listing?.price || 0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    // Simulate API delay for realism
    const timer = setTimeout(() => {
      setListing(mockListing);
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handleFavorite = () => {
    if (!publicKey) {
      toast({
        title: 'Connect Wallet',
        description: 'Please connect your wallet to add items to favorites',
        action: <ConnectButton />,
      });
      return;
    }

    setIsFavorite(!isFavorite);
    toast({
      title: isFavorite ? 'Removed from favorites' : 'Added to favorites',
      description: isFavorite 
        ? 'The listing has been removed from your favorites'
        : 'The listing has been added to your favorites',
    });
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
    router.push(`/checkout/${mockListing.id}`);
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
    router.push(`/inbox/new?listingId=${mockListing.id}`);
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
    router.push(`/inbox/new?listingId=${mockListing.id}&action=offer`);
  };

  const handleReport = () => {
    // Redirect to report page
    router.push(`/report?listingId=${mockListing.id}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="aspect-square rounded-lg" />
            <div className="space-y-6">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-12 w-1/2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {error}
        </h1>
        <Button onClick={() => router.push('/explore')}>
          Back to Explore
        </Button>
      </div>
    );
  }

  const isOwner = publicKey?.toBase58() === listing.sellerId;

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
                <p className="mt-1 text-sm text-gray-500">
                  {listing.category}
                  {listing.brand && ` • ${listing.brand}`}
                </p>
              </div>
              {isOwner ? (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/listings/${mockListing.id}/edit`)}
                >
                  Edit Listing
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleFavorite}
                  className={`!border-[hsl(222.2,84%,4.9%)] dark:!border-[#ffffff] ${isFavorite ? 'text-[#800808]' : ''} transition-transform active:scale-90`}
                >
                  <Heart 
                    className={`h-5 w-5 transition-transform ${isFavorite ? 'scale-110' : 'scale-100'}`} 
                    fill={isFavorite ? '#800808' : 'none'} 
                  />
                </Button>
              )}
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

              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-600 font-medium">Additional fees at checkout:</p>
                
                {listing.postalService && (
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>Shipping fee:</span>
                    <span>{listing.deliveryPrice.toFixed(6)} SOL</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>Protection fee (1.8%):</span>
                  <span>{(listing.price * 0.018).toFixed(6)} SOL</span>
                </div>
              </div>
            </div>

            {/* Delivery Options */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-900">
                Delivery Options
              </h3>
              <div className="mt-2 space-y-1 text-sm text-gray-500">
                {listing.noDelivery && <p>• No delivery available</p>}
                {listing.handDelivery && <p>• Hand delivery available</p>}
                {listing.postalService && (
                  <p>• Postal service available ({listing.deliveryPrice.toFixed(6)} SOL)</p>
                )}
              </div>
            </div>

            {/* Seller Info */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">
                      {listing.seller.username?.[0]?.toUpperCase() || 'A'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {listing.seller.username || 'Anon'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Listed {formatDate(listing.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    onClick={() => router.push(`/report/${mockListing.id}`)}
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
            {!isOwner && (
              <div className="border-t border-gray-200 pt-6 space-y-4">
                {!listing.sold && (
                  <>
                    <Button
                      className="w-full !bg-[#0a4614] !text-[#ffffff] hover:!bg-[#0a4614]/90 !border-0"
                      size="lg"
                      onClick={handleBuy}
                    >
                      Buy Now
                    </Button>
                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        variant="outline"
                        onClick={handleMakeOffer}
                        className="!border-[hsl(222.2,84%,4.9%)] dark:!border-[#ffffff]"
                      >
                        Make Offer
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleMessage}
                        className="!border-[hsl(222.2,84%,4.9%)] dark:!border-[#ffffff]"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Message Seller
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
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
