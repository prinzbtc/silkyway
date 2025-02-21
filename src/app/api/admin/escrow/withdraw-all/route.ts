import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin';
import prisma from '@/lib/prisma';
import { EscrowService } from '@/services/EscrowService';

export async function POST() {
  try {
    // Check admin authentication
    const admin = await verifyAdminSession();
    if (!admin) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (admin.adminRole !== 'super_admin') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get all pending escrows
    const pendingEscrows = await prisma.escrow.findMany({
      where: {
        status: 'pending',
      },
      include: {
        transaction: true,
      },
    });

    if (pendingEscrows.length === 0) {
      return new NextResponse('No pending escrows found', { status: 400 });
    }

    // Withdraw funds to treasury for each escrow
    const escrowService = new EscrowService();
    for (const escrow of pendingEscrows) {
      await escrowService.releaseFundsToSeller(escrow.id);
    }

    // Update all escrow statuses
    await prisma.$transaction(
      pendingEscrows.map((escrow) =>
        prisma.escrow.update({
          where: { id: escrow.id },
          data: {
            status: 'completed',
          },
        })
      )
    );

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error('Error withdrawing funds:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
