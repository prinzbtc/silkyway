export interface MessageAttachment {
  url: string;
  type: string;
  size: number;
}

export interface Message {
  id: string;
  content: string;
  createdAt: Date;
  senderId: string;
  receiverId: string;
  conversationId: string;
  read: boolean;
  type?: 'transaction_notification';
  attachments?: MessageAttachment[];
  metadata?: {
    type: 'buyer' | 'seller' | 'buyerCancel' | 'sellerCancel';
    listingTitle: string;
    counterpartyUsername: string;
    transactionId: string;
  };
  sender: {
    id: string;
    username: string | null;
    avatar: string | null;
  };
  receiver: {
    id: string;
    username: string | null;
    avatar: string | null;
  };
}
