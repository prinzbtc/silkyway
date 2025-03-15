import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

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
    // In Next.js App Router, params need to be properly awaited
    const conversationId = params.conversationId;
    
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

    // Mark all messages sent to the current user as read
    const result = await prisma.message.updateMany({
      where: {
        conversationId: conversationId,
        receiverId: session.user.id,
        read: false,
      },
      data: {
        read: true,
      },
    });

    // Notify the other user that messages have been read using Socket.IO
    const otherUserId = conversation.buyerId === session.user.id 
      ? conversation.sellerId 
      : conversation.buyerId;
      
    // Get the unread count for this conversation
    const unreadCount = await prisma.message.count({
      where: {
        conversationId: conversationId,
        receiverId: session.user.id,
        read: false,
      },
    });
      
    try {
      const { getSocketIOServer } = await import('../../../../../lib/socketio-server');
      const io = getSocketIOServer();
      
      if (io) {
        // Create a comprehensive payload with necessary information
        const readData = {
          conversationId: conversationId,
          readerId: session.user.id,
          senderId: otherUserId,
          timestamp: new Date().toISOString(),
          userId: session.user.id, 
          otherUserId: otherUserId, 
          unreadCount: 0,
          eventId: `read_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          forceUpdate: true,
          _serverTimestamp: Date.now(),
          _uniqueId: Math.random().toString(36).substring(2, 15)
        };
        
        console.log(`Emitting message_read event for conversation ${conversationId}`);
        console.log(`Reader: ${session.user.id}, Sender: ${otherUserId}`);
        
        // Emit events to notify clients
        io.emit('message_read', readData);
        io.to(`user:${otherUserId}`).emit('message_read', readData);
        io.to(`conversation:${conversationId}`).emit('message_read', readData);
        io.emit('messages-read', readData);
        io.emit('force_update_read_status', readData);
        
        // Also emit a global message event
        io.emit('global-message', {
          type: 'READ_STATUS_UPDATE',
          data: readData,
          targetRooms: ['all'],
          timestamp: Date.now()
        });
        
        try {
          // Try to send individual socket events
          const sockets = await io.fetchSockets();
          console.log(`Found ${sockets.length} connected sockets`);
          
          for (const clientSocket of sockets) {
            try {
              // Get the socket's user ID from the handshake data
              const socketUserId = clientSocket.handshake.query.userId as string;
              console.log(`Socket ${clientSocket.id} belongs to user ${socketUserId}`);
              
              // Send the events to this socket
              clientSocket.emit('force_update_read_status', readData);
              clientSocket.emit('message_read', readData);
              
              // If this socket belongs to the sender, send additional events
              if (socketUserId === otherUserId) {
                console.log(`Sending targeted read status update to sender socket ${clientSocket.id}`);
                
                // Send targeted event
                const targetedData = {
                  ...readData,
                  _targetedUpdate: true,
                  _timestamp: Date.now(),
                  _uniqueId: Math.random().toString(36).substring(2, 15)
                };
                clientSocket.emit('force_update_read_status', targetedData);
                clientSocket.emit('message_read', targetedData);
              }
            } catch (socketError) {
              console.error('Error processing socket:', socketError);
              // Continue with other sockets
            }
          }
        } catch (socketsError) {
          console.error('Error fetching sockets:', socketsError);
          // Continue without individual socket updates
        }
      } else {
        console.log('Socket.IO server not available, skipping real-time updates');
        // Continue without real-time updates - the database was still updated
      }
    } catch (socketError) {
      console.error('Socket.IO error:', socketError);
      // Continue with the request even if Socket.IO fails
    }

    return NextResponse.json({ 
      success: true, 
      messagesMarkedAsRead: result.count,
      otherUserId: otherUserId
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return new NextResponse(`Internal Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}
