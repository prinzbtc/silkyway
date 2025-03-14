import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

// Handle both POST and DELETE methods for better compatibility with sendBeacon
export async function POST(request: Request) {
  return handleRequest(request);
}

export async function DELETE(request: Request) {
  return handleRequest(request);
}

async function handleRequest(request: Request) {
  try {
    // Get the current user session
    const session = await getSession();
    if (!session?.user?.id) {
      console.error('Unauthorized attempt to delete conversation - no valid session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the conversation ID from the request body
    let conversationId;
    try {
      const body = await request.json();
      conversationId = body.conversationId;
    } catch (error) {
      console.error('Error parsing request body:', error);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    if (!conversationId) {
      console.error('No conversation ID provided in request');
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }
    
    console.log(`Attempting to delete empty conversation: ${conversationId}`);

    // Find the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          take: 1 // Just check if there are any messages, no need to fetch all
        },
        _count: {
          select: { messages: true }
        }
      }
    });

    // Check if the conversation exists and belongs to the current user
    if (!conversation) {
      console.error(`Conversation not found: ${conversationId}`);
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Verify the user is either the buyer or seller
    if (conversation.buyerId !== session.user.id && conversation.sellerId !== session.user.id) {
      console.error(`Unauthorized attempt to delete conversation: ${conversationId}`);
      console.error(`User ${session.user.id} is neither buyer ${conversation.buyerId} nor seller ${conversation.sellerId}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Only delete if the conversation has no messages
    if (conversation.messages.length > 0 || conversation._count.messages > 0) {
      console.error(`Cannot delete conversation with messages: ${conversationId} (has ${conversation._count.messages} messages)`);
      return NextResponse.json({ error: 'Cannot delete conversation with messages' }, { status: 400 });
    }

    // Delete the conversation
    await prisma.conversation.delete({
      where: { id: conversationId }
    });

    console.log(`Successfully deleted empty conversation: ${conversationId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting empty conversation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
