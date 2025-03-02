import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const [session, { id }] = await Promise.all([
      getSession(req),
      Promise.resolve(params)
    ]);

    // Get listing with favorites count
    console.log('Session user ID:', session?.user?.id);

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        media: true,
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            walletAddress: true,
          },
        },
        favorites: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!listing) {
      console.log('Listing not found');

      return new NextResponse('Listing not found', { status: 404 });
    }

    // Check if listing is favorited by current user
    let isFavorite = false;
    if (session?.user?.id) {
      const favorite = await prisma.favorite.findUnique({
        where: {
          userId_listingId: {
            userId: session.user.id,
            listingId: id
          }
        }
      });
      isFavorite = !!favorite;
    }

    // Calculate total favorites count
    const favoritesCount = listing?.favorites?.length ?? 0;

    // Remove favorites array from response
    const { favorites, ...listingWithoutFavorites } = listing as any;

    if (listing?.user) {
      console.log('Listing creator ID:', listing.user.id);
      console.log('Listing creator walletAddress:', listing.user.walletAddress);
    }

    return NextResponse.json({
      ...listingWithoutFavorites,
      favoritesCount,
      isFavorite
    });
  } catch (error) {
    console.error('Error fetching listing:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
