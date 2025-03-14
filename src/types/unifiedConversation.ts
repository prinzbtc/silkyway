/**
 * UnifiedConversation type definition
 * This type standardizes the conversation structure across the application
 */

import { ChatUser, Message, ChatOffer, ChatListing } from './chat';
import { User } from './user';
import { Listing, ListingWithUser } from './listing';

/**
 * A standardized conversation type that unifies all the necessary properties
 * for consistent use across components and APIs
 */
// Create a common user type that's compatible with both User and ChatUser
type CommonUser = {
  id: string;
  username: string | null;
  avatar?: string | null;
};

export interface UnifiedConversation {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  buyerId: string;
  sellerId: string;
  buyer: CommonUser;
  seller: CommonUser;
  listing?: Listing | ListingWithUser | ChatListing;
  messages: Message[];
  unreadCount: number;
  _count: {
    messages: number;
  };
  offers: ChatOffer[];
  lastMessageAt: Date;
  // Optional fields to maintain compatibility with other conversation types
  otherUser?: CommonUser;
}

/**
 * Type guard to check if an object is a UnifiedConversation
 */
export function isUnifiedConversation(obj: any): obj is UnifiedConversation {
  return obj && 'lastMessageAt' in obj;
}
