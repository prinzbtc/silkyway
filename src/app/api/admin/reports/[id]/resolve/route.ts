import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

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

    // Get report details with related listing
    const report = await prisma.report.findUnique({
      // Properly await the params object before destructuring
      const params = await context.params;
      const id = params.id;
      where: { id: id },
      include: {
        listing: {
          include: {
            user: true
          }
        },
        reporter: true
      },
    });

    if (!report) {
      return new NextResponse('Report not found', { status: 404 });
    }

    if (report.status !== 'pending') {
      return new NextResponse('Report is not in pending state', { status: 400 });
    }

    // Start a transaction to update report and related entities
    const updatedReport = await prisma.$transaction(async (tx) => {
      // Update report status
      const report = await tx.report.update({
        where: { id: id },
        data: {
          status: 'resolved',
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

      // Update listing status if this is a listing report
      if (report.type === 'listing') {
        await tx.listing.update({
          where: { id: report.listingId },
          data: {
            status: 'inactive',
          },
        });
      }

      return report;
    });

    return NextResponse.json(updatedReport);
  } catch (error) {
    console.error('Error resolving report:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
