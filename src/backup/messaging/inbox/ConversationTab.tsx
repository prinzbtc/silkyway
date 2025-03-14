'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { normalizeCurrency } from '@/lib/price';
import { usePrice } from '@/hooks/usePrice';
import type { Conversation } from '@/types/conversation';
import type { Conversation as DbConversation, ChatUser, ChatListing } from '@/types/chat';

// Define a union type to handle both conversation formats
type AnyConversation = Conversation | DbConversation;

interface ConversationTabProps {
  conversation: AnyConversation;
  isSelected: boolean;
  hasUnread: boolean;
  userId: string;
  onSelect: () => void;
}

export default function ConversationTab({
  conversation,
  isSelected,
  hasUnread,
  userId,
  onSelect,
}: ConversationTabProps) {
  // Extract the other user (seller or buyer depending on the conversation context)
  let otherUser: ChatUser | null = null;
  
  // Extract listing information
  let listing: ChatListing | null = null;
  
  // Handle database-format conversations (from new conversation route)
  if ('buyer' in conversation && 'seller' in conversation) {
    // Determine if the current user is the buyer or seller
    const isBuyer = conversation.buyer?.id === userId;
    
    // Set the other user based on the conversation context
    otherUser = isBuyer ? conversation.seller : conversation.buyer;
    
    // Get the listing from the conversation
    if (conversation.listing) {
      listing = conversation.listing;
    }
  } 
  // Handle constructed-format conversations (from inbox page)
  else if ('otherUser' in conversation) {
    otherUser = conversation.otherUser;
    
    if (conversation.listing) {
      listing = conversation.listing;
    }
  }
  
  // Enhanced listing data handling with robust fallbacks
  
  // Ensure we have valid data for display
  const listingTitle = listing?.title || 'Untitled Listing';
  
  // Get the main media URL from the listing's media array with improved handling
  let listingImage = '/placeholder-image.jpg';
  
  // Log detailed listing information for debugging
  const mediaType = listing?.media 
    ? (Array.isArray(listing.media) ? 'array' : typeof listing.media) 
    : 'undefined';
    
  const mediaLength = listing?.media && Array.isArray(listing.media) 
    ? listing.media.length 
    : 0;
    
  const hasMainImage = listing ? Boolean(listing.mainImage) : false;
  
  // Get conversation ID for debugging
  const conversationId = 'id' in conversation ? conversation.id : 'unknown';
    
  console.log(`ConversationTab [${conversationId}] - Listing data:`, {
    id: listing?.id ?? 'no-id',
    title: listing?.title ?? 'Untitled',
    price: listing?.price ?? 0,
    currency: listing?.currency ?? 'USD',
    mediaType,
    mediaLength,
    hasMainImage,
    rawListing: listing // Log the entire listing object for debugging
  });
  
  // Robust media extraction with multiple fallback strategies
  if (listing?.media) {
    // First attempt: Handle standard media array with objects containing url
    if (Array.isArray(listing.media) && listing.media.length > 0) {
      const firstMedia = listing.media[0];
      
      // Case 1: Media is an object with url property
      if (typeof firstMedia === 'object' && firstMedia !== null) {
        if (firstMedia.url) {
          listingImage = firstMedia.url;
          console.log('Using media object URL:', firstMedia.url);
        } else if ('thumbnail' in firstMedia && firstMedia.thumbnail) {
          listingImage = (firstMedia as any).thumbnail;
          console.log('Using media thumbnail URL:', (firstMedia as any).thumbnail);
        } else if ('src' in firstMedia && (firstMedia as any).src) {
          // Some APIs return src instead of url
          listingImage = (firstMedia as any).src;
          console.log('Using media src URL:', (firstMedia as any).src);
        }
      } 
      // Case 2: Media is a string URL directly
      else if (typeof firstMedia === 'string') {
        listingImage = firstMedia;
        console.log('Using media string URL:', firstMedia);
      }
    } 
    // Second attempt: Handle case where media might be a single object
    else if (typeof listing.media === 'object' && listing.media !== null) {
      const mediaObj = listing.media as any;
      if (mediaObj.url) {
        listingImage = mediaObj.url;
        console.log('Using single media object URL:', mediaObj.url);
      }
    }
    // Third attempt: Handle case where media might be a string
    else if (typeof listing.media === 'string') {
      listingImage = listing.media;
      console.log('Using media string:', listing.media);
    }
  }
  
  // Fallback strategies if media extraction failed
  if (listingImage === '/placeholder-image.jpg') {
    // Try mainImage property
    if (listing?.mainImage) {
      listingImage = listing.mainImage;
      console.log('Using mainImage fallback:', listing.mainImage);
    }
    // Try thumbnail property if it exists (using type assertion for optional properties)
    else if (listing && 'thumbnail' in listing && (listing as any).thumbnail) {
      listingImage = (listing as any).thumbnail as string;
      console.log('Using thumbnail fallback:', (listing as any).thumbnail);
    }
  }
  
  // Make sure the image URL is absolute and valid
  if (listingImage && typeof listingImage === 'string') {
    if (!listingImage.startsWith('http') && !listingImage.startsWith('/')) {
      listingImage = `/${listingImage}`;
    }
    
    // Ensure the URL doesn't contain 'null' or 'undefined' strings which can happen with template literals
    if (listingImage.includes('null') || listingImage.includes('undefined')) {
      console.warn('Invalid image URL detected, using placeholder instead:', listingImage);
      listingImage = '/placeholder-image.jpg';
    }
  } else {
    // Reset to placeholder if listingImage is not a valid string
    listingImage = '/placeholder-image.jpg';
  }
  
  console.log('Final processed listing image URL:', listingImage);
  
  // Extract price and currency information
  const listingPrice = typeof listing?.price === 'number' ? listing.price : 
                      typeof listing?.price === 'string' ? parseFloat(listing.price) : 0;
  const listingCurrency = normalizeCurrency(listing?.currency || 'USD');
  
  console.log('Processed listing data:', {
    title: listingTitle,
    image: listingImage,
    price: listingPrice,
    currency: listingCurrency
  });
  
  // Use the price hook for standardized currency handling
  const { 
    formattedOriginal,
    formattedPreferred,
    formattedSol,
    originalCurrency,
    preferredCurrency,
    isPreferredLoading,
    isSolLoading
  } = usePrice(listingPrice, listingCurrency);

  return (
    <div className={cn(
      'w-full border-b',
      isSelected && 'bg-accent',
      hasUnread && 'font-medium'
    )}>
      <button
        className="flex w-full items-start p-3 text-left transition hover:bg-accent/50"
        onClick={onSelect}
      >
        {/* Listing Image */}
        <div className="relative h-16 w-16 shrink-0 mr-3">
          <Image
            src={listingImage}
            alt={listingTitle}
            fill
            className="rounded-md object-cover"
            sizes="64px"
          />
        </div>
        
        <div className="min-w-0 flex-1">
          {/* Listing Title */}
          <div className="line-clamp-1 font-medium">
            {listingTitle}
          </div>
          
          {/* Price Information */}
          <div className="mt-1">
            {/* Main price display - always show in user's preferred currency */}
            <div className="text-sm font-medium">
              {originalCurrency === preferredCurrency ? (
                formattedOriginal
              ) : isPreferredLoading ? (
                <span>
                  {formattedOriginal} <span className="text-xs font-normal text-gray-500">(converting...)</span>
                </span>
              ) : (
                formattedPreferred
              )}
            </div>
            
            {/* SOL equivalent */}
            <div className="text-xs text-gray-500">
              {isSolLoading 
                ? 'Converting to SOL...' 
                : formattedSol}
            </div>
          </div>
          
          {/* Seller information */}
          {otherUser && (
            <div className="flex items-center space-x-1 mt-1">
              <div className="relative w-4 h-4 rounded-full overflow-hidden bg-gray-200">
                {otherUser.avatar && (
                  <Image
                    src={otherUser.avatar}
                    alt={otherUser.username || 'User avatar'}
                    fill
                    className="object-cover"
                    sizes="16px"
                  />
                )}
              </div>
              <span className="text-xs text-gray-600">
                {otherUser.username || (otherUser.id && otherUser.id.slice(0, 8))}
              </span>
            </div>
          )}
        </div>
        
        {/* Unread Indicator */}
        {hasUnread && (
          <div className="h-2 w-2 rounded-full bg-primary ml-2" />
        )}
      </button>
    </div>
  );
}
