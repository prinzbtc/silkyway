import { NextRequest, NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { transformToListingWithFavorite } from '@/lib/listing/transform';
import { redis } from '@/lib/redis';
import { sendTransactionNotification } from '@/lib/chat';
import { EscrowService } from '@/lib/escrow/escrow';

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

    // Get the transaction and verify the user is the seller
    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
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
        escrow: {
          select: {
            address: true,
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

    // Get buyer ID from offer
    const offer = await prisma.offer.findUnique({
      where: { id: transaction.offerId },
      select: { senderId: true },
    });

    if (!offer) {
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      );
    }

    // Attempt to refund escrow if it exists
    if (transaction.escrow?.address) {
      try {
        const connection = new Connection(process.env.SOLANA_RPC_URL!);
        const escrowService = new EscrowService(connection);
        await escrowService.returnToBuyer(
          transaction.escrow.address,
          offer.senderId
        );
        console.log('Refund transaction completed successfully');
      } catch (error) {
        console.error('Error processing refund transaction:', error);
        // Continue with cancellation even if refund fails
        // This ensures the transaction is still marked as cancelled in our database
      }
    }

    // Update transaction status and transform listing
    const updatedTransaction = await prisma.transaction.update({
      where: { id: params.id },
      data: {
        status: 'cancelled',
        updatedAt: new Date(), // Use updatedAt instead of cancelledAt
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

    // Clear cache
    await redis.del(`transactions:${offer.senderId}*`); // buyer
    await redis.del(`transactions:${transaction.listing.userId}*`); // seller

    // Transform listing to include favorite information
    const transformedTransaction = {
      ...updatedTransaction,
      listing: transformToListingWithFavorite(updatedTransaction.listing, session.user.id),
    };

    // Send transaction cancel notifications in chat
    await Promise.all([
      sendTransactionNotification(transaction.id, 'buyerCancel'),
      sendTransactionNotification(transaction.id, 'sellerCancel'),
    ]);

    return NextResponse.json(updatedTransaction);
  } catch (error) {
    console.error('Error cancelling transaction:', error);
    return NextResponse.json(
      { error: 'Failed to cancel transaction' },
      { status: 500 }
    );
  }
}
