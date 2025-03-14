import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { MessageAttachment, SendMessageInput, ChatOffer } from '@/types/chat';
import { NotificationService } from '@/lib/notifications/service';
import { initSocketIO } from '@/lib/socketio';

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
  request: NextRequest,
  context: { params: Record<string, string> }
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
      where: { id: conversationId },
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

    // Create message with detailed error handling
    let message;
    try {
      message = await prisma.message.create({
        data: {
          content: content || '',
          senderId: session.user.id,
          receiverId,
          conversationId: conversationId,
          attachments: (attachments || []) as any // Type cast to handle JSON field
          // Regular messages don't need a type specified (will be undefined)
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
      console.log('Message created successfully:', message.id);
    } catch (dbError) {
      console.error('Failed to create message in database:', dbError);
      return new NextResponse(`Database Error: ${dbError instanceof Error ? dbError.message : 'Unknown database error'}`, { status: 500 });
    }

    // Update conversation's updatedAt timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });
    
    // Get the conversation with complete listing details for both notification and response
    const conversationDetails = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
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
      },
    });
    
    // Fetch the complete listing details separately to get all required fields
    let listingDetails = null;
    let completeListingDetails = null;
    
    if (conversationDetails?.listing) {
      listingDetails = await prisma.listing.findUnique({
        where: { id: conversationDetails.listing.id },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
        },
      });
      
      // Also fetch the listing media separately
      const listingMedia = await prisma.listingMedia.findMany({
        where: { listingId: conversationDetails.listing.id },
        orderBy: { order: 'asc' },
      });
      
      console.log('Fetched complete listing details:', {
        id: listingDetails?.id,
        title: listingDetails?.title,
        price: listingDetails?.price,
        currency: listingDetails?.currency,
        mediaCount: listingMedia?.length,
        hasMedia: !!listingMedia?.length,
        firstMediaItem: listingMedia?.[0]?.url,
      });
      
      // Create a complete listing object with media
      completeListingDetails = {
        ...listingDetails,
        media: listingMedia || [],
      }
    }
    
    // Create a complete conversation object with all necessary details
    const completeConversation = {
      ...conversationDetails,
      listing: listingDetails ? completeListingDetails : conversationDetails?.listing,
    };
    
    // Log the conversation details to help with debugging
    console.log('Conversation details for message response:', JSON.stringify({
      id: completeConversation?.id,
      listingId: completeConversation?.listing?.id,
      listingTitle: completeConversation?.listing?.title,
      listingPrice: completeConversation?.listing?.price,
      listingCurrency: completeConversation?.listing?.currency,
      listingMedia: completeConversation?.listing?.media?.length,
      // Use the first media item as the main image if available
      mainImageUrl: completeConversation?.listing?.media?.[0]?.url || null,
    }));

    // Use ChatOffer type for the offers array
    
    // Convert conversation to UnifiedConversation format for consistent data structure
    const unifiedConversation = {
      id: completeConversation.id,
      createdAt: completeConversation.createdAt,
      updatedAt: completeConversation.updatedAt,
      buyerId: completeConversation.buyerId,
      sellerId: completeConversation.sellerId,
      buyer: completeConversation.buyer,
      seller: completeConversation.seller,
      listing: {
        id: completeConversation.listing?.id,
        title: completeConversation.listing?.title,
        price: completeConversation.listing?.price,
        currency: completeConversation.listing?.currency || 'USD',
        media: completeConversation.listing?.media?.map((m: { id: string; url: string | null; type: string }) => ({
          id: m.id,
          url: m.url,
          type: m.type
        })) || [],
        mainImage: completeConversation.listing?.media?.[0]?.url || null,
        status: completeConversation.listing?.status || 'active',
        description: completeConversation.listing?.description || '',
        category: completeConversation.listing?.category || '',
        user: completeConversation.listing?.user || {
          id: completeConversation.sellerId,
          username: completeConversation.seller?.username || '',
          avatar: completeConversation.seller?.avatar || ''
        }
      },
      messages: [message],
      unreadCount: 1,
      _count: {
        messages: 1 // Start with 1 for the new message
      },
      offers: [] as ChatOffer[], // Type assertion to fix type error
      lastMessageAt: new Date()
    };
    
    // Use type assertion to safely access properties that might not be defined in the type
    const conversationWithCount = completeConversation as unknown as { _count?: { messages: number }, offers?: any[] };
    
    // Add message count if available
    if (conversationWithCount._count && typeof conversationWithCount._count.messages === 'number') {
      unifiedConversation._count.messages = conversationWithCount._count.messages + 1;
    }
    
    // Add offers if available
    if (Array.isArray(conversationWithCount.offers)) {
      unifiedConversation.offers = conversationWithCount.offers;
    }
    
    // Use the NotificationService to create a notification
    // This handles checking user preferences and sending the notification
    const notificationService = NotificationService.getInstance();
    
    // Create a message preview for the notification
    const messagePreview = content && content.length > 50 ? `${content.substring(0, 50)}...` : (content || 'New message');
    
    // Create the notification with the NotificationService
    try {
      await notificationService.createNotification(
        receiverId,
        'new_message',
        `New message from ${message.sender.username || 'a user'}`,
        messagePreview,
        {
          conversationId: conversationId,
          link: `/inbox?conversationId=${conversationId}`,
          listingId: completeConversation?.listing?.id,
          listingTitle: completeConversation?.listing?.title
        }
      );
    } catch (notificationError) {
      console.error('Failed to create notification:', notificationError);
      // Continue anyway, notification is not critical
    }
    
    // Send real-time updates using Socket.IO
    try {
      const { getSocketIOServer, emitToRoom } = await import('../../../../../lib/socketio-server');
      const io = getSocketIOServer();
      
      if (!io) {
        console.error('Socket.IO server not initialized');
      } else {
        // Create the event payload with complete listing information
        const messagePayload: {
          message: typeof message;
          senderId: string;
          conversationId: string;
          conversation: typeof unifiedConversation;
          timestamp: number;
          deliveryId?: string; // Add optional deliveryId property
        } = {
          message,
          senderId: session.user.id,
          conversationId: conversationId,
          conversation: unifiedConversation,
          timestamp: Date.now() // Add timestamp for ordering
        };
        
        console.log('Emitting new-message event to rooms:', {
          receiverRoom: `user:${receiverId}`,
          senderRoom: `user:${session.user.id}`,
          conversationRoom: `conversation:${conversationId}`,
          listingInfo: {
            id: unifiedConversation.listing?.id,
            title: unifiedConversation.listing?.title,
            hasMedia: unifiedConversation.listing?.media?.length > 0,
            firstMediaUrl: unifiedConversation.listing?.media?.[0]?.url
          }
        });
        
        // Enhanced message delivery strategy with retries and confirmations
        
        // First, emit to the receiver's user room with a unique message ID for tracking
        const messageId = message.id;
        const deliveryId = `${messageId}-${Date.now()}`;
        messagePayload.deliveryId = deliveryId;
        
        console.log(`Emitting message ${messageId} with deliveryId ${deliveryId}`);
        
        // Primary delivery to specific rooms
        io.to(`user:${receiverId}`).emit('new-message', messagePayload);
        io.to(`user:${session.user.id}`).emit('new-message', messagePayload);
        io.to(`conversation:${conversationId}`).emit('new-message', messagePayload);
        
        // Global fallback with room targeting for filtering
        io.emit('global-message', {
          ...messagePayload,
          targetRooms: [`conversation:${conversationId}`, `user:${receiverId}`, `user:${session.user.id}`]
        });
        
        // Set up a delayed secondary delivery to ensure message arrives
        // This helps when the first emission might be missed due to connection issues
        setTimeout(() => {
          console.log(`Sending delayed backup delivery for message ${messageId}`);
          io.to(`user:${receiverId}`).emit('new-message', {
            ...messagePayload,
            isRetry: true
          });
          
          // Also send via global channel as ultimate fallback
          io.emit('global-message', {
            ...messagePayload,
            isRetry: true,
            targetRooms: [`user:${receiverId}`]
          });
        }, 2000); // 2-second delay for backup delivery
        
        // Log successful emission
        console.log(`Successfully emitted new-message event for message ${message.id} to user rooms and conversation room`);
      }
    } catch (socketError) {
      console.error('Socket.IO error:', socketError);
      // Continue anyway, real-time updates are not critical for message delivery
    }

    // Return both the message and conversation details to ensure proper UI display
    return NextResponse.json({
      message,
      conversation: unifiedConversation
    }, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return new NextResponse(`Internal Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}
