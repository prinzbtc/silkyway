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
  userListings: (userId: string, limit: number, cursor?: string) =>
    `listings:user:${userId}:${limit}${cursor ? `:${cursor}` : ''}`,
  filteredListings: (filters: Record<string, any>, limit: number, cursor?: string) => {
    // Create a stable string representation of the filters
    const filterKeys = Object.keys(filters).sort();
    const filterString = filterKeys
      .map(key => `${key}:${JSON.stringify(filters[key])}`)
      .join('_');
    
    return `listings:filtered:${filterString}:${limit}${cursor ? `:${cursor}` : ''}`;
  },
};

// Invalidate cache for specific listing types
export async function invalidateListingsCache(type?: 'featured' | 'latest' | 'all') {
  try {
    console.log(`Invalidating cache for listing type: ${type || 'all'}`);
    
    // Get all listing-related keys
    const keys = await redis.keys('listings:*');
    console.log(`Found ${keys.length} listing cache keys`);
    
    // Filter keys based on type
    const keysToDelete = type && type !== 'all'
      ? keys.filter(key => key.startsWith(`listings:${type}`))
      : keys;
    
    if (keysToDelete.length > 0) {
      console.log(`Deleting ${keysToDelete.length} cache keys: ${keysToDelete.join(', ')}`);
      await redis.del(...keysToDelete);
      console.log('Cache keys deleted successfully');
    } else {
      console.log('No cache keys to delete');
    }
    
    // Also invalidate filtered listings caches
    const filteredKeys = await redis.keys('listings:filtered:*');
    if (filteredKeys.length > 0) {
      console.log(`Deleting ${filteredKeys.length} filtered listing cache keys`);
      await redis.del(...filteredKeys);
    }
    
    // Also invalidate user listings caches
    const userListingsKeys = await redis.keys('*user*listings*');
    if (userListingsKeys.length > 0) {
      console.log(`Deleting ${userListingsKeys.length} user listings cache keys`);
      await redis.del(...userListingsKeys);
    }
    
    // Also invalidate dashboard caches when invalidating all or latest listings
    if (type === 'all' || type === 'latest' || !type) {
      const dashboardKeys = await redis.keys('dashboard:*');
      if (dashboardKeys.length > 0) {
        console.log(`Also deleting ${dashboardKeys.length} dashboard cache keys`);
        await redis.del(...dashboardKeys);
      }
    }
  } catch (error) {
    console.error('Error invalidating listing caches:', error);
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
