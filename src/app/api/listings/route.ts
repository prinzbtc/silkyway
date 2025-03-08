import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { redis, CACHE_TTL, getCacheKey, invalidateListingsCache } from '@/lib/redis';
import { saveFile, validateFile } from '@/lib/uploads';
import type { SessionData } from '@/types/session';
import { MediaType } from '@/types/media';

// Define type for media items
interface MediaItem {
  url: string;
  filename: string;
  originalFilename: string;
  order: number;
  type: string;
  updatedAt: Date;
  userId: string;
  status: string;
  isMainMedia: boolean;
}

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
      console.log('Received listing data:', JSON.stringify(listingData, null, 2));
      
      // Extract media items from the request
      const mediaItems = listingData.media || [];
      console.log('Received media items:', mediaItems);
      
      // Extract URLs from media items
      imageUrls = mediaItems.map((item: any) => item.url);
    } else {
      const formData = await request.formData();
      
      // Extract listing data
      listingData = {
        title: formData.get('title') as string,
        category: formData.get('category') as string,
        brand: formData.get('brand') as string,
        description: formData.get('description') as string,
        price: parseFloat(formData.get('price') as string),
        currency: (formData.get('currency') as string) || 'USD',
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
          await validateFile(image, 'listings');
          
          // Save file to public/uploads/listing
          const { url } = await saveFile(image, 'listings');
          return url;
        })
      );
    }

    // Create image data for database
    let createImageData: MediaItem[];
    
    if (request.headers.get('content-type')?.includes('application/json')) {
      // For JSON requests, use the media items directly
      const mediaItems = listingData.media || [];
      
      // Import the moveFileFromTemp function
      const { moveFileFromTemp } = await import('@/lib/uploads');
      
      // Move files from temp to listings directory
      const updatedMediaItems = await Promise.all(
        mediaItems.map(async (item: any) => {
          // Check if the URL is a temp URL
          if (item.url && item.url.includes('/uploads/temp/')) {
            try {
              // Move the file and get the new URL and thumbnail
              const result = await moveFileFromTemp(item.url, 'listings');
              return { 
                ...item, 
                url: result.url,
                // Update thumbnail if one was returned, otherwise keep the existing one
                thumbnail: result.thumbnail || item.thumbnail 
              };
            } catch (error) {
              console.error('Error moving file:', error);
              return item; // Return original item if move fails
            }
          }
          return item; // Return original item if not a temp URL
        })
      );
      
      createImageData = updatedMediaItems.map((item: any, index: number) => ({
        url: item.url,
        filename: item.filename || item.url.split('/').pop() || `image_${index}`,
        originalFilename: item.filename || item.url.split('/').pop() || `image_${index}`,
        order: item.order !== undefined ? item.order : index,
        type: item.type || 'IMAGE',
        updatedAt: new Date(),
        userId: session.user.id,
        status: 'READY',
        isMainMedia: item.isMain === true,
        thumbnail: item.thumbnail // Include thumbnail URL if available
      }));
      
      // Ensure at least one image is marked as main
      if (!createImageData.some((item: { isMainMedia: boolean }) => item.isMainMedia)) {
        if (createImageData.length > 0) {
          createImageData[0].isMainMedia = true;
        }
      }
    } else {
      // For FormData requests, use the imageUrls array
      createImageData = imageUrls.map((url, index) => ({
        url,
        filename: url.split('/').pop() || `image_${index}`,
        originalFilename: url.split('/').pop() || `image_${index}`,
        order: index,
        type: 'IMAGE',
        updatedAt: new Date(),
        userId: session.user.id,
        status: 'READY',
        isMainMedia: index === 0,
        thumbnail: null // Set to null for images, will be generated for videos during processing
      }));
    }
    
    console.log('Created image data for database:', createImageData);

    // Ensure we have a currency set (default to USD if not provided)
    const currency = listingData.currency || 'USD';

    // Remove delivery fields that should only be in deliveryOptions
    const { 
      noDelivery, 
      postalService, 
      deliveryPrice, 
      media: mediaFromRequest, 
      ...cleanedListingData 
    } = listingData;
    
    // Make sure deliveryOptions is properly structured
    const deliveryOptions = {
      noDelivery: noDelivery === true,
      postalService: postalService === true,
      deliveryPrice: deliveryPrice || 0
    };
    
    // Log delivery options for debugging
    console.log('Delivery options from request:', { noDelivery, postalService, deliveryPrice });
    console.log('Structured delivery options:', deliveryOptions);
    
    console.log('Cleaned listing data:', {
      ...cleanedListingData,
      deliveryOptions,
      mediaCount: createImageData.length
    });
    
    // Create listing with images
    const listing = await prisma.listing.create({
      data: {
        ...cleanedListingData,
        deliveryOptions, // Add the properly structured deliveryOptions
        currency, // Ensure the currency is set
        userId: session.user.id,
        status: 'active',
        media: {
          create: createImageData,
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        media: true,
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
    try {
      console.log('Invalidating listing caches...');
      await invalidateListingsCache('all');
      
      // Also invalidate user-specific caches
      if (session.user.id) {
        // Invalidate all keys related to user listings
        const userListingKeys = await redis.keys(`*${session.user.id}*listings*`);
        if (userListingKeys.length > 0) {
          console.log(`Invalidating ${userListingKeys.length} user listing cache keys:`, userListingKeys);
          await redis.del(...userListingKeys);
        }
        
        // Invalidate dashboard caches
        const dashboardKeys = await redis.keys(`dashboard:*${session.user.id}*`);
        if (dashboardKeys.length > 0) {
          console.log(`Invalidating ${dashboardKeys.length} dashboard cache keys:`, dashboardKeys);
          await redis.del(...dashboardKeys);
        }
      }
      
      // Invalidate latest listings cache specifically
      const latestListingsKeys = await redis.keys('listings:latest:*');
      if (latestListingsKeys.length > 0) {
        console.log(`Invalidating ${latestListingsKeys.length} latest listings cache keys:`, latestListingsKeys);
        await redis.del(...latestListingsKeys);
      }
      
      console.log('Cache invalidation complete');
    } catch (error) {
      console.error('Error invalidating caches:', error);
    }

    // Process media directly instead of calling the API
    try {
      // Import the processMedia function
      const { processMedia } = await import('@/lib/uploads.server');
      const path = await import('path');
      
      // Create an array to store all the processing promises
      const processPromises = [];
      
      // Process each media item with individual error handling
      for (const media of listing.media) {
        const mediaItem = media as any;
        const tempUrl = mediaItem.url;
        const filename = mediaItem.filename;
        const mediaType = mediaItem.type;
        
        // Get the file path
        const filePath = path.default.join(
          process.cwd(),
          'public',
          tempUrl
        );
        
        // Define output directory
        const outputDir = path.default.join(process.cwd(), 'public', 'uploads', 'listings');
        
        console.log(`Processing media ${media.id}: ${filename}`);
        
        // Create a promise for this media item's processing
        const processPromise = (async () => {
          try {
            // Update media status to processing
            await prisma.listingMedia.update({
              where: { id: media.id },
              data: { 
                status: 'PROCESSING',
                updatedAt: new Date()
              }
            });
            
            // Process the media file with timeout
            const processingPromise = processMedia({
              inputPath: filePath,
              outputDir,
              filename,
              mediaType,
            });
            
            // Create a timeout promise
            const timeoutPromise = new Promise<any>((_, reject) => {
              setTimeout(() => {
                reject(new Error(`Processing timed out for media ${media.id}`));
              }, 5 * 60 * 1000); // 5 minute timeout
            });
            
            // Race the processing against the timeout
            const result = await Promise.race([processingPromise, timeoutPromise]);
            
            // Update the media record with processed file info
            await prisma.listingMedia.update({
              where: { id: media.id },
              data: {
                url: result.url,
                thumbnail: result.thumbnail,
                status: result.status,
                updatedAt: new Date(),
              }
            });
            
            console.log(`Successfully processed media ${media.id}`);
            return { id: media.id, success: true };
          } catch (processingError) {
            console.error(`Error processing media ${media.id}:`, processingError);
            
            // Update status to failed
            await prisma.listingMedia.update({
              where: { id: media.id },
              data: { 
                status: 'FAILED',
                updatedAt: new Date()
              }
            });
            
            return { id: media.id, success: false, error: processingError };
          }
        })();
        
        // Add this promise to our array
        processPromises.push(processPromise);
      }
      
      // Wait for all media processing to complete or timeout
      try {
        const results = await Promise.allSettled(processPromises);
        const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
        const failCount = results.length - successCount;
        
        console.log(`Media processing completed: ${successCount} succeeded, ${failCount} failed`);
      } catch (error) {
        console.error('Unexpected error during media processing:', error);
        // Continue even if there's an error with media processing
      }
    } catch (error) {
      console.error('Error setting up media processing:', error);
      // Don't fail the request if media processing fails
    }

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
    const brandParam = searchParams.get('brand') || undefined;
    let brands: string[] = [];
    
    // Parse brand parameter which could be a string or JSON array
    if (brandParam) {
      console.log(`API: Raw brand filter received: ${brandParam}`);
      try {
        // Try to parse as JSON (for array of BrandOption)
        const parsedBrand = JSON.parse(brandParam);
        console.log(`API: Parsed brand data:`, parsedBrand);
        
        // Check if it's an array of brand objects
        if (Array.isArray(parsedBrand)) {
          brands = parsedBrand
            .filter(b => b && typeof b === 'object' && 'value' in b)
            .map(b => b.value);
          console.log(`API: Using multiple brands:`, brands);
        } 
        // Check if it's a single brand object
        else if (parsedBrand && typeof parsedBrand === 'object' && 'value' in parsedBrand) {
          brands = [parsedBrand.value];
          console.log(`API: Using single brand value: ${parsedBrand.value}`);
        }
      } catch (e) {
        // If not JSON, use as-is (for backward compatibility)
        brands = [brandParam];
        console.log(`API: Using brand directly: ${brandParam}`);
      }
      
      // Debug log the final brands array
      console.log(`API: Final brands array for filtering:`, brands);
      
      // Debug: Test query to verify brand filter works independently
      if (process.env.NODE_ENV === 'development' && brands.length > 0) {
        setTimeout(async () => {
          try {
            const testQuery = await prisma.listing.findMany({
              where: {
                OR: brands.map(brand => ({
                  brand: {
                    equals: brand,
                    mode: 'insensitive' as const
                  }
                }))
              },
              take: 5,
              select: { id: true, title: true, brand: true }
            });
            console.log(`DEBUG: Brand filter test query found ${testQuery.length} listings:`, 
              testQuery.map(l => `${l.id}: ${l.title} (${l.brand})`));
          } catch (error) {
            console.error('DEBUG: Error testing brand filter:', error);
          }
        }, 0);
      }
    }
    
    // Log all search params for debugging
    console.log('All search params:', Object.fromEntries(searchParams.entries()));
    const query = searchParams.get('q') || undefined;
    const deliveryOptions = searchParams.get('deliveryOptions') || undefined;
    const limit = parseInt(searchParams.get('limit') || '8', 10);
    const cursor = searchParams.get('cursor') || undefined;
    const createdBy = searchParams.get('createdBy') || undefined;
    const status = searchParams.get('status') || 'active';
    // Handle seller location which could be a JSON string from LocationSelect
    const sellerLocationParam = searchParams.get('sellerLocation');
    let sellerLocations: string[] = [];
    
    if (sellerLocationParam) {
      console.log(`DEBUG: Raw sellerLocation param:`, sellerLocationParam);
      try {
        // Try to parse as JSON (from LocationSelect)
        const locationData = JSON.parse(sellerLocationParam);
        console.log(`DEBUG: Parsed location data:`, locationData);
        
        // Check if it's an array of location objects (multi-select)
        if (Array.isArray(locationData)) {
          sellerLocations = locationData
            .filter(loc => loc && typeof loc === 'object' && 'value' in loc)
            .map(loc => loc.value);
          console.log(`API: Using multiple seller locations:`, sellerLocations);
        } 
        // Check if it's a single location object (backward compatibility)
        else if (locationData && typeof locationData === 'object' && 'value' in locationData) {
          sellerLocations = [locationData.value];
          console.log(`API: Using single seller location value: ${locationData.value}`);
        } else {
          console.log(`API: Invalid location object format:`, locationData);
        }
        
        // DEBUG: Check if there are any users with these locations
        if (process.env.NODE_ENV === 'development' && sellerLocations.length > 0) {
          // This is just for debugging - we'll execute this query separately
          setTimeout(async () => {
            try {
              const usersWithLocation = await prisma.user.findMany({
                where: {
                  OR: sellerLocations.flatMap(location => [
                    // Match exact country code at start of string followed by pipe
                    { location: { startsWith: `${location}|`, mode: 'insensitive' } },
                    // Also match if it's exactly equal to the country code (unlikely but possible)
                    { location: { equals: location, mode: 'insensitive' } }
                  ])
                },
                select: { id: true, location: true }
              });
              console.log(`DEBUG: Found ${usersWithLocation.length} users with locations matching:`, sellerLocations);
              usersWithLocation.forEach(user => {
                console.log(`DEBUG: User ${user.id} has location: ${user.location}`);
              });
            } catch (error) {
              console.error('DEBUG: Error checking users with location:', error);
            }
          }, 0);
        }
      } catch (e) {
        // If not JSON, use as-is (for backward compatibility)
        sellerLocations = [sellerLocationParam];
        console.log(`API: Using seller location directly: ${sellerLocationParam}`);
      }
    }

    // Get user session for personalized recommendations
    const session = await getSession(request);
    const userId = session?.user?.id;

    // Parse delivery options filters
    // We need to check if the parameter exists first, then check its value
    const noDeliveryParam = searchParams.get('noDelivery');
    const postalServiceParam = searchParams.get('postalService');
    const showAllDeliveryParam = searchParams.get('show_all_delivery');
    
    // Check if we have the special flag to show all delivery options
    const forceShowAllDelivery = showAllDeliveryParam === 'true';
    
    // Only set these to true/false if the parameter exists
    // If the parameter doesn't exist, set to undefined to indicate no filtering should be applied
    const noDelivery = noDeliveryParam !== null ? noDeliveryParam === 'true' : undefined;
    const postalService = postalServiceParam !== null ? postalServiceParam === 'true' : undefined;
    
    // Check if we should apply delivery filters at all
    // We should not apply filters if forceShowAllDelivery is true
    const shouldApplyDeliveryFilters = !forceShowAllDelivery && (noDelivery !== undefined || postalService !== undefined);
    
    console.log('Raw delivery params:', { noDeliveryParam, postalServiceParam, showAllDeliveryParam });
    console.log('Parsed delivery filters:', { noDelivery, postalService, forceShowAllDelivery });
    console.log('Will apply delivery filters?', { 
      forceShowAllDelivery,
      applyAnyDeliveryFilters: shouldApplyDeliveryFilters,
      applyNoDeliveryFilter: noDelivery !== undefined, 
      applyPostalServiceFilter: postalService !== undefined 
    });
    
    // If both delivery filters are undefined or forceShowAllDelivery is true, log that we'll show all listings
    if (!shouldApplyDeliveryFilters) {
      console.log('No delivery filters applied - will show ALL listings regardless of delivery options');
      if (forceShowAllDelivery) {
        console.log('FORCED to show all delivery options due to show_all_delivery=true flag');
      }
    }
    
    // Log all search parameters for debugging
    console.log('All search parameters received:', Object.fromEntries(searchParams.entries()));
    console.log('URL that triggered this request:', request.url);
    
    // Log the delivery filter conditions for debugging
    console.log('Delivery filter conditions:', { noDelivery, postalService });
    
    // Log more detailed information about which filter is active
    if (noDelivery) {
      console.log('Filtering for listings with Pickup Only (noDelivery: true)');
      console.log('This will find listings where deliveryOptions.noDelivery = true');
    }
    if (postalService) {
      console.log('Filtering for listings with Postal Service (postalService: true)');
      console.log('This will find listings where deliveryOptions.postalService = true');
    }

    // Log the detailed query conditions for debugging
    console.log('Detailed delivery options query conditions:', JSON.stringify({
      noDelivery: noDelivery ? { path: ['noDelivery'], equals: true } : null,
      postalService: postalService ? { path: ['postalService'], equals: true } : null
    }, null, 2));

    // Construct where clause
    const where: Prisma.ListingWhereInput = {
      status,
      ...(category && { category }),
      ...(createdBy && { userId: createdBy }),
      price: {
        gte: minPrice,
        lte: maxPrice,
      },
      
      // If sellerLocations is specified, filter by user location
      // The location is stored as "value|label|flag" in the database
      ...(sellerLocations.length > 0 && {
        user: {
          OR: sellerLocations.flatMap(location => [
            // Match exact country code at start of string followed by pipe
            { location: { startsWith: `${location}|`, mode: 'insensitive' as const } },
            // Also match if it's exactly equal to the country code (unlikely but possible)
            { location: { equals: location, mode: 'insensitive' as const } }
          ])
        }
      }),
      
      // Debug: Log the sellerLocation filter condition
      ...(sellerLocations.length === 0 && process.env.NODE_ENV === 'development' && {
        // This is just for debugging - doesn't affect the query
        // Adding a comment to indicate no location filter is applied
      }),
      
      // Apply brand filter (case-insensitive)
      ...(brands.length > 0 && { 
        OR: brands.map(brand => ({
          brand: {
            equals: brand,
            mode: 'insensitive' as const // Make the search case-insensitive
          }
        }))
      }),
      
      // Debug: Log when brand filter is applied
      ...(brands.length > 0 && process.env.NODE_ENV === 'development' && {
        // This is just for debugging - doesn't affect the query
        // Adding a comment to indicate brand filter is applied
      }),
      
      // Debug: Test query to verify brand filter works independently
      ...(brands.length > 0 && process.env.NODE_ENV === 'development' && {
        // This is just for debugging - we'll execute this query separately
        // to verify the brand filter works
      }),
      
      // No additional conditions needed
      
      // No additional debug code
      ...(query && {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { brand: { contains: query, mode: 'insensitive' } },
        ] as Prisma.ListingWhereInput[],
      }),
      // Seller location filter is already applied above
      // Handle delivery options filters
      // Only add filters if they are explicitly set (not undefined)
      ...(shouldApplyDeliveryFilters ? {
        AND: [
          // For noDelivery, we want to find listings where noDelivery is true/false based on the filter
          ...(noDelivery !== undefined ? [{
            deliveryOptions: {
              path: ['noDelivery'],
              equals: noDelivery
            }
          }] : []),

          // For postalService, we want to find listings where postalService is true/false based on the filter
          ...(postalService !== undefined ? [{
            deliveryOptions: {
              path: ['postalService'],
              equals: postalService
            }
          }] : [])
        ]
      } : {
        // If no delivery filters are applied, don't add any conditions at all
        // This ensures all listings are returned regardless of their delivery options
      }),
    };
    
    // Log specifically if delivery filters are being applied
    console.log('Delivery filters applied?', shouldApplyDeliveryFilters);
    if (shouldApplyDeliveryFilters) {
      console.log('Applied delivery filters:', { noDelivery, postalService });
    } else {
      console.log('No delivery filters applied - should show ALL listings');
    }
    
    // Log the final where clause for debugging
    console.log('Final where clause:', JSON.stringify(where, null, 2));

    // Base query includes user and favorites count
    const baseQuery = {
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        currency: true,
        media: {
          orderBy: {
            order: 'asc'
          },
          select: {
            id: true,
            url: true,
            type: true,
            thumbnail: true,
            filename: true,
            order: true,
            isMainMedia: true
          }
        },
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
            location: true,
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

    // Determine cache key based on query type and filters
    let cacheKey: string;
    
    if (createdBy) {
      // User-specific listings
      cacheKey = getCacheKey.userListings(createdBy, limit, cursor);
    } else if (type === 'featured') {
      // Featured listings
      cacheKey = getCacheKey.featuredListings(limit, cursor);
    } else if (type === 'recommended' && userId) {
      // Recommended listings for a specific user
      cacheKey = getCacheKey.recommendedListings(userId, limit, cursor);
    } else if (Object.keys(where).length > 0) {
      // Filtered listings
      cacheKey = getCacheKey.filteredListings(where, limit, cursor);
    } else {
      // Default to latest listings
      cacheKey = getCacheKey.latestListings(limit, cursor);
    }

    // Check for cache-busting timestamp parameter
    const timestamp = searchParams.get('_t');
    const forceRefresh = !!timestamp;
    
    // Only use cache for non-user-specific queries and when not forcing refresh
    const shouldUseCache = !createdBy && type !== 'recommended' && !forceRefresh;
    
    console.log('Cache strategy:', { 
      shouldUseCache, 
      cacheKey, 
      hasTimestamp: !!timestamp, 
      createdBy: !!createdBy 
    });
    
    const cached = shouldUseCache ? await redis.get(cacheKey) : null;
    if (cached) {
      console.log(`Using cached data for key: ${cacheKey}`);
      return NextResponse.json(cached);
    }
    
    console.log(`Fetching fresh data for key: ${cacheKey}`);

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

    // Debug the query we're about to execute
    if (process.env.NODE_ENV === 'development') {
      console.log('DEBUG: Executing listing query with where clause:', JSON.stringify(where, null, 2));
      
      // Debug: Check all user locations in the database
      if (sellerLocations.length > 0) {
        setTimeout(async () => {
          try {
            const allUsers = await prisma.user.findMany({
              where: {
                location: { not: null }
              },
              select: { id: true, username: true, location: true }
            });
            
            console.log(`DEBUG: Found ${allUsers.length} users with location data:`);
            allUsers.forEach(user => {
              console.log(`DEBUG: User ${user.username} (${user.id}) has location: ${user.location}`);
            });
            
            // Check if any user matches our filter
            const matchingUsers = allUsers.filter(user => {
              if (sellerLocations.length === 0) return false;
              const locationLower = user.location?.toLowerCase();
              
              return sellerLocations.some(location => 
                locationLower?.startsWith(`${location}|`.toLowerCase()) || 
                locationLower === location.toLowerCase()
              );
            });
            
            console.log(`DEBUG: Found ${matchingUsers.length} users matching locations:`, sellerLocations.length > 0 ? sellerLocations : 'no location');
            matchingUsers.forEach(user => {
              console.log(`DEBUG: Matching user ${user.username} (${user.id}) has location: ${user.location}`);
            });
          } catch (error) {
            console.error('DEBUG: Error checking user locations:', error);
          }
        }, 0);
      }
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

    // Debug the results if we're filtering by location
    if (process.env.NODE_ENV === 'development' && sellerLocations.length > 0) {
      console.log(`DEBUG: Query returned ${listings.length} listings with location filters:`, sellerLocations);
      if (listings.length > 0) {
        console.log('DEBUG: User locations in results:', listings.map(l => l.user?.location || 'no location'));
      }
      
      // Try a direct query with just the location filter to see if it works
      setTimeout(async () => {
        try {
          // Get all listings with users who have the specified location
          const testQuery = await prisma.listing.findMany({
            where: {
              user: {
                OR: sellerLocations.flatMap(location => [
                  // Match exact country code at start of string followed by pipe
                  { location: { startsWith: `${location}|`, mode: 'insensitive' as const } },
                  // Also match if it's exactly equal to the country code (unlikely but possible)
                  { location: { equals: location, mode: 'insensitive' as const } }
                ])
              }
            },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  location: true
                }
              }
            }
          });
          
          console.log(`DEBUG: Direct location query found ${testQuery.length} listings`);
          if (testQuery.length > 0) {
            console.log('DEBUG: Direct query results:', testQuery.map(l => ({
              listingId: l.id,
              userId: l.userId,
              username: l.user?.username || 'unknown',
              location: l.user?.location || 'unknown'
            })));
          } else {
            console.log('DEBUG: No listings found with direct location query');
          }
        } catch (error) {
          console.error('DEBUG: Error in direct location query:', error);
        }
      }, 0);
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

    // Cache the response only if it's not user-specific and not a force refresh
    if (!createdBy && (type !== 'recommended' || userId) && !forceRefresh) {
      console.log(`Caching response for key: ${cacheKey}`);
      await redis.set(cacheKey, response, {
        ex: type === 'featured'
          ? CACHE_TTL.FEATURED_LISTINGS
          : type === 'latest'
          ? CACHE_TTL.LATEST_LISTINGS
          : CACHE_TTL.RECOMMENDED_LISTINGS,
      });
    } else {
      console.log(`Not caching response for key: ${cacheKey} (user-specific or force refresh)`);
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

    let listingId: string;
    let title: string;
    let category: string;
    let brand: string;
    let description: string;
    let price: number;
    let deliveryOptions: any;
    let existingImages: any[] = [];
    let newImages: File[] = [];
    let mediaItems: any[] = [];
    
    // Handle both JSON and FormData requests
    if (request.headers.get('content-type')?.includes('application/json')) {
      // For JSON requests
      const listingData = await request.json();
      listingId = listingData.id;
      title = listingData.title;
      category = listingData.category;
      brand = listingData.brand;
      description = listingData.description;
      price = listingData.price;
      deliveryOptions = listingData.deliveryOptions;
      existingImages = listingData.existingImages || [];
      mediaItems = listingData.media || [];
      
      console.log('Received listing update data:', {
        id: listingId,
        title,
        mediaCount: mediaItems.length,
        existingImagesCount: existingImages.length
      });
    } else {
      // For FormData requests
      const formData = await request.formData();
      listingId = formData.get('id') as string;
      title = formData.get('title') as string;
      category = formData.get('category') as string;
      brand = formData.get('brand') as string;
      description = formData.get('description') as string;
      price = parseFloat(formData.get('price') as string);
      deliveryOptions = JSON.parse(formData.get('deliveryOptions') as string);
      existingImages = JSON.parse(formData.get('existingImages') as string || '[]');
      
      // Get new images from FormData
      for (let i = 0; formData.get(`image${i}`); i++) {
        newImages.push(formData.get(`image${i}`) as File);
      }
    }

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

    // Process media items
    let createImageData: MediaItem[] = [];
    
    if (request.headers.get('content-type')?.includes('application/json') && mediaItems.length > 0) {
      // Import the moveFileFromTemp function
      const { moveFileFromTemp } = await import('@/lib/uploads');
      
      // Move files from temp to listings directory
      const updatedMediaItems = await Promise.all(
        mediaItems.map(async (item: any) => {
          // Check if the URL is a temp URL
          if (item.url && item.url.includes('/uploads/temp/')) {
            try {
              // Move the file and get the new URL and thumbnail
              const result = await moveFileFromTemp(item.url, 'listings');
              return { 
                ...item, 
                url: result.url,
                // Update thumbnail if one was returned, otherwise keep the existing one
                thumbnail: result.thumbnail || item.thumbnail 
              };
            } catch (error) {
              console.error('Error moving file:', error);
              return item; // Return original item if move fails
            }
          }
          return item; // Return original item if not a temp URL
        })
      );
      
      createImageData = updatedMediaItems
        .filter((item: any) => !item.id || (item.id && item.id.startsWith('temp-'))) // Only include new items
        .map((item: any, index: number) => ({
          url: item.url,
          filename: item.filename || item.url.split('/').pop() || `image_${index}`,
          originalFilename: item.filename || item.url.split('/').pop() || `image_${index}`,
          order: item.order !== undefined ? item.order : index,
          type: item.type || 'IMAGE',
          updatedAt: new Date(),
          userId: session.user.id,
          status: 'READY',
          isMainMedia: item.isMain === true,
          thumbnail: item.thumbnail // Include thumbnail URL if available
        }));
    } else if (newImages.length > 0) {
      // Upload new images from FormData
      const newImageUrls = await Promise.all(
        newImages.map(async (image) => {
          // Validate and save listing image
          await validateFile(image, 'listings');
          const { url } = await saveFile(image, 'listings');
          return url;
        })
      );

      // Create image URLs with filename and order
      createImageData = newImageUrls.map((url, index) => ({
        url,
        filename: url.split('/').pop() || `image_${index}`,
        originalFilename: url.split('/').pop() || `image_${index}`,
        order: index,
        type: 'IMAGE',
        updatedAt: new Date(),
        userId: session.user.id,
        status: 'READY',
        isMainMedia: index === 0,
        thumbnail: null // Set to null for images, will be generated for videos during processing
      }));
    }

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
        media: {
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
        media: true,
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

    // Process newly added media directly
    if (createImageData && createImageData.length > 0) {
      try {
        // Import the processMedia function
        const { processMedia } = await import('@/lib/uploads.server');
        const path = await import('path');
        
        // Get the newly created media items
        const newMediaItems = await prisma.listingMedia.findMany({
          where: {
            listingId: listingId,
            createdAt: {
              gte: new Date(Date.now() - 60000) // Media created in the last minute
            }
          }
        });

        const processPromises = newMediaItems.map(async (media) => {
          const mediaItem = media as any;
          const tempUrl = mediaItem.url;
          const filename = mediaItem.filename;
          const mediaType = mediaItem.type;
          
          // Get the file path
          const filePath = path.default.join(
            process.cwd(),
            'public',
            tempUrl
          );
          
          // Define output directory
          const outputDir = path.default.join(process.cwd(), 'public', 'uploads', 'listings');
          
          console.log(`Processing media ${media.id}: ${filename}`);
          
          try {
            // Update media status to processing
            await prisma.listingMedia.update({
              where: { id: media.id },
              data: { 
                status: 'PROCESSING',
                updatedAt: new Date()
              }
            });
            
            // Process the media file
            const result = await processMedia({
              inputPath: filePath,
              outputDir,
              filename,
              mediaType,
            });
            
            // Update the media record with processed file info
            await prisma.listingMedia.update({
              where: { id: media.id },
              data: {
                url: result.url,
                thumbnail: result.thumbnail,
                status: result.status,
                updatedAt: new Date(),
              }
            });
            
            console.log(`Successfully processed media ${media.id}`);
          } catch (processingError) {
            console.error(`Error processing media ${media.id}:`, processingError);
            
            // Update status to failed
            await prisma.listingMedia.update({
              where: { id: media.id },
              data: { 
                status: 'FAILED',
                updatedAt: new Date()
              }
            });
          }
        });
        
        // Wait for all media processing to complete
        try {
          await Promise.all(processPromises);
          console.log('All media processing completed successfully');
        } catch (error) {
          console.error('Error processing media files:', error);
          // Continue even if there's an error with media processing
        }
      } catch (error) {
        console.error('Error processing media:', error);
        // Don't fail the request if media processing fails
      }
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