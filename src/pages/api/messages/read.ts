import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { Server as SocketIOServer } from 'socket.io';
import { Server as NetServer } from 'http';

// Helper function to get session from cookies in NextApiRequest
async function getSessionFromRequest(req: NextApiRequest) {
  const sessionCookie = req.cookies.session;
  if (!sessionCookie) return null;
  
  try {
    // Parse the session cookie
    const payload = JSON.parse(Buffer.from(sessionCookie.split('.')[1], 'base64').toString());
    return payload?.user ? { user: payload.user } : null;
  } catch (error) {
    console.error('Error parsing session:', error);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getSessionFromRequest(req);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const { conversationId } = req.body;

  if (!conversationId) {
    return res.status(400).json({ error: 'Conversation ID is required' });
  }

  try {
    // Verify that the user is a participant in the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { buyerId: true, sellerId: true }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
      return res.status(403).json({ error: 'You do not have access to this conversation' });
    }

    // Mark all messages as read where the user is the receiver
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

    // Notify the other user that messages have been read
    const otherUserId = conversation.buyerId === userId ? conversation.sellerId : conversation.buyerId;
    
    // Access the Socket.IO server instance if it exists
    const io = (res.socket as any)?.server?.io as SocketIOServer;
    if (io) {
      // Emit to the user's room
      io.to(`user:${otherUserId}`).emit('message_read', {
        conversationId,
        readerId: userId
      });
    }

    return res.status(200).json({ success: true, count: result.count });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return res.status(500).json({ error: 'Failed to mark messages as read' });
  }
}
