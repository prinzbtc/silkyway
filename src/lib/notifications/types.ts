export type NotificationType =
  | 'sale'
  | 'new_offer'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'new_message'
  | 'item_shipped'
  | 'item_delivered'
  | 'favorite_sold'
  | 'blog_update'
  | 'changelog';

export type NotificationPreferences = {
  inApp: {
    enabled: boolean;
    types: NotificationType[];
  };
  email: {
    marketplace: boolean;
    updates: boolean;
    types: NotificationType[];
  };
};

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;  // From database schema
  message?: string; // For backward compatibility
  link?: string;    // Virtual field, not in database
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any> | string; // Can be string if stored as JSON
}
