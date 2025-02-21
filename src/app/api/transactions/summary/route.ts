import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Get current session
    const session = await getSession();
    if (!session?.user?.id || session.user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check cache
    const cacheKey = `transactions:summary:${userId}`;
    const cached = await redis.get<string>(cacheKey);
    if (cached) {
      return NextResponse.json(JSON.parse(cached));
    }

    // Get sales summary
    const sales = await prisma.transaction.aggregate({
      where: {
        sellerId: userId,
        status: 'COMPLETED',
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    // Get purchases summary
    const purchases = await prisma.transaction.aggregate({
      where: {
        buyerId: userId,
        status: 'COMPLETED',
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    const summary = {
      totalSales: sales._sum.amount || 0,
      totalSalesCount: sales._count,
      totalPurchases: purchases._sum.amount || 0,
      totalPurchasesCount: purchases._count,
    };

    // Cache results
    await redis.set(cacheKey, JSON.stringify(summary), {
      ex: 300, // Cache for 5 minutes
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction summary' },
      { status: 500 }
    );
  }
}
