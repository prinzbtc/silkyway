import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin';
import prisma from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin authentication
    const authenticatedAdmin = await verifyAdminSession();
    if (!authenticatedAdmin) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (authenticatedAdmin.adminRole !== 'super_admin') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const data = await request.json();
    const { role } = data;

    if (!role || !['super_admin', 'admin', 'moderator'].includes(role)) {
      return new NextResponse('Invalid role', { status: 400 });
    }

    // Get admin to update
    const targetAdmin = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!targetAdmin) {
      return new NextResponse('Admin not found', { status: 404 });
    }

    // Cannot modify super admin
    if (targetAdmin.adminRole === 'super_admin' && role !== 'super_admin') {
      return new NextResponse('Cannot modify super admin role', { status: 400 });
    }

    // Update admin role
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        adminRole: role,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating admin role:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
