import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export async function GET(
  request: Request,
  context: { params: { conversationId: string } }
) {
  try {
    // Get the current user session
    const session = await getSession();
    if (!session?.user?.id) {
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

    console.log(`Fetching conversation: ${conversationId} for user: ${session.user.id}`);

    // Find the conversation with all necessary data
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
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
        messages: {
          orderBy: {
            createdAt: 'asc',
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
        },
        // Now we have a direct relation between Conversation and Listing
        listing: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
            // Include the listing media to display images
            media: {
              where: {
                isMainMedia: true,
              },
              take: 1,
            },
          },
        },
      },
    });

    // Check if the conversation exists
    if (!conversation) {
      console.error(`Conversation not found: ${conversationId}`);
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Verify the user is either the buyer or seller
    if (conversation.buyerId !== session.user.id && conversation.sellerId !== session.user.id) {
      console.error(`User ${session.user.id} is not authorized to view conversation ${conversationId}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    console.log(`Successfully fetched conversation: ${conversationId}`);
    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
