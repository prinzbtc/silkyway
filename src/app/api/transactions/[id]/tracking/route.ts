import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { trackingNumber } = await request.json();

    // Get the transaction and verify the user is the seller
    const transaction = await prisma.transaction.findUnique({
      // Properly await the params object before destructuring
      const params = await context.params;
      const id = params.id;
      where: { id: id },
      include: {
        listing: {
          select: {
            userId: true,
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

    if (transaction.listing.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Update the tracking number
    const updatedTransaction = await prisma.transaction.update({
      where: { id: id },
      data: {
        trackingNumber,
      },
    });

    return NextResponse.json(updatedTransaction);
  } catch (error) {
    console.error('Error updating tracking number:', error);
    return NextResponse.json(
      { error: 'Failed to update tracking number' },
      { status: 500 }
    );
  }
}
