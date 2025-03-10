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
  
  // Ensure we have valid data for display
  const listingTitle = listing?.title || 'Untitled Listing';
  
  // Get the main media URL from the listing's media array
  let listingImage = '/placeholder-image.jpg';
  if (listing?.media && listing.media.length > 0 && listing.media[0].url) {
    listingImage = listing.media[0].url;
  } else if (listing?.mainImage) {
    // Fallback to mainImage if available (for backward compatibility)
    listingImage = listing.mainImage;
  }
  
  // Extract price and currency information
  const listingPrice = typeof listing?.price === 'number' ? listing.price : 0;
  const listingCurrency = normalizeCurrency(listing?.currency || 'USD');
  
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
