import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin';
import prisma from '@/lib/prisma';

const VALID_PERMISSIONS = [
  'manage_users',
  'manage_listings',
  'manage_transactions',
  'manage_escrow',
  'manage_reports',
  'manage_admins',
];

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin session
    const currentAdmin = await verifyAdminSession();
    if (!currentAdmin || currentAdmin.adminRole !== 'super_admin') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const data = await request.json();
    const { permissions } = data;

    if (!Array.isArray(permissions)) {
      return new NextResponse('Invalid permissions format', { status: 400 });
    }

    // Validate permissions
    const invalidPermissions = permissions.filter(
      (p) => !VALID_PERMISSIONS.includes(p)
    );
    if (invalidPermissions.length > 0) {
      return new NextResponse(
        `Invalid permissions: ${invalidPermissions.join(', ')}`,
        { status: 400 }
      );
    }

    // Get target admin to update
    const targetAdmin = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!targetAdmin) {
      return new NextResponse('Admin not found', { status: 404 });
    }

    // Cannot modify super admin permissions
    if (targetAdmin.adminRole === 'super_admin') {
      return new NextResponse('Cannot modify super admin permissions', {
        status: 400,
      });
    }

    // Update admin permissions by storing them in notificationPreferences
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        notificationPreferences: {
          adminPermissions: permissions
        },
      },
      select: {
        id: true,
        walletAddress: true,
        adminRole: true,
        notificationPreferences: true,
      },
    });

    // Transform the response
    return NextResponse.json({
      ...updatedUser,
      permissions: (updatedUser.notificationPreferences as any)?.adminPermissions || [],
    });
  } catch (error) {
    console.error('Error updating admin permissions:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
