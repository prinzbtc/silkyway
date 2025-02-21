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

    // Get all transactions with escrows
    const transactions = await prisma.transaction.findMany({
      where: {
        escrow: {
          isNot: null,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        escrow: true,
        buyer: true,
        seller: true,
      },
    });

    // Calculate statistics
    const stats = {
      totalEscrows: transactions.length,
      totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
      pendingEscrows: transactions.filter((t) => t.escrow?.status === 'pending').length,
      pendingAmount: transactions
        .filter((t) => t.escrow?.status === 'pending')
        .reduce((sum, t) => sum + t.amount, 0),
    };

    return NextResponse.json({ escrows: transactions, stats });
  } catch (error) {
    console.error('Error fetching escrows:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
