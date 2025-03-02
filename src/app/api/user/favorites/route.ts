import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { CACHE_TAGS } from '@/lib/cache/tags';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// GET /api/user/favorites - Get user's favorites
export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const favorites = await prisma.favorite.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        listing: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            },
            media: {
              orderBy: {
                order: 'asc'
              },
              take: 1
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(favorites, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'Tag': CACHE_TAGS.favorites(session.user.id)
      }
    });
  } catch (error) {
    console.error('[FAVORITES_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
