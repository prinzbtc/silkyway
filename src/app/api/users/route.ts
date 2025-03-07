import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { regions } from '@/components/search/RegionSelect';

export async function GET(request: NextRequest) {
  console.log('User API route called');
  try {
    // Extract search parameters
    const searchParams = request.nextUrl.searchParams;
    
    // User search parameters
    const q = searchParams.get('q') || undefined; // Username search
    const region = searchParams.get('region') || undefined;
    const sellerLocation = searchParams.get('sellerLocation') || undefined;

    console.log('User Search Parameters:', {
      q,
      region,
      sellerLocation
    });

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
      let locationFilter: string[] = [];
      if (sellerLocation) {
        try {
          const parsedLocation = JSON.parse(sellerLocation);
          if (Array.isArray(parsedLocation)) {
            locationFilter = parsedLocation.map(loc => loc.value);
            console.log('Parsed Location Filter (array):', locationFilter);
          } else if (parsedLocation?.value) {
            locationFilter = [parsedLocation.value];
            console.log('Parsed Location Filter (single):', locationFilter);
          }
        } catch (error) {
          console.error('Error parsing sellerLocation:', error);
          locationFilter = sellerLocation ? [sellerLocation] : [];
          console.log('Fallback Location Filter:', locationFilter);
        }
      }

      // If a region is specified, get the countries in that region
      let countriesInRegion: string[] = [];
      if (region) {
        const regionData = regions.find(r => r.value === region);
        if (regionData) {
          countriesInRegion = regionData.countries || [];
          console.log('Region Data:', {
            region,
            countriesCount: countriesInRegion.length
          });
        }
      }

      // Combine all location filters
      const uniqueFilters = Array.from(new Set([...locationFilter, ...countriesInRegion]));
      
      if (uniqueFilters.length > 0) {
        console.log('All location filters:', uniqueFilters);
        
        // Create OR conditions for each country code
        const locationOR = uniqueFilters.map(code => ({
          OR: [
            { location: { startsWith: `${code}|` } },
            { location: { equals: code } }
          ]
        }));
        
        // Add the location conditions to the where clause
        if (locationOR.length === 1) {
          // If only one location, use its OR condition directly
          whereClause.OR = locationOR[0].OR;
        } else if (locationOR.length > 1) {
          // If multiple locations, each location is an OR condition
          whereClause.OR = locationOR;
        }
        
        // Debug: Test a direct query with the first location filter to verify it works
        if (uniqueFilters.length > 0) {
          const testCode = uniqueFilters[0];
          const testUsers = await prisma.user.findMany({
            where: {
              OR: [
                { location: { startsWith: `${testCode}|` } },
                { location: { equals: testCode } }
              ]
            },
            select: { id: true, username: true, location: true },
            take: 5
          });
          console.log(`Test query for location '${testCode}' found ${testUsers.length} users:`, testUsers);
        }
        
        console.log('Location Conditions:', JSON.stringify(whereClause.OR, null, 2));
      }
    }

    console.log('Final Where Clause:', JSON.stringify(whereClause, null, 2));

    // Debug: Check all users in the database to verify data
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        location: true
      },
      take: 5 // Just get a few for debugging
    });
    console.log('Sample users in database:', allUsers);
    
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

    console.log(`Fetched ${users.length} users with filters:`, JSON.stringify(whereClause, null, 2));

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
  } catch (error: unknown) {
    console.error('Error searching users:', error);
    
    // Provide more detailed error information
    let errorMessage = 'Failed to search users';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = `${errorMessage}: ${error.message}`;
      console.error('Error stack:', error.stack);
      
      // Check for Prisma-specific errors
      const prismaError = error as any;
      if (prismaError.code) {
        console.error('Error code:', prismaError.code);
        if (prismaError.code === 'P2022') {
          errorMessage = 'Invalid query field';
          statusCode = 400;
        } else if (prismaError.code === 'P2009') {
          errorMessage = 'Invalid query argument';
          statusCode = 400;
        } else if (prismaError.code === 'P2021') {
          errorMessage = 'The table does not exist in the current database';
          statusCode = 500;
        }
      }
    }
    
    // Log the full error details for debugging
    console.error('Detailed error:', {
      message: errorMessage,
      originalError: error,
      statusCode
    });
    
    return NextResponse.json(
      { error: errorMessage }, 
      { status: statusCode }
    );
  }
}
