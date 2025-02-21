import { ListingWithFavorite } from './listing';
import { User } from './user';

export type TransactionStatus =
  | 'pending'
  | 'awaiting_tracking'
  | 'shipped'
  | 'awaiting_confirmation'
  | 'completed'
  | 'cancelled';

export type TransactionBadge = {
  label: string;
  variant: 'default' | 'primary' | 'secondary' | 'destructive' | 'outline';
};

export interface Transaction {
  id: string;
  listingId: string;
  listing: ListingWithFavorite;
  buyerId: string;
  buyer: User;
  sellerId: string;
  seller: User;
  amount: number;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
  protectionFee: number;
  shippingFee: number;
  escrowAddress: string;
  signature: string;
  trackingNumber?: string;
  cancelledAt?: string;
  reviewId?: string;
}
