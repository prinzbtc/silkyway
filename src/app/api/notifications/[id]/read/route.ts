import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const notification = await prisma.notification.update({
    where: {
      id: params.id,
      userId: session.user.id,
    },
    data: {
      read: true,
    },
  });

  // Clear cache
  await redis.del(`notifications:${session.user.id}`);

  return NextResponse.json(notification);
}
