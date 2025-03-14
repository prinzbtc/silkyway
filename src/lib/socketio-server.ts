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
    
    // Try to initialize from the global Next.js server if available
    try {
      // This is a workaround to access the global Next.js server
      // It may not work in all environments, but it's worth trying
      const { default: http } = require('http');
      const server = http.getServer();
      if (server) {
        console.log('Found global HTTP server, initializing Socket.IO');
        return initSocketIOServer(server);
      }
    } catch (error) {
      console.error('Failed to initialize Socket.IO from global server:', error);
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
