import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { redis, getCacheKey } from '@/lib/redis';
import type { SessionData } from '@/types/session';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const id = params.id;

    // Check if listing exists
    const listing = await prisma.listing.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Toggle favorite
    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_listingId: {
          userId: session.user.id,
          listingId: id,
        },
      },
    });

    if (favorite) {
      // Remove favorite
      await prisma.favorite.delete({
        where: {
          userId_listingId: {
            userId: session.user.id,
            listingId: id,
          },
        },
      });
    } else {
      // Add favorite
      await prisma.favorite.create({
        data: {
          userId: session.user.id,
          listingId: id,
        },
      });
    }

    // Clear cache
    await redis.del(getCacheKey.listing(id));
    await redis.del(getCacheKey.userFavorites(session.user.id));
    await redis.del(getCacheKey.recommendedListings(session.user.id, 10));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return NextResponse.json(
      { error: 'Failed to toggle favorite' },
      { status: 500 }
    );
  }
}
