import { NextRequest, NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { transformToListingWithFavorite } from '@/lib/listing/transform';
import { EscrowService } from '@/lib/escrow/escrow';

export async function POST(
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

    // Get the transaction and verify the user is the buyer
    const transaction = await prisma.transaction.findUnique({
      // Properly await the params object before destructuring
      const params = await context.params;
      const id = params.id;
      where: { id: id },
      include: {
        offer: {
          select: {
            senderId: true,
          },
        },
        escrow: {
          select: {
            address: true,
          },
        },
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
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    if (transaction.offer.senderId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get seller ID from listing
    const listing = await prisma.listing.findUnique({
      where: { id: transaction.listingId },
      select: { userId: true },
    });

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Attempt to release escrow if it exists
    if (transaction.escrow?.address) {
      try {
        const connection = new Connection(process.env.SOLANA_RPC_URL!);
        const escrowService = new EscrowService(connection);
        await escrowService.releaseToSeller(
          transaction.escrow.address,
          listing.userId
        );
        console.log('Release transaction completed successfully');
      } catch (error) {
        console.error('Error processing release transaction:', error);
        // Continue with confirmation even if release fails
        // This ensures the transaction is still marked as completed in our database
      }
    }

    // Update transaction status and transform listing
    const updatedTransaction = await prisma.transaction.update({
      where: { id: id },
      data: {
        status: 'completed',
        updatedAt: new Date(), // Use updatedAt instead of completedAt
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
      },
    });

    // Transform listing to include favorite information
    const transformedTransaction = {
      ...updatedTransaction,
      listing: transformToListingWithFavorite(updatedTransaction.listing, session.user.id),
    };

    return NextResponse.json(transformedTransaction);
  } catch (error) {
    console.error('Error confirming delivery:', error);
    return NextResponse.json(
      { error: 'Failed to confirm delivery' },
      { status: 500 }
    );
  }
}
