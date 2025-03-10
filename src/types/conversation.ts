/**
 * This file re-exports types from chat.ts to maintain backward compatibility
 * while ensuring type consistency across the messaging system.
 */

import {
  Message as ChatMessage,
  ChatUser,
  ChatOffer,
  ChatListing,
  Conversation as ChatConversation,
} from './chat';

/**
 * @deprecated Use ChatUser from chat.ts instead
 */
export interface User extends ChatUser {}

/**
 * @deprecated Use Message from chat.ts instead
 */
export interface Message extends ChatMessage {}

/**
 * @deprecated Use ChatOffer from chat.ts instead
 */
export interface Offer extends ChatOffer {
  // Maintain backward compatibility by restricting status options
  status: 'pending' | 'accepted' | 'rejected';
}

/**
 * @deprecated Use ChatListing from chat.ts instead
 */
export interface Listing extends ChatListing {}

/**
 * Represents a conversation with additional UI-specific properties
 * @deprecated Consider using Conversation from chat.ts directly
 */
export interface Conversation {
  id: string;
  otherUser: User;
  messages: Message[];
  unreadCount: number;
  updatedAt: string; // Made required since we use it in sorting
  _count: { // Made required since we use it in sorting and display
    messages: number;
  };
  offers: Offer[];
  listing: Listing;
  buyer: User;
}
