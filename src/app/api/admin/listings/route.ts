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

    // Get all listings with their related data
    const listings = await prisma.listing.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: true,
        _count: {
          select: {
            favorites: true,
            offers: true,
            reports: true,
          },
        },
      },
    });

    return NextResponse.json(listings);
  } catch (error) {
    console.error('Error fetching listings:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
