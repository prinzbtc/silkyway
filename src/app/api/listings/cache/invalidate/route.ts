import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { 
  invalidateListingsCache, 
  invalidateUserRecommendations,
  invalidateUserFavorites 
} from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { type, userId } = await request.json();

    switch (type) {
      case 'featured':
      case 'latest':
      case 'all':
        // Only admins can invalidate global caches
        if (!session.user.isAdmin) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }
        await invalidateListingsCache(type === 'all' ? undefined : type);
        break;

      case 'recommended':
        // Users can only invalidate their own recommendations
        if (!userId || userId !== session.user.id) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }
        await invalidateUserRecommendations(userId);
        break;

      case 'favorites':
        // Users can only invalidate their own favorites
        if (!userId || userId !== session.user.id) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }
        await invalidateUserFavorites(userId);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid cache type' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error invalidating cache:', error);
    return NextResponse.json(
      { error: 'Failed to invalidate cache' },
      { status: 500 }
    );
  }
}
