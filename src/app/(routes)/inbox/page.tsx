import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import ConnectWallet from '@/components/wallet/ConnectWallet';
import InboxClientWrapper from '@/components/chat/InboxClientWrapper';

export const metadata: Metadata = {
  title: 'Inbox - Silkyway',
  description: 'Your messages and offers on Silkyway',
};

import { Conversation } from '@/types/conversation';
import { MessageAttachment, TransactionNotificationMetadata } from '@/types/chat';

// Make the component dynamic to handle searchParams properly
export const dynamic = 'force-dynamic';

export default async function InboxPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Extract conversationId from searchParams - ensure we await the searchParams
  const params = await Promise.resolve(searchParams);
  const conversationIdParam = params?.conversationId;
  const conversationId = typeof conversationIdParam === 'string' ? conversationIdParam : 
                         Array.isArray(conversationIdParam) ? conversationIdParam[0] : undefined;
  
  console.log(`Inbox page loaded with conversationId parameter: ${conversationId}`);
  
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
  
  // Get all conversations where the user is a buyer or seller, even if there are no messages yet
  const emptyConversations = await prisma.conversation.findMany({
    where: {
      OR: [
        { buyerId: session.user.id },
        { sellerId: session.user.id },
      ],
    },
    include: {
      buyer: {
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      },
      seller: {
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      },
      listing: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
          media: true,
        },
      },
      _count: {
        select: {
          messages: true,
        },
      },
      messages: {
        take: 0, // Don't actually fetch messages, we just want to know if there are any
      },
    },
  });
  
  // Get all listings to find those associated with conversations
  // We'll match them manually since there's no direct relation in the schema
  const allListings = await prisma.listing.findMany({
    include: {
      user: {
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      },
      media: true,
    },
  });
  
  // Create a map of listings by seller ID for easier lookup
  const listingsBySellerId = new Map();
  allListings.forEach(listing => {
    if (!listingsBySellerId.has(listing.userId)) {
      listingsBySellerId.set(listing.userId, []);
    }
    listingsBySellerId.get(listing.userId).push(listing);
  });
  
  console.log(`Found ${emptyConversations.length} conversations in database, including empty ones`);

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

  // Group messages by conversation ID
  const messageConversations = messages.reduce((acc, message) => {
    // Use the actual conversation ID from the database instead of creating a synthetic ID
    const conversationId = message.conversationId;
    const otherUser = message.senderId === session.user.id ? message.receiver : message.sender;
    
    if (!acc[conversationId]) {
      // Find the transaction for this conversation if it exists
      const syntheticId = [message.senderId, message.receiverId].sort().join('-');
      const transaction = transactionsByConversation.get(syntheticId);
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
    
    // Use a simple type assertion to treat the message as the expected type
    // This is safe because we're just displaying the messages, not modifying them
    acc[conversationId].messages.push(message as unknown as import('@/types/chat').Message);

    if (!message.read && message.receiverId === session.user.id) {
      acc[conversationId].unreadCount++;
    }
    
    return acc;
  }, {} as Record<string, Conversation>);
  
  // Process empty conversations (those without messages)
  const allConversations = { ...messageConversations };
  
  // Add empty conversations to the list
  emptyConversations.forEach(conversation => {
    // Skip if we already have this conversation from messages
    if (Object.values(allConversations).some(c => c.id === conversation.id)) {
      return;
    }
    
    // Determine who the other user is based on whether the current user is buyer or seller
    const isBuyer = conversation.buyerId === session.user.id;
    const otherUser = isBuyer ? conversation.seller : conversation.buyer;
    
    // Use the directly related listing if available
    // This ensures we display the correct listing for each conversation
    const relatedListing = conversation.listing;
    
    // Create a conversation object in the format expected by the UI
    allConversations[conversation.id] = {
      id: conversation.id,
      otherUser,
      messages: [],
      unreadCount: 0,
      updatedAt: conversation.updatedAt.toISOString(),
      _count: { messages: 0 },
      offers: [],
      // Use the directly related listing
      listing: relatedListing as any,
      // Add buyer property to satisfy TypeScript - using type assertion for simplicity
      buyer: isBuyer ? { 
        id: session.user.id,
        username: null,  // We don't have these fields in the session user object
        avatar: null      // so we'll use null as fallback values
      } : otherUser as any
    };
  });
  
  console.log(`Total conversations after merging: ${Object.keys(allConversations).length}`);
  
  // Log if we're trying to select a specific conversation
  if (conversationId) {
    const foundConversation = Object.values(allConversations).find(c => c.id === conversationId);
    console.log(`Looking for conversation with ID: ${conversationId}`);
    console.log(`Found conversation: ${foundConversation ? 'Yes' : 'No'}`);
    
    if (!foundConversation) {
      console.log(`Available conversation IDs:`, Object.keys(allConversations));
    }
  }

  // Server-side rendered part with client component wrapper
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Inbox</h1>
      <InboxClientWrapper />
    </main>
  );
}
