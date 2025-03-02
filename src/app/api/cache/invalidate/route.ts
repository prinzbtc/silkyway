import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { invalidateListingsCache, redis, invalidateUserRecommendations, invalidateUserFavorites } from '@/lib/redis';
import type { SessionData } from '@/app/api/auth/session/route';

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getSession(req);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the type of cache to invalidate and any additional parameters from the request body
    const { type, userId } = await req.json();
    
    console.log(`Cache invalidation requested for type: ${type || 'all'}, userId: ${userId || session.user.id}`);
    
    // Determine which invalidation function to use based on type
    switch (type) {
      case 'all':
      case 'latest':
      case 'featured':
        await invalidateListingsCache(type);
        break;
      case 'user':
        // Invalidate all caches related to the specified user or current user
        const targetUserId = userId || session.user.id;
        const userKeys = await redis.keys(`*${targetUserId}*`);
        if (userKeys.length > 0) {
          console.log(`Invalidating ${userKeys.length} user-specific cache keys`);
          await redis.del(...userKeys);
        }
        break;
      case 'recommendations':
        // Invalidate recommendations for the specified user or current user
        await invalidateUserRecommendations(userId || session.user.id);
        break;
      case 'favorites':
        // Invalidate favorites for the specified user or current user
        await invalidateUserFavorites(userId || session.user.id);
        break;
      default:
        // Default to invalidating all caches
        await invalidateListingsCache('all');
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error invalidating cache:', error);
    return NextResponse.json({ error: 'Failed to invalidate cache' }, { status: 500 });
  }
}
