import { Redis } from '@upstash/redis';

// Create Redis Client
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Cache TTL in seconds
export const CACHE_TTL = {
  FEATURED_LISTINGS: 5 * 60, // 5 minutes
  LATEST_LISTINGS: 2 * 60, // 2 minutes
  RECOMMENDED_LISTINGS: 5 * 60, // 5 minutes
  USER_FAVORITES: 5 * 60, // 5 minutes
  LISTING: 5 * 60, // 5 minutes
};

// Cache keys
export const getCacheKey = {
  listing: (id: string) => `listing:${id}`,
  featuredListings: (limit: number, cursor?: string) =>
    `listings:featured:${limit}${cursor ? `:${cursor}` : ''}`,
  latestListings: (limit: number, cursor?: string) =>
    `listings:latest:${limit}${cursor ? `:${cursor}` : ''}`,
  recommendedListings: (userId: string, limit: number, cursor?: string) =>
    `listings:recommended:${userId}:${limit}${cursor ? `:${cursor}` : ''}`,
  userFavorites: (userId: string) => `user:${userId}:favorites`,
};

// Invalidate cache for specific listing types
export async function invalidateListingsCache(type?: 'featured' | 'latest' | 'all') {
  const keys = await redis.keys('listings:*');
  
  const keysToDelete = type
    ? keys.filter(key => key.startsWith(`listings:${type}`))
    : keys;
  
  if (keysToDelete.length > 0) {
    await redis.del(...keysToDelete);
  }
}

// Invalidate user's recommended listings cache
export async function invalidateUserRecommendations(userId: string) {
  const keys = await redis.keys(`listings:recommended:${userId}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Invalidate user's favorites cache
export async function invalidateUserFavorites(userId: string) {
  await redis.del(getCacheKey.userFavorites(userId));
}
