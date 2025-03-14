import { Server as NetServer } from 'http';
import { NextApiRequest } from 'next';
import { NextApiResponse } from 'next';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { getSession } from './auth/session';
import { setSocketIOServer } from './socketio-server';

// Define interface for message data
interface MessageData {
  conversationId: string;
  [key: string]: any;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export type NextApiResponseWithSocket = NextApiResponse & {
  socket: {
    server: NetServer & {
      io?: SocketIOServer;
    };
  };
};

// Helper function to set up socket event handlers
function setupSocketEventHandlers(socket: Socket, userId: string, io: SocketIOServer): void {
  // Handle joining a conversation
  socket.on('join-conversation', (conversationId: string) => {
    console.log(`Socket ${socket.id} joining conversation room: conversation:${conversationId}`);
    socket.join(`conversation:${conversationId}`);
  });
  
  // Handle leaving a conversation
  socket.on('leave-conversation', (conversationId: string) => {
    console.log(`Socket ${socket.id} leaving conversation room: conversation:${conversationId}`);
    socket.leave(`conversation:${conversationId}`);
  });
  
  // Handle joining a user room
  socket.on('join-user', (userId: string) => {
    console.log(`Socket ${socket.id} joining user room: user:${userId}`);
    socket.join(`user:${userId}`);
  });
  
  // Handle leaving a user room
  socket.on('leave-user', (userId: string) => {
    console.log(`Socket ${socket.id} leaving user room: user:${userId}`);
    socket.leave(`user:${userId}`);
  });
  
  // Handle sending a message
  socket.on('send-message', (data: MessageData) => {
    console.log(`Socket ${socket.id} sending message to conversation ${data.conversationId}`);
    
    // Forward to the conversation room
    socket.to(`conversation:${data.conversationId}`).emit('new-message', data);
    
    // Also emit to the receiver's user room to ensure delivery
    if (data.receiverId) {
      console.log(`Also sending message directly to receiver ${data.receiverId}`);
      socket.to(`user:${data.receiverId}`).emit('new-message', data);
      
      // Broadcast to all sockets in the user's room to ensure delivery
      io.to(`user:${data.receiverId}`).emit('new-message', data);
    }
    
    // Broadcast to all sockets in the conversation room for redundancy
    io.to(`conversation:${data.conversationId}`).emit('new-message', data);
  });
  
  // Handle message read status
  socket.on('message-read', (data: MessageData) => {
    socket.to(`conversation:${data.conversationId}`).emit('message-read', data);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
}

export const initSocketIO = async (
  req: NextApiRequest,
  res: NextApiResponseWithSocket
) => {
  // Check if socket.io is already initialized
  if (!res.socket.server.io) {
    console.log('Initializing Socket.IO server from Pages Router API...');
    
    // Create a new Socket.IO server with improved configuration
    const io = new SocketIOServer(res.socket.server, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['polling', 'websocket'],
      pingTimeout: 60000,
      pingInterval: 25000,
      connectTimeout: 10000,
    });
    
    // Store the Socket.IO server instance
    res.socket.server.io = io;
    
    // Also store it in our global variable for access from App Router routes
    setSocketIOServer(io);
    
    // Log confirmation of initialization
    console.log('Socket.IO server initialized and stored globally');

    // Error handling for the Socket.IO server
    io.engine.on('connection_error', (err) => {
      console.error('Socket.IO connection error:', err);
    });
    
    // Socket.IO connection handler
    io.on('connection', async (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      // Set up error handling for this socket
      socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
        // Don't disconnect on error to prevent disruption
      });
      
      // Get auth token from handshake query or headers
      const authToken = socket.handshake.auth.token || 
                       socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      // Get userId from handshake auth
      let userId = socket.handshake.auth.userId;
      
      // Skip strict authentication in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('Development mode: Using simplified authentication');
        
        // Use the userId from the handshake if available, or a default
        userId = userId || 'anonymous-dev-user';
        
        // Join the user's room
        socket.join(`user:${userId}`);
        
        // Store userId in socket data for later use
        socket.data.userId = userId;
        
        // Set up event handlers
        setupSocketEventHandlers(socket, userId, io);
        return;
      }
      
      // In production, require proper authentication
      try {
        // TODO: Implement proper token validation here
        // For now, just use the userId from handshake in development
        if (!userId) {
          console.log('No userId provided, disconnecting socket');
          socket.disconnect();
          return;
        }
        
        // Join the user's room
        socket.join(`user:${userId}`);
        
        // Store userId in socket data
        socket.data.userId = userId;
        
        // Set up event handlers
        setupSocketEventHandlers(socket, userId, io);
      } catch (error) {
        console.error('Authentication error:', error);
        // Send a specific error message before disconnecting
        socket.emit('auth_error', { message: 'Authentication failed' });
        socket.disconnect();
      }
    });
  }
  
  return res.socket.server.io;
};

// Helper function to emit events to specific users
export const emitToUser = (
  io: SocketIOServer,
  userId: string,
  event: string,
  data: any
) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

// Helper function to emit events to specific conversations
export const emitToConversation = (
  io: SocketIOServer,
  conversationId: string,
  event: string,
  data: any
) => {
  if (io) {
    io.to(`conversation:${conversationId}`).emit(event, data);
  }
};
