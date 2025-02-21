import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import ConnectWallet from '@/components/wallet/ConnectWallet';
import InboxContainer from '@/components/inbox/InboxContainer';

export const metadata: Metadata = {
  title: 'Inbox - Silkyway',
  description: 'Your messages and offers on Silkyway',
};

import { Conversation } from '@/types/conversation';

export default async function InboxPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center">
          <h1 className="mb-8 text-3xl font-bold">Inbox</h1>
          <ConnectWallet />
        </div>
      </main>
    );
  }

  // Get all transaction notifications first to get listing and offer info
  const transactionMessages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: session.user.id },
        { receiverId: session.user.id },
      ],
      type: 'transaction_notification',
    },
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

  // Get transaction IDs from message metadata
  const transactionIds = transactionMessages
    .map(msg => msg.metadata as any)
    .filter(meta => meta?.transactionId)
    .map(meta => meta.transactionId);

  // Get transaction details
  const transactions = await prisma.transaction.findMany({
    where: {
      id: { in: transactionIds },
    },
    include: {
      listing: {
        include: {
          user: true,
        },
      },
      buyer: true,
      offer: true,
    },
  });

  // Get all messages
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: session.user.id },
        { receiverId: session.user.id },
      ],
    },
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
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Create a map of transaction metadata by conversation ID
  const transactionsByConversation = new Map();
  transactionMessages.forEach(msg => {
    const metadata = msg.metadata as any;
    if (metadata?.transactionId) {
      const conversationId = [msg.senderId, msg.receiverId].sort().join('-');
      const transaction = transactions.find(t => t.id === metadata.transactionId);
      if (transaction) {
        transactionsByConversation.set(conversationId, transaction);
      }
    }
  });

  // Group messages by conversation (sender-receiver pair)
  const conversations = messages.reduce((acc, message) => {
    const otherUser = message.senderId === session.user.id ? message.receiver : message.sender;
    const conversationId = [message.senderId, message.receiverId].sort().join('-');
    
    if (!acc[conversationId]) {
      const transaction = transactionsByConversation.get(conversationId);
      const latestOffer = transaction?.offer;

      acc[conversationId] = {
        id: conversationId,
        otherUser,
        messages: [],
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
        _count: { messages: 0 },
        offers: latestOffer ? [latestOffer] : [],
        listing: transaction?.listing || null,
        buyer: transaction?.buyer || null
      };
    }
    
    acc[conversationId].messages.push(message);
    if (!message.read && message.receiverId === session.user.id) {
      acc[conversationId].unreadCount++;
    }
    
    return acc;
  }, {} as Record<string, Conversation>);

  return (
    <main className="container mx-auto px-4 py-8">
      <InboxContainer 
        conversations={Object.values(conversations)}
        userId={session.user.id}
      />
    </main>
  );
}
