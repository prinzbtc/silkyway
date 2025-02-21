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

    // Get all reports with their related data
    const reports = await prisma.report.findMany({
      orderBy: {
        createdAt: 'desc',
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

    // Calculate statistics
    const stats = {
      total: reports.length,
      pending: reports.filter((r) => r.status === 'pending').length,
      resolved: reports.filter((r) => r.status === 'resolved').length,
      dismissed: reports.filter((r) => r.status === 'dismissed').length,
      listingReports: reports.filter((r) => r.type === 'listing').length,
    };

    return NextResponse.json({ reports, stats });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
