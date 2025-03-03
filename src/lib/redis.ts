import { Redis } from '@upstash/redis';

// Check if Redis environment variables are set
const hasRedisConfig = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

// Create a mock Redis client if environment variables are not set
class MockRedis {
  private cache = new Map<string, any>();

  async get<T>(key: string): Promise<T | null> {
    console.log('[MockRedis] GET', key);
    return this.cache.get(key) || null;
  }

  async set(key: string, value: any, options?: { ex?: number }): Promise<string> {
    console.log('[MockRedis] SET', key, options);
    this.cache.set(key, value);
    
    // If expiration is set, create a timeout to delete the key
    if (options?.ex) {
      const expiryMs = options.ex * 1000;
      setTimeout(() => {
        console.log(`[MockRedis] Expiring key: ${key}`);
        this.cache.delete(key);
      }, expiryMs);
    }
    
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    console.log('[MockRedis] DEL', keys);
    let count = 0;
    for (const key of keys) {
      if (this.cache.delete(key)) count++;
    }
    return count;
  }
  
  async keys(pattern: string): Promise<string[]> {
    console.log('[MockRedis] KEYS', pattern);
    const result: string[] = [];
    
    // Convert Redis pattern to JavaScript RegExp
    // Replace * with .* and escape other special characters
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special characters
      .replace(/\*/g, '.*'); // Replace * with .*
    
    const regex = new RegExp(`^${regexPattern}$`);
    
    // Filter keys that match the pattern
    // Convert IterableIterator to Array for compatibility with older TypeScript targets
    const cacheKeys = Array.from(this.cache.keys());
    for (const key of cacheKeys) {
      if (regex.test(key)) {
        result.push(key);
      }
    }
    
    return result;
  }
}

// Define a common interface for Redis and MockRedis
interface RedisClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, options?: { ex?: number }): Promise<string>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}

// Create Redis Client or use mock if not configured
let redisClient: RedisClient;

try {
  if (!hasRedisConfig) {
    console.warn('Redis configuration not found. Using in-memory mock Redis client.');
    redisClient = new MockRedis();
  } else {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    }) as unknown as RedisClient;
    console.log('Redis client initialized successfully');
  }
} catch (error) {
  console.error('Failed to initialize Redis client:', error);
  console.warn('Falling back to in-memory mock Redis client');
  redisClient = new MockRedis();
}

export const redis = redisClient;

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
      ? keys.filter((key: string) => key.startsWith(`listings:${type}`))
      : keys;
    
    if (keysToDelete.length > 0) {
      console.log(`Deleting ${keysToDelete.length} cache keys: ${keysToDelete.join(', ')}`);
      await redis.del(...keysToDelete as string[]);
      console.log('Cache keys deleted successfully');
    } else {
      console.log('No cache keys to delete');
    }
    
    // Also invalidate filtered listings caches
    const filteredKeys = await redis.keys('listings:filtered:*');
    if (filteredKeys.length > 0) {
      console.log(`Deleting ${filteredKeys.length} filtered listing cache keys`);
      await redis.del(...filteredKeys as string[]);
    }
    
    // Also invalidate user listings caches
    const userListingsKeys = await redis.keys('*user*listings*');
    if (userListingsKeys.length > 0) {
      console.log(`Deleting ${userListingsKeys.length} user listings cache keys`);
      await redis.del(...userListingsKeys as string[]);
    }
    
    // Also invalidate dashboard caches when invalidating all or latest listings
    if (type === 'all' || type === 'latest' || !type) {
      const dashboardKeys = await redis.keys('dashboard:*');
      if (dashboardKeys.length > 0) {
        console.log(`Also deleting ${dashboardKeys.length} dashboard cache keys`);
        await redis.del(...dashboardKeys as string[]);
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
    await redis.del(...keys as string[]);
  }
}

// Invalidate user's favorites cache
export async function invalidateUserFavorites(userId: string) {
  await redis.del(getCacheKey.userFavorites(userId));
}
