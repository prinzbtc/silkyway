export interface DeliveryOptions {
  noDelivery: boolean;
  handDelivery: boolean;
  postalService: boolean;
  deliveryPrice: number;
}

export interface ListingImage {
  id: string;
  url: string;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  brand?: string;
  condition: string;
  status: 'active' | 'sold' | 'deleted';
  featured?: boolean;
  deliveryOptions: {
    noDelivery: boolean;
    handDelivery: boolean;
    postalService: boolean;
    deliveryPrice: number;
  };
  images: ListingImage[];
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface ListingWithUser extends Listing {
  user: {
    id: string;
    username: string | null;
    avatar: string | null;
    walletAddress: string;
  };
}

export interface ListingWithFavorite extends ListingWithUser {
  isFavorite: boolean;
  favoritesCount: number;
}

// Zod schema for runtime validation (optional, but recommended)
import { z } from 'zod';
import { BRAND_CATEGORIES } from '@/lib/brands';
import { categories } from '@/lib/categories';

export const DeliveryOptionsSchema = z.object({
  noDelivery: z.boolean(),
  handDelivery: z.boolean(),
  postalService: z.boolean(),
  deliveryPrice: z.number().min(0)
});

export const ListingSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required").max(40, "Title must be 40 characters or less"),
  description: z.string().min(1, "Description is required").max(500, "Description must be 500 characters or less"),
  price: z.number().min(0.00001, "Price must be at least 0.00001 SOL").max(2000000, "Price cannot exceed 2,000,000 SOL"),
  category: z.enum(categories.map(cat => cat.value) as [string, ...string[]]),
  brand: z.enum(Object.values(BRAND_CATEGORIES).flat() as [string, ...string[]]).optional(),
  condition: z.string(),
  status: z.enum(['active', 'sold', 'deleted']),
  featured: z.boolean().optional(),
  deliveryOptions: z.object({
    noDelivery: z.boolean(),
    handDelivery: z.boolean(),
    postalService: z.boolean(),
    deliveryPrice: z.number().min(0)
  }),
  images: z.array(z.object({
    id: z.string(),
    url: z.string()
  })),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string()
});
