import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { pusherServer } from '@/lib/pusher';

export async function POST(
  request: Request,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { content, attachments } = await request.json();

    // Validate content length
    if (content && content.length > 350) {
      return new NextResponse('Message too long', { status: 400 });
    }

    // Validate attachments
    if (attachments && (!Array.isArray(attachments) || attachments.length > 3)) {
      return new NextResponse('Invalid attachments', { status: 400 });
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
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        content: content || '',
        senderId: session.user.id,
        receiverId: conversation.buyerId === session.user.id ? conversation.sellerId : conversation.buyerId,
        conversationId: params.conversationId,
        attachments: attachments || [],
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

    // Trigger Pusher event
    await pusherServer.trigger(
      `user-${message.receiverId}`,
      'new-message',
      {
        message,
        senderId: session.user.id,
        conversationId: params.conversationId,
      }
    );

    return new NextResponse(JSON.stringify(message), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
