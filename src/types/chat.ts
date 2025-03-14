/**
 * Types for the messaging system
 * These types align with the Prisma schema and are used across all messaging components
 */

/**
 * Represents a file attachment in a message (image, document, etc.)
 */
export interface MessageAttachment {
  id: string;
  url: string;
  type: string; // MIME type (e.g., 'image/jpeg', 'application/pdf')
  size: number; // File size in bytes
  name: string; // Filename
  file?: File; // Optional File object (client-side only)
  isVirusDetected?: boolean; // Flag for virus detection
}

/**
 * Represents a user in the messaging context with minimal required fields
 */
export interface ChatUser {
  id: string;
  username: string | null;
  avatar: string | null;
}

/**
 * Metadata for transaction notification messages
 */
export interface TransactionNotificationMetadata {
  type: 'buyer' | 'seller' | 'buyerCancel' | 'sellerCancel';
  listingTitle: string;
  counterpartyUsername: string;
  transactionId: string;
}

/**
 * Represents a message in a conversation
 */
export interface Message {
  id: string;
  content: string;
  createdAt: Date;
  senderId: string;
  receiverId: string;
  conversationId: string;
  read: boolean;
  type?: 'transaction_notification' | 'system';
  attachments?: MessageAttachment[];
  metadata?: TransactionNotificationMetadata;
  sender: ChatUser;
  receiver: ChatUser;
}

/**
 * Represents an offer in the context of a conversation
 */
export interface ChatOffer {
  id: string;
  amount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: Date;
  senderId: string;
  receiverId: string;
  listingId: string;
}

/**
 * Represents a listing media item
 */
export interface ChatListingMedia {
  id: string;
  url: string;
  type: string;
  isMainMedia?: boolean;
}

/**
 * Represents a listing in the context of a conversation
 */
export interface ChatListing {
  id: string;
  title: string;
  price: number;
  currency?: string;
  images?: string[];
  mainImage?: string;
  media?: ChatListingMedia[];
  user: ChatUser;
}

/**
 * Represents a conversation between two users
 */
export interface Conversation {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  buyerId: string;
  sellerId: string;
  buyer: ChatUser;
  seller: ChatUser;
  messages: Message[];
  unreadCount?: number;
  _count?: {
    messages: number;
  };
  offers?: ChatOffer[];
  listing?: ChatListing;
}

/**
 * A standardized conversation type that unifies all the necessary properties
 * for consistent use across components and APIs
 */
export interface UnifiedConversation {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  buyerId: string;
  sellerId: string;
  buyer: {
    id: string;
    username: string;
    avatar: string;
  };
  seller: {
    id: string;
    username: string;
    avatar: string;
  };
  listing: {
    id: string;
    title: string;
    price: number;
    currency: string;
    media: Array<{
      id: string;
      url: string;
      type: string;
    }>;
    mainImage: string | null;
    status: string;
    description: string;
    category: string;
    user: {
      id: string;
      username: string;
      avatar: string;
    };
  };
  messages: Array<Message>;
  unreadCount: number;
  _count: {
    messages: number;
  };
  offers: Array<ChatOffer>;
  lastMessageAt?: Date;
}

/**
 * Input for sending a new message
 */
export interface SendMessageInput {
  content: string;
  attachments?: MessageAttachment[];
  tempId?: string; // Temporary ID for optimistic UI updates
}

/**
 * Input for creating a new offer
 */
export interface CreateOfferInput {
  amount: number;
  listingId: string;
  receiverId: string;
}
