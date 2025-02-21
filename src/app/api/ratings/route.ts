import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { transactionId, rating, comment, type } = await request.json();

    // Verify the transaction exists and user is part of it
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: {
          select: {
            userId: true,
          },
        },
        offer: {
          select: {
            senderId: true,
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Check if user is the buyer or seller
    const isBuyer = transaction.offer.senderId === session.user.id;
    const isSeller = transaction.listing.userId === session.user.id;

    if (!isBuyer && !isSeller) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has already left a review
    const existingReview = await prisma.review.findFirst({
      where: {
        transactionId,
        authorId: session.user.id,
      },
    });

    if (existingReview) {
      return NextResponse.json(
        { error: 'Review already exists' },
        { status: 400 }
      );
    }

    // Create the review
    const review = await prisma.review.create({
      data: {
        rating,
        comment,
        authorId: session.user.id,
        receiverId: isBuyer ? transaction.listing.userId : transaction.offer.senderId,
        transactionId,
      },
    });

    return NextResponse.json(review);
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const reviews = await prisma.review.findMany({
      where: {
        ...(type === 'received'
          ? { receiverId: userId }
          : { authorId: userId }),
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
          },
        },
        transaction: {
          include: {
            offer: {
              select: {
                sender: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
            listing: {
              select: {
                user: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}
