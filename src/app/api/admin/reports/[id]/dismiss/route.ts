import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin session
    const currentAdmin = await verifyAdminSession();
    if (!currentAdmin || !['super_admin', 'admin'].includes(currentAdmin.adminRole || '')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get report details
    const report = await prisma.report.findUnique({
      where: { id: params.id },
    });

    if (!report) {
      return new NextResponse('Report not found', { status: 404 });
    }

    if (report.status !== 'pending') {
      return new NextResponse('Report is not in pending state', { status: 400 });
    }

    // Update report status
    const updatedReport = await prisma.report.update({
      where: { id: params.id },
      data: {
        status: 'dismissed',
        updatedAt: new Date(),
      },
      include: {
        reporter: true,
        listing: {
          include: {
            user: true,
          },
        },
      },
    });

    return NextResponse.json(updatedReport);
  } catch (error) {
    console.error('Error dismissing report:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
