import { Server as SocketIOServer } from 'socket.io';
import { Server as NetServer } from 'http';

// Global variable to store the Socket.IO server instance
let socketIOServer: SocketIOServer | null = null;

/**
 * Set the Socket.IO server instance
 * @param io The Socket.IO server instance
 */
export function setSocketIOServer(io: SocketIOServer): void {
  socketIOServer = io;
  console.log('Socket.IO server instance stored globally');
  
  // Log all rooms every 10 seconds for debugging
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      const rooms = io.sockets.adapter.rooms;
      console.log('Active Socket.IO rooms:', Array.from(rooms.keys()).filter(room => !room.startsWith('/')));
      console.log('Connected clients:', io.engine.clientsCount);
    }, 10000);
  }
}

/**
 * Initialize Socket.IO server if it doesn't exist
 * @param server HTTP server instance
 * @returns The Socket.IO server instance
 */
export function initSocketIOServer(server: NetServer): SocketIOServer {
  if (!socketIOServer) {
    console.log('Creating new Socket.IO server instance');
    const io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['polling', 'websocket'],
      pingTimeout: 60000,
      pingInterval: 25000,
      connectTimeout: 10000,
      // Increase buffer size for larger message payloads
      maxHttpBufferSize: 5e6, // 5MB
    });
    
    // Set up event handlers for the server with enhanced reliability
    io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      // Track rooms this socket has joined for reconnection handling
      const joinedRooms = new Set<string>();
      
      // Handle client joining a room with enhanced tracking
      socket.on('join-room', (room) => {
        console.log(`Client ${socket.id} joining room: ${room}`);
        socket.join(room);
        joinedRooms.add(room);
        
        // Notify the room that a user has joined
        socket.to(room).emit('user-joined', { socketId: socket.id, room });
        
        // Acknowledge successful room join
        socket.emit('room-joined', { room, success: true });
      });
      
      // Handle client leaving a room
      socket.on('leave-room', (room) => {
        console.log(`Client ${socket.id} leaving room: ${room}`);
        socket.leave(room);
        joinedRooms.delete(room);
      });
      
      // Handle client reconnection
      socket.on('reconnect-rooms', (rooms: string[]) => {
        console.log(`Client ${socket.id} reconnecting to rooms:`, rooms);
        
        // Rejoin all requested rooms
        rooms.forEach(room => {
          socket.join(room);
          joinedRooms.add(room);
          console.log(`Client ${socket.id} rejoined room: ${room}`);
        });
        
        // Acknowledge successful reconnection
        socket.emit('rooms-reconnected', { rooms, success: true });
      });
      
      // Handle client disconnection
      socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
      });
      
      // Handle errors with better logging
      socket.on('error', (error) => {
        console.error(`Socket error for client ${socket.id}:`, error);
        // Notify client of error
        socket.emit('server-error', { message: 'An error occurred with your connection' });
      });
      
      // Handle message delivery confirmation
      socket.on('message-received', (data: { messageId: string, deliveryId: string }) => {
        console.log(`Message delivery confirmed by client ${socket.id}:`, data);
      });
      
      // Handle global message forwarding with enhanced targeting
      socket.on('global-message', (data) => {
        console.log(`Global message from ${socket.id}, target rooms:`, data.targetRooms);
        
        // Forward the message to all clients
        io.emit('global-message', {
          ...data,
          serverTimestamp: Date.now() // Add server timestamp for ordering
        });
      });
      
      // CRITICAL FIX: Handle marking messages as read with enhanced broadcast
      socket.on('mark_messages_read', async (data) => {
        const { conversationId, userId, readerId = userId } = data;
        console.log(`CRITICAL FIX: User ${userId} marked messages as read in conversation ${conversationId}`);
        
        try {
          // Get the conversation to find the other participant
          const prisma = (global as any).prisma;
          if (!prisma) {
            console.error('Prisma client not available');
            return;
          }
          
          const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: {
              buyerId: true,
              sellerId: true,
            },
          });
          
          if (!conversation) {
            console.error(`Conversation ${conversationId} not found`);
            return;
          }
          
          // Determine the other user in the conversation
          const otherUserId = conversation.buyerId === userId 
            ? conversation.sellerId 
            : conversation.buyerId;
          
          // CRITICAL FIX: Create a comprehensive payload with ALL necessary information
          // Define the type to include all properties we'll need
          interface ReadEventData {
            conversationId: string;
            readerId: string;
            senderId: string;
            timestamp: string;
            userId: string;
            otherUserId: string;
            eventId: string;
            forceUpdate: boolean;
            unreadCount?: number; // Make this optional since we'll add it later
          }
          
          const readData: ReadEventData = {
            conversationId,
            readerId: readerId,
            senderId: otherUserId,
            timestamp: new Date().toISOString(),
            // Include additional fields for maximum compatibility
            userId: userId,
            otherUserId: otherUserId,
            // Add a unique ID to ensure clients recognize this as a new event
            eventId: `read_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            // Add forceUpdate flag to ensure UI updates
            forceUpdate: true
          };
          
          console.log(`CRITICAL FIX: Broadcasting message_read event to ALL clients`);
          
          // CRITICAL FIX: Update messages in database to ensure persistence
          try {
            await prisma.message.updateMany({
              where: {
                conversationId: conversationId,
                senderId: otherUserId,
                receiverId: userId,
                read: false
              },
              data: {
                read: true
              }
            });
            console.log(`CRITICAL FIX: Messages marked as read in database`);
            
            // CRITICAL FIX: Get the updated unread count
            const unreadCount = await prisma.message.count({
              where: {
                conversationId: conversationId,
                receiverId: userId,
                read: false
              }
            });
            
            // Add the unread count to the payload
            readData.unreadCount = unreadCount;
            
          } catch (dbError) {
            console.error('Error updating message read status in database:', dbError);
          }
          
          // CRITICAL FIX: Broadcast to ALL connected clients with multiple events
          // This ensures every client receives the event regardless of what events they're listening for
          
          // 1. Standard message_read event
          io.emit('message_read', readData);
          
          // 2. Also target specific rooms for clients that might be filtering events
          io.to(`user:${otherUserId}`).emit('message_read', readData);
          io.to(`user:${userId}`).emit('message_read', readData);
          io.to(`conversation:${conversationId}`).emit('message_read', readData);
          
          // 3. Legacy event name for backward compatibility
          io.emit('messages-read', readData);
          
          // 4. Special event that forces UI updates
          io.emit('force_update_read_status', readData);
          
          // 5. Global event to ensure ALL clients receive it
          // This bypasses any room filtering that might be happening
          io.emit('global-message', {
            type: 'READ_STATUS_UPDATE',
            data: readData,
            targetRooms: ['all'],
            serverTimestamp: Date.now()
          });
          
          // 6. Send individual socket events to ensure delivery
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
          
          console.log(`CRITICAL FIX: Broadcast complete - message read events sent to ALL clients`);
        } catch (error) {
          console.error('Error handling mark_messages_read event:', error);
        }
      });
    });
    
    setSocketIOServer(io);
    return io;
  }
  
  return socketIOServer;
}

/**
 * Get the Socket.IO server instance
 * @returns The Socket.IO server instance or null if not initialized
 */
export function getSocketIOServer(): SocketIOServer | null {
  if (!socketIOServer) {
    console.warn('Socket.IO server requested but not initialized yet');
    
    // In Next.js App Router, we can't reliably access the HTTP server in API routes
    // Instead, we'll just return null and let the application handle this case
    try {
      // For development environments, we might be able to access the server via a different approach
      // but this is not reliable in production or when using App Router
      console.log('Socket.IO server not initialized - this is expected in API routes');
      
      // Return null instead of trying to access a non-existent method
      return null;
    } catch (error) {
      console.error('Error in Socket.IO initialization:', error);
      return null;
    }
  }
  return socketIOServer;
}

/**
 * Helper function to emit to a room with retry logic
 * @param room The room to emit to
 * @param event The event name
 * @param data The data to emit
 * @param maxRetries Maximum number of retry attempts
 * @returns True if emission was successful, false otherwise
 */
export function emitToRoom(room: string, event: string, data: any, maxRetries = 3): boolean {
  if (!socketIOServer) {
    console.error(`Failed to emit ${event} to ${room}: Socket.IO server not initialized`);
    return false;
  }
  
  let success = false;
  let retryCount = 0;
  
  const tryEmit = () => {
    try {
      // Check if the room exists
      const roomExists = socketIOServer?.sockets.adapter.rooms.has(room);
      console.log(`Emitting ${event} to ${room} (attempt ${retryCount + 1}). Room exists: ${roomExists}`);
      
      // Emit to the room
      socketIOServer?.to(room).emit(event, data);
      
      // Also broadcast to everyone to ensure delivery
      // This ensures all clients receive the message even if room membership is inconsistent
      socketIOServer?.emit(event, { room, data });
      
      success = true;
      console.log(`Successfully emitted ${event} to ${room}`);
    } catch (error) {
      console.error(`Error emitting ${event} to ${room}:`, error);
      
      if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(tryEmit, 500 * retryCount); // Exponential backoff
      }
    }
  };
  
  tryEmit();
  return success;
}
