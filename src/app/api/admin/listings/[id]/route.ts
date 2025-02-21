import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

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

    const listing = await prisma.listing.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        reports: {
          include: {
            reporter: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            favorites: true,
            offers: true,
            reports: true,
          },
        },
      },
    });

    if (!listing) {
      return new NextResponse('Listing not found', { status: 404 });
    }

    return NextResponse.json(listing);
  } catch (error) {
    console.error('Error fetching listing:', error);
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

    const { title, description, price, category, condition, status } =
      await request.json();

    const updatedListing = await prisma.listing.update({
      where: { id: params.id },
      data: {
        title,
        description,
        price,
        category,
        condition,
        status,
      },
      include: {
        user: true,
        reports: {
          include: {
            reporter: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            favorites: true,
            offers: true,
            reports: true,
          },
        },
      },
    });

    return NextResponse.json(updatedListing);
  } catch (error) {
    console.error('Error updating listing:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin session
    const currentAdmin = await verifyAdminSession();
    if (!currentAdmin || !['super_admin', 'admin'].includes(currentAdmin.adminRole || '')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Delete listing and all related data
    await prisma.listing.delete({
      where: { id: params.id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting listing:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
