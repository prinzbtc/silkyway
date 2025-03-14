import { NextApiRequest } from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { Server as NetServer } from 'http';
import { NextApiResponse } from 'next';
import { getSessionFromApiRequest } from '@/lib/auth/api-helpers';
import prisma from '@/lib/prisma';

export type NextApiResponseWithSocket = NextApiResponse & {
  socket: {
    server: NetServer & {
      io?: SocketIOServer;
    };
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  // Check if Socket.IO server is already initialized
  if (res.socket.server.io) {
    console.log('Socket.IO already running');
    res.status(200).end();
    return;
  }
  
  console.log('Initializing Socket.IO server...');
  
  // During migration, temporarily skip authentication check for initialization
  // Authentication will be handled on socket connection instead

  // Initialize Socket.IO server
  const io = new SocketIOServer(res.socket.server, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXTAUTH_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Store the Socket.IO server instance
  res.socket.server.io = io;

  // Set up authentication middleware
  io.use(async (socket, next) => {
    try {
      // Get the session cookie from handshake headers
      const cookies = socket.handshake.headers.cookie;
      if (!cookies) {
        return next(new Error('Authentication error: No cookies provided'));
      }
      
      // Parse the session cookie
      const sessionCookie = cookies
        .split(';')
        .find(c => c.trim().startsWith('session='));
        
      if (!sessionCookie) {
        return next(new Error('Authentication error: No session cookie found'));
      }
      
      // Extract the cookie value
      const cookieValue = sessionCookie.split('=')[1];
      
      // Parse JWT payload
      try {
        const parts = cookieValue.split('.');
        if (parts.length !== 3) {
          return next(new Error('Authentication error: Invalid JWT format'));
        }
        
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        if (!payload?.user?.id) {
          return next(new Error('Authentication error: Invalid user data in token'));
        }
        
        // Store user ID in socket data
        socket.data.userId = payload.user.id;
        console.log('Socket authenticated for user:', payload.user.id);
        next();
      } catch (parseError) {
        console.error('JWT parsing error:', parseError);
        return next(new Error('Authentication error: Could not parse session token'));
      }
    } catch (error) {
      console.error('Socket authentication error:', error);
      return next(new Error('Authentication error: ' + (error as Error).message));
    }
  });

  // Handle socket connections
  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    console.log(`User connected: ${userId} (Socket ID: ${socket.id})`);

    // Join user's personal room for direct messaging
    socket.join(`user:${userId}`);

    // Handle joining a conversation
    socket.on('join_conversation', async (data) => {
      const { conversationId } = data;
      
      // Verify user has access to this conversation
      try {
        const conversation = await prisma.conversation.findFirst({
          where: {
            id: conversationId,
            OR: [
              { buyerId: userId },
              { sellerId: userId }
            ]
          }
        });

        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found or access denied' });
          return;
        }

        // Join the conversation room
        socket.join(`conversation:${conversationId}`);
        console.log(`User ${userId} joined conversation: ${conversationId}`);
      } catch (error) {
        console.error('Error joining conversation:', error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    // Handle leaving a conversation
    socket.on('leave_conversation', (data) => {
      const { conversationId } = data;
      socket.leave(`conversation:${conversationId}`);
      console.log(`User ${userId} left conversation: ${conversationId}`);
    });

    // Handle sending a message
    socket.on('send_message', async (data, callback) => {
      try {
        const { conversationId, content, attachments, tempId } = data;
        
        // Verify user has access to this conversation
        const conversation = await prisma.conversation.findFirst({
          where: {
            id: conversationId,
            OR: [
              { buyerId: userId },
              { sellerId: userId }
            ]
          },
          select: {
            id: true,
            buyerId: true,
            sellerId: true
          }
        });

        if (!conversation) {
          callback({ success: false, error: 'Conversation not found or access denied' });
          return;
        }

        // Determine the recipient ID
        const receiverId = conversation.buyerId === userId 
          ? conversation.sellerId 
          : conversation.buyerId;

        // Create the message in the database
        const message = await prisma.message.create({
          data: {
            content,
            senderId: userId,
            receiverId,
            conversationId,
            attachments: attachments || [],
            read: false
          }
        });

        // Update the conversation's updatedAt timestamp
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });

        // Prepare the message data for broadcast
        const messageData = {
          ...message,
          tempId // Include the temporary ID for client-side reconciliation
        };

        // Broadcast to the conversation room
        socket.to(`conversation:${conversationId}`).emit('new_message', messageData);
        
        // Also emit to the recipient's user room to ensure delivery
        socket.to(`user:${receiverId}`).emit('new_message', messageData);

        // Send success response to the sender
        callback({ 
          success: true, 
          messageId: message.id 
        });
      } catch (error) {
        console.error('Error sending message:', error);
        callback({ 
          success: false, 
          error: 'Failed to send message' 
        });
      }
    });

    // Handle marking messages as read
    socket.on('mark_messages_read', async (data) => {
      try {
        const { conversationId } = data;
        console.log(`User ${userId} marking messages as read in conversation ${conversationId}`);
        
        // Get the conversation to determine the other user
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: {
            id: true,
            buyerId: true,
            sellerId: true
          }
        });
        
        if (!conversation) {
          console.error(`Conversation ${conversationId} not found`);
          return;
        }
        
        // Determine the sender ID (the other user)
        const senderId = conversation.buyerId === userId 
          ? conversation.sellerId 
          : conversation.buyerId;
        
        // Update messages as read
        const result = await prisma.message.updateMany({
          where: {
            conversationId,
            receiverId: userId,
            read: false
          },
          data: {
            read: true
          }
        });
        
        console.log(`Marked ${result.count} messages as read in conversation ${conversationId}`);

        // Prepare the read notification data
        const readData = {
          conversationId,
          readerId: userId,
          senderId: senderId, // Include the sender ID for better targeting
          timestamp: new Date().toISOString()
        };
        
        // Emit to the conversation room
        socket.to(`conversation:${conversationId}`).emit('message_read', readData);
        
        // Also emit directly to the sender's user room to ensure delivery
        socket.to(`user:${senderId}`).emit('message_read', readData);
        
        // Broadcast to all users in the conversation (including the current user)
        io.to(`conversation:${conversationId}`).emit('message_read', readData);
        
        // Also emit directly to both users to ensure delivery
        io.to(`user:${senderId}`).emit('message_read', readData);
        io.to(`user:${userId}`).emit('message_read', readData);
        
        console.log(`Emitted message_read event to all users in conversation ${conversationId}`);
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });
    
    // Also handle the hyphenated version for compatibility
    socket.on('mark-messages-read', async (data) => {
      try {
        // Forward to the underscore version for consistent handling
        socket.emit('mark_messages_read', data);
      } catch (error) {
        console.error('Error forwarding mark-messages-read event:', error);
      }
    });

    // Handle typing indicators
    socket.on('user_typing', (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('user_typing', {
        conversationId,
        userId
      });
    });

    socket.on('user_stopped_typing', (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('user_stopped_typing', {
        conversationId,
        userId
      });
    });

    // Handle creating an offer
    socket.on('create_offer', async (data, callback) => {
      try {
        const { conversationId, amount, listingId, tempId } = data;
        
        // Verify user has access to this conversation
        const conversation = await prisma.conversation.findFirst({
          where: {
            id: conversationId,
            OR: [
              { buyerId: userId },
              { sellerId: userId }
            ]
          },
          select: {
            id: true,
            buyerId: true,
            sellerId: true,
            listing: {
              select: {
                id: true,
                userId: true
              }
            }
          }
        });

        if (!conversation) {
          callback({ success: false, error: 'Conversation not found or access denied' });
          return;
        }

        // Determine the recipient ID
        const receiverId = conversation.buyerId === userId 
          ? conversation.sellerId 
          : conversation.buyerId;

        // Create the offer in the database
        const offer = await prisma.offer.create({
          data: {
            amount,
            status: 'pending',
            senderId: userId,
            receiverId,
            listingId
            // Note: conversationId is not part of the Offer model in Prisma schema
          }
        });

        // Prepare the offer data for broadcast
        const offerData = {
          ...offer,
          tempId // Include the temporary ID for client-side reconciliation
        };

        // Broadcast to the conversation room
        socket.to(`conversation:${conversationId}`).emit('offer_created', offerData);
        
        // Also emit to the recipient's user room to ensure delivery
        socket.to(`user:${receiverId}`).emit('offer_created', offerData);

        // Send success response to the sender
        callback({ 
          success: true, 
          offerId: offer.id 
        });
      } catch (error) {
        console.error('Error creating offer:', error);
        callback({ 
          success: false, 
          error: 'Failed to create offer' 
        });
      }
    });

    // Handle updating an offer
    socket.on('update_offer', async (data, callback) => {
      try {
        const { offerId, status } = data;
        
        // Verify user has access to this offer
        const offer = await prisma.offer.findFirst({
          where: {
            id: offerId,
            OR: [
              { senderId: userId },
              { receiverId: userId }
            ]
          },
          select: {
            id: true,
            senderId: true,
            receiverId: true
            // Note: conversationId is not part of the Offer model in Prisma schema
          }
        });

        if (!offer) {
          callback({ success: false, error: 'Offer not found or access denied' });
          return;
        }

        // Update the offer in the database
        const updatedOffer = await prisma.offer.update({
          where: { id: offerId },
          data: { status }
        });

        // Get the conversation associated with the listing
        const conversation = await prisma.conversation.findFirst({
          where: {
            listingId: updatedOffer.listingId,
            OR: [
              { buyerId: updatedOffer.senderId, sellerId: updatedOffer.receiverId },
              { buyerId: updatedOffer.receiverId, sellerId: updatedOffer.senderId }
            ]
          }
        });
        
        // Broadcast to the conversation room if found
        if (conversation) {
          io.to(`conversation:${conversation.id}`).emit('offer_updated', updatedOffer);
        }
        
        // Also emit to both users' rooms to ensure delivery
        io.to(`user:${offer.senderId}`).emit('offer_updated', updatedOffer);
        io.to(`user:${offer.receiverId}`).emit('offer_updated', updatedOffer);

        // Send success response
        callback({ success: true });
      } catch (error) {
        console.error('Error updating offer:', error);
        callback({ 
          success: false, 
          error: 'Failed to update offer' 
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId} (Socket ID: ${socket.id})`);
    });
  });

  console.log('Socket.IO server initialized');
  res.end();
}

export const config = {
  api: {
    bodyParser: false,
  },
};
