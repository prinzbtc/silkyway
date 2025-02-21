import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { pusherServer } from '@/lib/pusher';
import { sendTransactionNotification } from '@/lib/chat';
import { transformToListingWithFavorite } from '@/lib/listing/transform';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      listingId,
      escrowAddress,
      amount,
      protectionFee,
      shippingFee,
      signature,
      offerId,
    } = body;

    // Get listing
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        user: true,
        favorites: {
          where: { userId: session.user.id },
          select: { id: true },
        },
        _count: {
          select: { favorites: true },
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Get offer to get buyer info
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { senderId: true },
    });

    if (!offer) {
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      );
    }

    // Create transaction with escrow
    // Transform listing to include favorite information
    const listingWithFavorite = transformToListingWithFavorite(listing, session.user.id);

    const transaction = await prisma.transaction.create({
      data: {
        amount,
        protectionFee,
        shippingFee,
        signature,
        status: 'pending',
        listing: { connect: { id: listingId } },
        offer: { connect: { id: offerId } },
        buyer: { connect: { id: offer.senderId } },
        seller: { connect: { id: listing.userId } },
        escrow: {
          create: {
            address: escrowAddress,
            amount: amount,
            status: 'pending',
          },
        },
      },
      include: {
        listing: {
          include: {
            user: true,
            favorites: {
              where: { userId: session.user.id },
              select: { id: true },
            },
            _count: {
              select: { favorites: true },
            },
          },
        },
        offer: {
          include: {
            sender: true,
          },
        },
      },
    });

    // Update listing status
    await prisma.listing.update({
      where: { id: listingId },
      data: { status: 'sold' },
    });

    // Notify seller
    await pusherServer.trigger(
      `user-${listing.user.id}`,
      'new-sale',
      {
        transaction,
      }
    );

    // Clear cache
    await redis.del(`transactions:${session.user.id}:*`);
    await redis.del(`transactions:${listing.user.id}:*`);

    // Send transaction notifications in chat
    await Promise.all([
      sendTransactionNotification(transaction.id, 'buyer'),
      sendTransactionNotification(transaction.id, 'seller'),
    ]);

    return NextResponse.json({ transactionId: transaction.id });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const cursor = searchParams.get('cursor');

    // Get current session
    const session = await getSession();
    if (!session?.user?.id || session.user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check cache
    const cacheKey = `transactions:${userId}:${limit}:${cursor || 'start'}`;
    const cached = await redis.get(cacheKey);
    if (cached && typeof cached === 'string') {
      return NextResponse.json(JSON.parse(cached));
    }

    // Build query
    const query: Prisma.TransactionFindManyArgs = {
      take: limit + 1, // Get an extra item to check if there are more
      where: {
        OR: [
          { offer: { senderId: userId } },
          { listing: { userId: userId } },
        ],
      },
      orderBy: {
        createdAt: 'desc' as const,
      },
      include: {
        listing: {
          include: {
            user: true,
            favorites: {
              where: { userId: session.user.id },
              select: { id: true },
            },
            _count: {
              select: { favorites: true },
            },
          },
        },
        offer: {
          include: {
            sender: true,
          },
        },
      },
    };

    // Add cursor if provided
    if (cursor) {
      query.cursor = {
        id: cursor,
      };
      query.skip = 1; // Skip the cursor
    }

    // Get transactions
    const transactions = await prisma.transaction.findMany(query);

    // Check if there are more results
    const hasMore = transactions.length > limit;
    const results = hasMore ? transactions.slice(0, -1) : transactions;
    const nextCursor = hasMore ? results[results.length - 1].id : undefined;

    // Transform listings to include favorite information
    const transformedTransactions = results.map(transaction => ({
      ...transaction,
      listing: transformToListingWithFavorite(transaction.listing, session.user.id),
    }));

    const response = {
      transactions: transformedTransactions,
      nextCursor,
    };

    // Cache results for 1 minute
    await redis.setex(cacheKey, 60, JSON.stringify(response));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
