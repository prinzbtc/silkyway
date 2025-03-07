import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { EscrowService } from '@/services/EscrowService';

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    // Verify admin session
    const currentAdmin = await verifyAdminSession();
    if (!currentAdmin || !['super_admin', 'admin'].includes(currentAdmin.adminRole || '')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get escrow details
    const escrow = await prisma.transaction.findUnique({
      // Properly await the params object before destructuring
      const params = await context.params;
      const id = params.id;
      where: { id: id },
      include: {
        escrow: true,
        seller: true,
        buyer: true,
      },
    });

    if (!escrow?.escrow) {
      return new NextResponse('Escrow not found', { status: 404 });
    }

    if (escrow.escrow.status !== 'pending') {
      return new NextResponse('Escrow is not in pending state', { status: 400 });
    }

    // Release funds to seller
    const escrowService = new EscrowService();
    await escrowService.releaseFundsToSeller(escrow.escrow.id);

    // Update escrow and transaction status
    const [updatedTransaction, updatedEscrow] = await prisma.$transaction([
      prisma.transaction.update({
        where: { id: escrow.id },
        data: { status: 'completed' },
        include: {
          escrow: true,
          seller: true,
          buyer: true,
        },
      }),
      prisma.transaction.update({
        where: { id: escrow.escrow.id },
        data: { status: 'completed' },
      }),
    ]);

    return NextResponse.json({
      ...updatedTransaction,
      escrow: updatedEscrow,
    });
  } catch (error) {
    console.error('Error releasing escrow:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
