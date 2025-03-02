export interface DeliveryOptions {
  noDelivery: boolean;
  handDelivery: boolean;
  postalService: boolean;
  deliveryPrice: number;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  currency?: string;
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
  media: MediaFile[];
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
import { MediaFile, MediaType, MediaProcessingStatus } from './media';

export const DeliveryOptionsSchema = z.object({
  noDelivery: z.boolean(),
  handDelivery: z.boolean(),
  postalService: z.boolean(),
  deliveryPrice: z.number().min(0)
});

export const MediaFileSchema = z.object({
  id: z.string().optional(),
  url: z.string().optional(),
  filename: z.string(),
  type: z.nativeEnum(MediaType),
  order: z.number(),
  isMain: z.boolean().optional(),
  thumbnailUrl: z.string().optional(),
  status: z.nativeEnum(MediaProcessingStatus).optional(),
});

export const ListingSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required").max(40, "Title must be 40 characters or less"),
  description: z.string().min(1, "Description is required").max(500, "Description must be 500 characters or less"),
  price: z.number().min(0.00001, "Price must be at least 0.00001").max(2000000, "Price cannot exceed 2,000,000"),
  currency: z.string().optional().default('USD'),
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
  media: z.array(MediaFileSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string()
});
