import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { pusherServer } from '@/lib/pusher';

/**
 * Marks all messages in a conversation as read for the current user
 * 
 * @param request Request object
 * @param params Contains the conversationId
 * @returns Success status or an error response
 */
export async function POST(
  request: Request,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get conversation and verify participant
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.conversationId },
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

    // Mark all messages sent to the current user as read
    const result = await prisma.message.updateMany({
      where: {
        conversationId: params.conversationId,
        receiverId: session.user.id,
        read: false,
      },
      data: {
        read: true,
      },
    });

    // Notify the other user that messages have been read
    const otherUserId = conversation.buyerId === session.user.id 
      ? conversation.sellerId 
      : conversation.buyerId;

    await pusherServer.trigger(
      `user-${otherUserId}`,
      'message-read',
      {
        conversationId: params.conversationId,
        readBy: session.user.id,
      }
    );

    return NextResponse.json({ 
      success: true, 
      messagesMarkedAsRead: result.count 
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return new NextResponse(`Internal Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}
