import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Verify admin session
    const currentAdmin = await verifyAdminSession();
    if (!currentAdmin || !['super_admin', 'admin'].includes(currentAdmin.adminRole || '')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    
    // Get all transactions
    const transactions = await prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: true,
        seller: true,
        listing: true,
        escrow: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    // Calculate statistics
    const stats = {
      total: transactions.length,
      completed: transactions.filter((t) => t.status === 'completed').length,
      pending: transactions.filter((t) => t.status === 'pending').length,
      cancelled: transactions.filter((t) => t.status === 'cancelled').length,
      totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
      totalFees: transactions.reduce((sum, t) => sum + (t.protectionFee || 0), 0),
    };

    return NextResponse.json({ transactions, stats });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
