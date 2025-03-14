import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { io } from 'socket.io-client';

export async function POST(
  req: Request,
  context: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Extract the notification ID from the params
  const { id } = context.params;
  
  console.log(`Marking notification ${id} as read for user ${session.user.id}`);
  
  const notification = await prisma.notification.update({
    where: {
      id: id,
      userId: session.user.id,
    },
    data: {
      read: true,
    },
  });

  // Clear cache
  await redis.del(`notifications:${session.user.id}`);

  // Send real-time update using Socket.IO
  try {
    // Connect to our Socket.IO server
    const socket = io('http://localhost:3000', {
      path: '/api/socket',
    });

    // Emit the notification read event to the user's room
    socket.emit('notification-read', {
      notificationId: id
    });

    // Disconnect after sending event
    socket.disconnect();
  } catch (socketError) {
    console.error('Socket.IO notification read error:', socketError);
    // Continue even if Socket.IO fails
    // This ensures the notification is marked as read even if real-time updates fail
  }

  return NextResponse.json(notification);
}
