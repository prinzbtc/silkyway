import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { CACHE_TAGS } from '@/lib/cache/tags';

// GET /api/user/favorites/[listingId]/status - Check if listing is favorited
export async function GET(
  req: Request,
  { params }: { params: { listingId: string } }
) {
  try {
    // Get session and params concurrently
    const [session, { listingId }] = await Promise.all([
      getSession(req),
      Promise.resolve(params)
    ]);

    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_listingId: {
          userId: session.user.id,
          listingId
        }
      }
    });

    return NextResponse.json({ isFavorited: !!favorite });
  } catch (error) {
    console.error('Error checking favorite status:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// POST /api/user/favorites/[listingId] - Toggle favorite status
export async function POST(
  req: Request,
  { params }: { params: { listingId: string } }
) {
  try {
    // Get session and params concurrently
    const [session, { listingId }] = await Promise.all([
      getSession(req),
      Promise.resolve(params)
    ]);

    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Check if listing exists
    const listing = await prisma.listing.findUnique({
      where: { id: listingId }
    });

    if (!listing) {
      return new NextResponse('Listing not found', { status: 404 });
    }

    // Check if already favorited
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_listingId: {
          userId: session.user.id,
          listingId
        }
      }
    });

    let isFavorited;
    if (existingFavorite) {
      // Remove favorite
      await prisma.favorite.delete({
        where: {
          id: existingFavorite.id
        }
      });
      isFavorited = false;
    } else {
      // Add favorite
      await prisma.favorite.create({
        data: {
          userId: session.user.id,
          listingId
        }
      });
      isFavorited = true;
    }

    // Revalidate the favorites cache for this user
    revalidateTag(CACHE_TAGS.favorites(session.user.id));

    return NextResponse.json({ isFavorited });
  } catch (error) {
    console.error('[FAVORITE_TOGGLE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

// DELETE /api/user/favorites/[listingId] - Remove from favorites
export async function DELETE(
  req: Request,
  { params }: { params: { listingId: string } }
) {
  try {
    // Get session and params concurrently
    const [session, { listingId }] = await Promise.all([
      getSession(req),
      Promise.resolve(params)
    ]);

    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    await prisma.favorite.deleteMany({
      where: {
        userId: session.user.id,
        listingId
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FAVORITE_DELETE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
