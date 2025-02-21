import { pusherServer } from '@/lib/pusher';
import prisma from '@/lib/prisma';
import { Message } from '@/types/chat';

export async function sendTransactionNotification(
  transactionId: string,
  type: 'buyer' | 'seller' | 'buyerCancel' | 'sellerCancel'
) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      listing: {
        include: {
          user: true,
        },
      },
      buyer: true,
    },
  });

  if (!transaction) throw new Error('Transaction not found');

  const conversationId = `transaction_${transactionId}`;
  const isBuyerNotification = type.startsWith('buyer');
  
  // Prepare message data
  const messageData = {
    content: '', // Content is rendered by the component
    type: 'transaction_notification' as const,
    senderId: isBuyerNotification ? transaction.listing.user.id : transaction.buyerId,
    receiverId: isBuyerNotification ? transaction.buyerId : transaction.listing.user.id,
    conversationId,
    metadata: {
      type,
      listingTitle: transaction.listing.title,
      counterpartyUsername: isBuyerNotification 
        ? transaction.listing.user.username || 'Anonymous'
        : transaction.buyer.username || 'Anonymous',
      transactionId,
    },
  };

  // Save message to database
  const savedMessage = await prisma.message.create({
    data: messageData,
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      },
      receiver: {
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      },
    },
  });

  // Send real-time update
  await pusherServer.trigger(
    conversationId,
    'new-message',
    savedMessage
  );

  return savedMessage;
}
