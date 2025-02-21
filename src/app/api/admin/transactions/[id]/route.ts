import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import { TransactionService } from '@/lib/transactions/service';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin session
    const currentAdmin = await verifyAdminSession();
    if (!currentAdmin || !['super_admin', 'admin'].includes(currentAdmin.adminRole || '')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const transactionService = TransactionService.getInstance();
    const transaction = await transactionService.getTransactionById(params.id);

    if (!transaction) {
      return new NextResponse('Transaction not found', { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin session
    const currentAdmin = await verifyAdminSession();
    if (!currentAdmin || !['super_admin', 'admin'].includes(currentAdmin.adminRole || '')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { status } = await request.json();

    const transactionService = TransactionService.getInstance();
    const updatedTransaction = await transactionService.updateTransactionStatus(params.id, status);

    return NextResponse.json(updatedTransaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
