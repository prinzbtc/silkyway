import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { pusherServer } from '@/lib/pusher';
import { MessageAttachment, SendMessageInput } from '@/types/chat';

const MAX_MESSAGE_LENGTH = 350;
const MAX_ATTACHMENTS = 5;

/**
 * Sends a new message in a conversation
 * 
 * @param request Request containing message content and attachments
 * @param params Contains the conversationId
 * @returns The created message or an error response
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

    // Parse and validate request body
    const body = await request.json();
    const { content, attachments } = body as SendMessageInput;

    // Validate content length
    if (content && content.length > MAX_MESSAGE_LENGTH) {
      return new NextResponse(`Message too long, maximum ${MAX_MESSAGE_LENGTH} characters allowed`, { status: 400 });
    }

    // Validate attachments
    if (attachments) {
      if (!Array.isArray(attachments)) {
        return new NextResponse('Attachments must be an array', { status: 400 });
      }
      
      if (attachments.length > MAX_ATTACHMENTS) {
        return new NextResponse(`Maximum ${MAX_ATTACHMENTS} attachments allowed`, { status: 400 });
      }
      
      // Validate each attachment has required fields
      for (const attachment of attachments) {
        if (!attachment.url || !attachment.type || !attachment.size) {
          return new NextResponse('Each attachment must have url, type, and size', { status: 400 });
        }
      }
    }

    // Get conversation and verify participant
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.conversationId },
      select: {
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

    // Determine recipient
    const receiverId = conversation.buyerId === session.user.id 
      ? conversation.sellerId 
      : conversation.buyerId;

    // Create message
    const message = await prisma.message.create({
      data: {
        content: content || '',
        senderId: session.user.id,
        receiverId,
        conversationId: params.conversationId,
        attachments: (attachments || []) as any, // Type cast to handle JSON field
        type: 'text' // Default type for regular messages
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

    // Update conversation's updatedAt timestamp
    await prisma.conversation.update({
      where: { id: params.conversationId },
      data: { updatedAt: new Date() }
    });

    // Trigger Pusher event for real-time updates
    await pusherServer.trigger(
      `user-${receiverId}`,
      'new-message',
      {
        message,
        senderId: session.user.id,
        conversationId: params.conversationId,
      }
    );

    // Also trigger a conversation update event
    await pusherServer.trigger(
      `user-${receiverId}`,
      'conversation-update',
      {
        conversationId: params.conversationId
      }
    );

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return new NextResponse(`Internal Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}
