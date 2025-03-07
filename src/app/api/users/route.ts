import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Extract search parameters
    const searchParams = request.nextUrl.searchParams;
    
    // User search parameters
    const q = searchParams.get('q') || undefined; // Username search
    const region = searchParams.get('region') || undefined;
    const sellerLocation = searchParams.get('sellerLocation') || undefined;

    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    // Construct where clause for filtering
    const whereClause: any = {};

    // Username search (case-insensitive partial match)
    if (q) {
      whereClause.username = {
        contains: q,
        mode: 'insensitive'
      };
    }

    // Region and location filtering
    if (region || sellerLocation) {
      // Parse sellerLocation if it's a JSON string
      let locationFilter: string | undefined;
      if (sellerLocation) {
        try {
          const parsedLocation = JSON.parse(sellerLocation);
          locationFilter = Array.isArray(parsedLocation) 
            ? parsedLocation[0]?.value 
            : parsedLocation?.value;
        } catch {
          locationFilter = sellerLocation;
        }
      }

      // Location filtering with multiple match strategies
      if (locationFilter) {
        whereClause.OR = [
          { location: { startsWith: `${locationFilter}|` } },
          { location: locationFilter }
        ];
      }
    }

    // Fetch users with pagination
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        username: true,
        avatar: true,
        location: true
      },
      take: limit,
      skip: offset
    });

    // Count total matching users for pagination
    const totalUsers = await prisma.user.count({ where: whereClause });

    return NextResponse.json({
      users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers
      }
    });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json(
      { error: 'Failed to search users' }, 
      { status: 500 }
    );
  }
}
