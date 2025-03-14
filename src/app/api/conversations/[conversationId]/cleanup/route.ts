import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionFromAppRequest } from '@/lib/auth/api-helpers';

export async function DELETE(
  request: Request,
  context: { params: { conversationId: string } }
) {
  try {
    // Get the session from the request
    const session = await getSessionFromAppRequest(request);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract conversationId from the URL path instead of params
    // This avoids the "params should be awaited" error in Next.js App Router
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const conversationId = pathParts[pathParts.indexOf('conversations') + 1];
    
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    // Find the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: true,
      },
    });

    // Check if the conversation exists and user has access to it
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.buyerId !== session.user.id && conversation.sellerId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only delete if the conversation has no messages
    if (conversation.messages.length === 0) {
      await prisma.conversation.delete({
        where: { id: conversationId },
      });

      return NextResponse.json({ success: true, message: 'Empty conversation deleted' });
    }

    // If there are messages, don't delete
    return NextResponse.json({ success: true, message: 'Conversation has messages, not deleted' });
  } catch (error) {
    console.error('Error cleaning up conversation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
