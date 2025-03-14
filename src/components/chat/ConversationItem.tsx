'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { format, isToday, isYesterday } from 'date-fns';
import { Conversation } from '@/types/chat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { usePrice } from '@/hooks/usePrice';
import { normalizeCurrency, formatPrice } from '@/lib/price';

interface ConversationItemProps {
  conversation: Conversation & {
    // CRITICAL FIX: Add custom properties for UI state management
    _forceHideBadge?: boolean;
    _version?: number;
    lastUpdateTimestamp?: number;
  };
  isActive: boolean;
  onClick: () => void;
  currentUserId: string;
}

export default function ConversationItem({
  conversation,
  isActive,
  onClick,
  currentUserId
}: ConversationItemProps) {
  const { preferredCurrency } = usePrice(0, 'USD');
  const [counterparty, setCounterparty] = useState<{
    id: string;
    username: string | null;
    avatar: string | null;
  } | null>(null);

  // Determine if the current user is the buyer or seller
  useEffect(() => {
    if (conversation.buyerId === currentUserId) {
      setCounterparty(conversation.seller);
    } else {
      setCounterparty(conversation.buyer);
    }
  }, [conversation, currentUserId]);

  // Format the date for the last message
  const formatDate = (date: Date) => {
    if (isToday(date)) {
      return format(date, 'h:mm a');
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM d');
    }
  };

  // Get the last message time
  const lastMessageTime = conversation.messages?.length > 0
    ? new Date(conversation.messages[conversation.messages.length - 1].createdAt)
    : conversation.updatedAt;

  // Get the last message content
  const lastMessage = conversation.messages?.length > 0
    ? conversation.messages[conversation.messages.length - 1].content
    : 'No messages yet';

  // Check if the last message was sent by the current user
  const lastMessageSentByCurrentUser = conversation.messages?.length > 0
    ? conversation.messages[conversation.messages.length - 1].senderId === currentUserId
    : false;

  // Format the listing price
  const listingPrice = conversation.listing?.price || 0;
  const listingCurrency = normalizeCurrency(conversation.listing?.currency || 'USD');
  const formattedPrice = formatPrice(listingPrice, listingCurrency);

  // Get the listing image
  const listingImage = conversation.listing?.media?.find(m => m.isMainMedia)?.url || 
                      conversation.listing?.media?.[0]?.url || 
                      '/placeholder-image.jpg';

  return (
    <div 
      className={`flex items-start p-4 border-b border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors ${
        isActive ? 'bg-gray-100 dark:bg-gray-800' : ''
      }`}
      onClick={onClick}
    >
      <Avatar className="h-12 w-12 mr-3 flex-shrink-0">
        {counterparty?.avatar ? (
          <AvatarImage src={counterparty.avatar} alt={counterparty?.username || 'User'} />
        ) : null}
        <AvatarFallback>
          {counterparty?.username?.substring(0, 2).toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <h3 className="font-medium truncate">
            {counterparty?.username || 'Unknown User'}
          </h3>
          <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
            {formatDate(lastMessageTime)}
          </span>
        </div>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {lastMessageSentByCurrentUser ? 'You: ' : ''}{lastMessage}
        </p>
        
        <div className="flex items-center mt-1">
          {conversation.listing && (
            <div className="flex items-center">
              <div className="relative h-6 w-6 mr-1 rounded overflow-hidden">
                <Image
                  src={listingImage}
                  alt={conversation.listing.title || 'Listing'}
                  fill
                  className="object-cover"
                />
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400 truncate mr-2">
                {conversation.listing.title}
              </span>
              <span className="text-xs font-medium">
                {formattedPrice}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {(conversation.unreadCount ?? 0) > 0 && (
        <Badge 
          variant="default" 
          className="ml-2 bg-primary hover:bg-primary"
        >
          {conversation.unreadCount}
        </Badge>
      )}
    </div>
  );
}
