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

    // Notify the other user that messages have been read using Socket.IO
    const otherUserId = conversation.buyerId === session.user.id 
      ? conversation.sellerId 
      : conversation.buyerId;
      
    // Get the unread count for this conversation
    const unreadCount = await prisma.message.count({
      where: {
        conversationId: params.conversationId,
        receiverId: session.user.id,
        read: false,
      },
    });
      
    try {
      const { getSocketIOServer } = await import('../../../../../lib/socketio-server');
      const io = getSocketIOServer();
      
      if (io) {
        // CRITICAL FIX: Create a comprehensive payload with ALL necessary information
        const readData = {
          conversationId: params.conversationId,
          readerId: session.user.id,
          senderId: otherUserId, // This is important - identifies whose messages were read
          timestamp: new Date().toISOString(),
          // Include additional fields for maximum compatibility
          userId: session.user.id, // For backward compatibility
          otherUserId: otherUserId, // Explicitly identify the other user
          unreadCount: 0, // After marking as read, the count should be 0
          // Add a unique ID to ensure clients recognize this as a new event
          eventId: `read_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          // Add forceUpdate flag to ensure UI updates
          forceUpdate: true,
          // Add additional fields to force UI updates
          _serverTimestamp: Date.now(),
          _uniqueId: Math.random().toString(36).substring(2, 15)
        };
        
        console.log(`🔴 CRITICAL FIX: Emitting message_read event for conversation ${params.conversationId}`);
        console.log(`🔴 CRITICAL FIX: Reader: ${session.user.id}, Sender: ${otherUserId}`);
        
        // CRITICAL FIX: Force a global broadcast to ALL clients
        // This is the most reliable way to ensure all clients receive the event
        io.emit('message_read', readData);
        
        // Also target the specific user who sent the messages to ensure they get the update
        io.to(`user:${otherUserId}`).emit('message_read', readData);
        
        // Also emit to the conversation room for any clients listening there
        io.to(`conversation:${params.conversationId}`).emit('message_read', readData);
        
        // For backward compatibility, also emit with the hyphenated event name
        io.emit('messages-read', readData);
        
        // CRITICAL FIX: Also emit a special event that will force UI updates
        io.emit('force_update_read_status', readData);
        
        // CRITICAL FIX: Also emit a global message event that all clients will receive
        io.emit('global-message', {
          type: 'READ_STATUS_UPDATE',
          data: readData,
          targetRooms: ['all'],
          timestamp: Date.now()
        });
        
        // CRITICAL FIX: Send individual socket events to ensure delivery
        // Find all sockets and send them the event directly
        const sockets = await io.fetchSockets();
        console.log(`🔴 CRITICAL FIX: Found ${sockets.length} connected sockets`);
        
        for (const clientSocket of sockets) {
          // Get the socket's user ID from the handshake data
          const socketUserId = clientSocket.handshake.query.userId as string;
          console.log(`🔴 CRITICAL FIX: Socket ${clientSocket.id} belongs to user ${socketUserId}`);
          
          // Send the events to this socket
          clientSocket.emit('force_update_read_status', readData);
          clientSocket.emit('message_read', readData);
          
          // CRITICAL FIX: If this socket belongs to the sender, send additional events
          // to ensure they receive the update
          if (socketUserId === otherUserId) {
            console.log(`🔴 CRITICAL FIX: Sending targeted read status update to sender socket ${clientSocket.id}`);
            
            // CRITICAL FIX: Send multiple events with different variations to ensure the client updates
            // Send first targeted event immediately
            const targetedData1 = {
              ...readData,
              _targetedUpdate: true,
              _timestamp: Date.now(),
              _uniqueId: Math.random().toString(36).substring(2, 15)
            };
            console.log(`🔴 CRITICAL FIX: Sending immediate targeted update:`, targetedData1);
            clientSocket.emit('force_update_read_status', targetedData1);
            clientSocket.emit('message_read', targetedData1);
            
            // Send second targeted event after a short delay
            setTimeout(() => {
              const targetedData2 = {
                ...readData,
                _delayedUpdate: true,
                _timestamp: Date.now() + 1,
                _uniqueId: Math.random().toString(36).substring(2, 15)
              };
              console.log(`🔴 CRITICAL FIX: Sending delayed targeted update (50ms):`, targetedData2);
              clientSocket.emit('force_update_read_status', targetedData2);
              clientSocket.emit('message_read', targetedData2);
            }, 50);
            
            // Send third targeted event after a longer delay
            setTimeout(() => {
              const targetedData3 = {
                ...readData,
                _delayedUpdate: true,
                _timestamp: Date.now() + 2,
                _uniqueId: Math.random().toString(36).substring(2, 15)
              };
              console.log(`🔴 CRITICAL FIX: Sending delayed targeted update (200ms):`, targetedData3);
              clientSocket.emit('force_update_read_status', targetedData3);
              clientSocket.emit('message_read', targetedData3);
            }, 200);
          }
        }
        
        console.log('🔴 CRITICAL FIX: Broadcast complete - message read events sent to all clients');
      }
    } catch (socketError) {
      console.error('Socket.IO error:', socketError);
      // Continue with the request even if Socket.IO fails
    }

    return NextResponse.json({ 
      success: true, 
      messagesMarkedAsRead: result.count,
      // CRITICAL FIX: Include the otherUserId in the response
      // This allows the socket service to use it for broadcasting events
      otherUserId: otherUserId
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return new NextResponse(`Internal Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}
