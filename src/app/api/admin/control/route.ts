import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Verify admin session
    const currentAdmin = await verifyAdminSession();
    if (!currentAdmin || currentAdmin.adminRole !== 'super_admin') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get all admins with their roles and permissions
    const admins = await prisma.user.findMany({
      where: {
        OR: [
          { adminRole: 'super_admin' },
          { adminRole: 'admin' },
          { adminRole: 'moderator' },
        ],
      },
      orderBy: {
        adminSince: 'desc',
      },
    });

    // Calculate statistics
    const stats = {
      totalAdmins: admins.length,
      superAdmins: admins.filter((a) => a.adminRole === 'super_admin').length,
      admins: admins.filter((a) => a.adminRole === 'admin').length,
      moderators: admins.filter((a) => a.adminRole === 'moderator').length,
    };

    return NextResponse.json({ admins, stats });
  } catch (error) {
    console.error('Error fetching admins:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Verify admin session
    const currentAdmin = await verifyAdminSession();
    if (!currentAdmin || currentAdmin.adminRole !== 'super_admin') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const data = await request.json();
    const { walletAddress, role } = data;

    if (!walletAddress) {
      return new NextResponse('Wallet address is required', { status: 400 });
    }

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    // Check if user is already an admin
    if (user.adminRole) {
      return new NextResponse('User is already an admin', { status: 400 });
    }

    // Update user to admin
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        adminRole: role || 'admin',
        adminSince: new Date(),
        notificationPreferences: {
          adminPermissions: ['manage_users', 'manage_listings', 'manage_reports'],
        },
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error adding admin:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
