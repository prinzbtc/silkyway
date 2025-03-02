'use server';

import { cache } from 'react';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';

export const getUserFavorites = cache(async () => {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return null;
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

    return favorites;
  } catch (error) {
    console.error('[GET_USER_FAVORITES]', error);
    return null;
  }
});

export async function checkIsFavorited(listingId: string): Promise<boolean> {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return false;
    }

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_listingId: {
          userId: session.user.id,
          listingId
        }
      }
    });

    return !!favorite;
  } catch (error) {
    console.error('[CHECK_IS_FAVORITED]', error);
    return false;
  }
}
