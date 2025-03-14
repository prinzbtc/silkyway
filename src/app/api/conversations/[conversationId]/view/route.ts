import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { io } from 'socket.io-client';

// Get the base URL for Socket.IO connections based on environment
const getSocketBaseUrl = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction 
    ? process.env.NEXT_PUBLIC_APP_URL || 'https://silkyway.com' 
    : 'http://localhost:3000';
};

// Instead of using Socket.IO client in server-side code, we'll use a direct approach
// This avoids XHR poll errors and other connection issues
const markMessagesAsReadInDb = async (conversationId: string, userId: string) => {
  try {
    // Mark all messages sent to the current user as read
    const result = await prisma.message.updateMany({
      where: {
        conversationId: conversationId,
        receiverId: userId,
        read: false,
      },
      data: {
        read: true,
      },
    });
    
    // Also mark related notifications as read
    await prisma.notification.updateMany({
      where: {
        userId: userId,
        read: false,
        content: {
          contains: conversationId
        }
      },
      data: {
        read: true
      }
    });
    
    // Clear notification cache for this user
    await redis.del(`notifications:${userId}`);
    
    return result.count;
  } catch (error) {
    console.error('Error marking messages as read in database:', error);
    throw error;
  }
};

/**
 * Marks all messages in a conversation as read for the current user
 * 
 * @param request Request object
 * @param params Contains the conversationId
 * @returns Success status or an error response
 */
export async function POST(
  request: Request,
  { params }: { params: Record<string, string> }
) {
  // Extract conversationId from the URL instead of params
  // This avoids the "params should be awaited" error in Next.js App Router
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const conversationId = pathParts[pathParts.indexOf('conversations') + 1];
  try {
    const session = await getSession();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get conversation and verify participant
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
      },
    });

    if (!conversation) {
      return new NextResponse('Conversation not found', { status: 404 });
    }

    // Verify user is part of conversation
    if (conversation.buyerId !== session.user.id && conversation.sellerId !== session.user.id) {
      return new NextResponse('Unauthorized - you are not a participant in this conversation', { status: 403 });
    }

    // Mark messages as read in the database
    const messagesMarkedAsRead = await markMessagesAsReadInDb(conversationId, session.user.id);

    // Notify the other user that messages have been read
    const otherUserId = conversation.buyerId === session.user.id 
      ? conversation.sellerId 
      : conversation.buyerId;

    // Instead of using Socket.IO directly from the server, we'll rely on the client-side Socket.IO
    // The client will handle real-time updates when they view the conversation
    // This avoids XHR poll errors and other connection issues

    return NextResponse.json({ 
      success: true, 
      messagesMarkedAsRead: messagesMarkedAsRead
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return new NextResponse(`Internal Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}
