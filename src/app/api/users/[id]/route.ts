import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get user with their listings and reviews count
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        walletAddress: true,
        createdAt: true,
        location: true, // Added location field
        _count: {
          select: {
            listings: true,
            receivedReviews: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get total rating
    const totalRating = await prisma.review.aggregate({
      where: {
        receiverId: user.id,
      },
      _sum: {
        rating: true,
      },
    });

    return NextResponse.json({
      ...user,
      totalRating: totalRating._sum.rating || 0,
      location: user.location // Explicitly add location to the response
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
