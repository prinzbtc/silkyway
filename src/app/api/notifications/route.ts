import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { Prisma } from '@prisma/client';

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const cacheKey = `notifications:${userId}`;

  // Try to get from cache
  const cached = await redis.get<{ notifications: any[]; unreadCount: number }>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  // Get from database
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    }),
  ]);

  const response = { notifications, unreadCount };

  // Cache for 5 minutes
  await redis.set(cacheKey, JSON.stringify(response), {
    ex: 300,
  });

  return NextResponse.json(response);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { type, title, content } = body as {
    type: string;
    title: string;
    content: string;
  };

  const notification = await prisma.notification.create({
    data: {
      userId: session.user.id,
      type,
      title,
      content,
    },
  });

  // Clear cache
  await redis.del(`notifications:${session.user.id}`);

  return NextResponse.json(notification);
}
