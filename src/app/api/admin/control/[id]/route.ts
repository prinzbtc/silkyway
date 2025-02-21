import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

// Delete admin
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin session
    const currentAdmin = await verifyAdminSession();
    if (!currentAdmin || currentAdmin.adminRole !== 'super_admin') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get admin to remove
    const admin = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!admin) {
      return new NextResponse('Admin not found', { status: 404 });
    }

    // Cannot remove super admin
    if (admin.adminRole === 'super_admin') {
      return new NextResponse('Cannot remove super admin', { status: 400 });
    }

    // Remove admin role
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        adminRole: null,
        adminSince: null,
        notificationPreferences: {
          adminPermissions: [],
        },
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error removing admin:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
