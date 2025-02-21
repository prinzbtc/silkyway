import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { redis, CACHE_TTL, getCacheKey, invalidateListingsCache } from '@/lib/redis';
import { saveFile, validateFile } from '@/lib/uploads';
import type { SessionData } from '@/types/session';

async function getUserFavoritePatterns(userId: string) {
  // Try to get from cache first
  const cacheKey = getCacheKey.userFavorites(userId);
  const cached = await redis.get<{
    categories: string[];
    brands: string[];
  }>(cacheKey);

  if (cached) {
    return cached;
  }

  // If not in cache, fetch from database
  const userFavorites = await prisma.favorite.findMany({
    where: { userId },
    include: {
      listing: true,
    },
  });

  const favoriteCategories = Array.from(
    new Set(userFavorites.map((f) => f.listing.category))
  );
  const favoriteBrands = Array.from(
    new Set(userFavorites.map((f) => f.listing.brand || '').filter(Boolean))
  );

  const patterns = {
    categories: favoriteCategories,
    brands: favoriteBrands,
  };

  // Cache the result
  await redis.set(cacheKey, patterns, {
    ex: CACHE_TTL.USER_FAVORITES,
  });

  return patterns;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let listingData;
    let imageUrls: string[] = [];

    // Check if the request is JSON or FormData
    if (request.headers.get('content-type')?.includes('application/json')) {
      listingData = await request.json();
      imageUrls = listingData.images || [];
    } else {
      const formData = await request.formData();
      
      // Extract listing data
      listingData = {
        title: formData.get('title') as string,
        category: formData.get('category') as string,
        brand: formData.get('brand') as string,
        description: formData.get('description') as string,
        price: parseFloat(formData.get('price') as string),
        deliveryOptions: JSON.parse(formData.get('deliveryOptions') as string),
        condition: 'new', // Required field
      };

      // Get images
      const images: File[] = [];
      for (let i = 0; formData.get(`image${i}`); i++) {
        images.push(formData.get(`image${i}`) as File);
      }

      // Validate and upload images
      imageUrls = await Promise.all(
        images.map(async (image) => {
          // Validate file before saving
          await validateFile(image, 'listing');
          
          // Save file to public/uploads/listing
          const { url } = await saveFile(image, 'listing');
          return url;
        })
      );
    }

    // Create image URLs with filename and order
    const createImageData = imageUrls.map((url, index) => ({
      url,
      filename: url.split('/').pop() || `image_${index}`,
      order: index,
    }));

    // Create listing with images
    const listing = await prisma.listing.create({
      data: {
        ...listingData,
        userId: session.user.id,
        status: 'active',
        images: {
          create: createImageData,
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        images: true,
        category: true,
        condition: true,
        brand: true,
        featured: true,
        status: true,
        deliveryOptions: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Invalidate all listing caches
    await invalidateListingsCache('all');

    return NextResponse.json(listing);
  } catch (error) {
    console.error('Error creating listing:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      type: typeof error,
      stringified: JSON.stringify(error)
    });

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { 
          error: 'Database query failed', 
          code: error.code,
          details: error.message 
        },
        { status: 500 }
      );
    } else if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: 'Failed to create listing', 
          details: error.message 
        },
        { status: 500 }
      );
    } else {
      return NextResponse.json(
        { 
          error: 'Unexpected error occurred', 
          details: String(error) 
        },
        { status: 500 }
      );
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'featured' | 'latest' | 'recommended' | 'price-low' | 'price-high' | 'most-favorited' || 'latest';
    const category = searchParams.get('category') || undefined;
    const minPrice = parseFloat(searchParams.get('minPrice') || '0');
    const maxPrice = parseFloat(searchParams.get('maxPrice') || '1000');
    const brand = searchParams.get('brand') || undefined;
    const query = searchParams.get('q') || undefined;
    const deliveryOptions = searchParams.get('deliveryOptions') || undefined;
    const limit = parseInt(searchParams.get('limit') || '8', 10);
    const cursor = searchParams.get('cursor') || undefined;
    const createdBy = searchParams.get('createdBy') || undefined;
    const status = searchParams.get('status') || 'active';

    // Get user session for personalized recommendations
    const session = await getSession(request);
    const userId = session?.user?.id;

    const noDelivery = searchParams.get('noDelivery') === 'true';
    const handDelivery = searchParams.get('handDelivery') === 'true';
    const postalService = searchParams.get('postalService') === 'true';

    // Construct where clause
    const where: Prisma.ListingWhereInput = {
      status,
      ...(category && { category }),
      ...(createdBy && { userId: createdBy }),
      price: {
        gte: minPrice,
        lte: maxPrice,
      },
      ...(brand && { brand }),
      ...(query && {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          ...(brand ? [{ brand: { contains: query, mode: 'insensitive' as const } }] : []),
        ] as Prisma.ListingWhereInput[],
      }),
      ...(noDelivery || handDelivery || postalService ? {
        deliveryOptions: {
          string_contains: JSON.stringify({
            ...(noDelivery ? { noDelivery: true } : {}),
            ...(handDelivery ? { handDelivery: true } : {}),
            ...(postalService ? { postalService: true } : {}),
          })
        }
      } : {}),
    };

    // Base query includes user and favorites count
    const baseQuery = {
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        images: true,
        category: true,
        condition: true,
        brand: true,
        featured: true,
        status: true,
        deliveryOptions: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            favorites: true,
          },
        },
      },
      take: limit,
    } satisfies Prisma.ListingFindManyArgs;

    // Add cursor-based pagination if cursor is provided
    if (cursor) {
      (baseQuery as any).cursor = {
        id: cursor,
      };
      (baseQuery as any).skip = 1; // Skip the cursor
    }

    // Try to get from cache first (except for user-specific queries)
    const cacheKey = type === 'recommended' && userId
      ? getCacheKey.recommendedListings(userId, limit, cursor)
      : type === 'featured'
      ? getCacheKey.featuredListings(limit, cursor)
      : getCacheKey.latestListings(limit, cursor);

    // Only use cache for non-user-specific queries
    const cached = !createdBy && type !== 'recommended' ? await redis.get(cacheKey) : null;
    if (cached) {
      return NextResponse.json(cached);
    }

    // Determine sort order
    let orderBy: Prisma.ListingOrderByWithRelationInput | Prisma.ListingOrderByWithRelationInput[];
    switch (type) {
      case 'price-low':
        orderBy = { price: 'asc' as const };
        break;
      case 'price-high':
        orderBy = { price: 'desc' as const };
        break;
      case 'most-favorited':
        orderBy = [
          { favorites: { _count: 'desc' as const } },
          { createdAt: 'desc' as const },
        ];
        break;
      default:
        orderBy = { createdAt: 'desc' as const };
    }

    let listings;
    switch (type) {
      case 'featured':
        listings = await prisma.listing.findMany({
          ...baseQuery,
          where: {
            ...where,
            featured: true,
          },
          orderBy,
        });
        break;

      case 'latest':
        listings = await prisma.listing.findMany({
          ...baseQuery,
          where,
          orderBy,
        });
        break;

      case 'recommended':
        if (!userId) {
          // If no user, return latest listings
          listings = await prisma.listing.findMany({
            ...baseQuery,
            where,
            orderBy,
          });
        } else {
          // Get user's favorite categories and brands
          const { categories: favoriteCategories, brands: favoriteBrands } = 
            await getUserFavoritePatterns(userId);

          listings = await prisma.listing.findMany({
            ...baseQuery,
            where: {
              ...where,
              OR: [
                {
                  category: {
                    in: Array.from(favoriteCategories),
                  },
                },
                {
                  brand: {
                    in: Array.from(favoriteBrands),
                  },
                },
              ],
            },
            orderBy: [
              {
                favorites: {
                  _count: 'desc',
                },
              },
              {
                createdAt: 'desc',
              },
            ],
          });

          // If not enough recommended listings, fill with latest listings
          if (listings.length < limit) {
            const remaining = await prisma.listing.findMany({
              ...baseQuery,
              take: limit - listings.length,
              where: {
                status: 'ACTIVE',
                id: {
                  notIn: listings.map((l) => l.id),
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
            });
            listings = [...listings, ...remaining];
          }
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid listing type' },
          { status: 400 }
        );
    }

    // Transform the data to match ListingWithFavorite type
    const transformedListings = listings.map((listing) => ({
      ...listing,
      favoritesCount: listing._count.favorites,
      isFavorite: false, // Will be set by the client
      _count: undefined,
    }));

    // Get the next cursor
    const nextCursor =
      transformedListings.length === limit
        ? transformedListings[transformedListings.length - 1].id
        : undefined;

    const response = {
      listings: transformedListings,
      nextCursor,
    };

    // Cache the response
    if (type !== 'recommended' || userId) {
      await redis.set(cacheKey, response, {
        ex: type === 'featured'
          ? CACHE_TTL.FEATURED_LISTINGS
          : type === 'latest'
          ? CACHE_TTL.LATEST_LISTINGS
          : CACHE_TTL.RECOMMENDED_LISTINGS,
      });
    }

    return NextResponse.json(
      response
    );
  } catch (error) {
    console.error('Listings Fetch Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      type: typeof error,
      stringified: JSON.stringify(error)
    });

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { 
          error: 'Database query failed', 
          code: error.code,
          details: error.message 
        },
        { status: 500 }
      );
    } else if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: 'Failed to fetch listings', 
          details: error.message 
        },
        { status: 500 }
      );
    } else {
      return NextResponse.json(
        { 
          error: 'Unexpected error occurred', 
          details: String(error) 
        },
        { status: 500 }
      );
    }
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const listingId = formData.get('id') as string;

    // Check if user owns the listing
    const existingListing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { userId: true },
    });

    if (!existingListing || existingListing.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Extract listing data
    const title = formData.get('title') as string;
    const category = formData.get('category') as string;
    const brand = formData.get('brand') as string;
    const description = formData.get('description') as string;
    const price = parseFloat(formData.get('price') as string);
    const deliveryOptions = JSON.parse(formData.get('deliveryOptions') as string);

    // Handle existing images
    const existingImages = JSON.parse(formData.get('existingImages') as string || '[]');
    
    // Get new images
    const newImages: File[] = [];
    for (let i = 0; formData.get(`image${i}`); i++) {
      newImages.push(formData.get(`image${i}`) as File);
    }

    // Upload new images
    const newImageUrls = await Promise.all(
      newImages.map(async (image) => {
        // Validate and save listing image
        await validateFile(image, 'listing');
        const { url } = await saveFile(image, 'listing');
        return url;
      })
    );

    // Create image URLs with filename and order
    const createImageData = newImageUrls.map((url, index) => ({
      url,
      filename: url.split('/').pop() || `image_${index}`,
      order: index,
    }));

    // Update listing
    const listing = await prisma.listing.update({
      where: { id: listingId },
      data: {
        title,
        category,
        brand,
        description,
        price,
        deliveryOptions,
        images: {
          create: createImageData,
          ...(existingImages.length > 0 ? { 
            connect: existingImages.map((img: { id: string }) => ({ id: img.id })) 
          } : {})
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        images: true,
        category: true,
        condition: true,
        brand: true,
        featured: true,
        status: true,
        deliveryOptions: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Invalidate all listing caches
    await invalidateListingsCache('all');
    if (session.user.id) {
      await redis.del(getCacheKey.recommendedListings(session.user.id, 10));
    }

    return NextResponse.json(listing);
  } catch (error) {
    console.error('Error updating listing:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      type: typeof error,
      stringified: JSON.stringify(error)
    });

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { 
          error: 'Database query failed', 
          code: error.code,
          details: error.message 
        },
        { status: 500 }
      );
    } else if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: 'Failed to update listing', 
          details: error.message 
        },
        { status: 500 }
      );
    } else {
      return NextResponse.json(
        { 
          error: 'Unexpected error occurred', 
          details: String(error) 
        },
        { status: 500 }
      );
    }
  }
}
