export interface Message {
  id: string;
  content: string;
  createdAt: Date;
  read: boolean;
  senderId: string;
  receiverId: string;
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

export interface User {
  id: string;
  username: string | null;
  avatar: string | null;
}

export interface Offer {
  id: string;
  amount: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  senderId: string;
  receiverId: string;
}

export interface Listing {
  id: string;
  title: string;
  price: number;
  images: string[];
  mainImage: string;
  user: User;
}

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
