import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import prisma from "@/lib/prisma"
import { redis, CACHE_TTL, getCacheKey } from "@/lib/redis"
import * as z from "zod"
import { BrandService, type BrandCategories } from "@/lib/brands"
import { categories } from "@/lib/categories"
import type { Category } from "@/lib/categories"

const formSchema = z.object({
  title: z
    .string()
    .min(1, { message: "Title is required" })
    .max(40, { message: "Title must be 40 characters or less" })
    .trim(),
  category: z
    .string({
      required_error: "Category is required",
    })
    .min(1, { message: "Please select a category" }),
  brand: z.string().optional().nullable(),
  description: z
    .string()
    .min(1, { message: "Description is required" })
    .max(500, { message: "Description cannot be longer than 500 characters" }),
  price: z
    .number()
    .min(0.00001, { message: "Price must be at least 0.00001 SOL" })
    .max(2000000, { message: "Price cannot exceed 2,000,000 SOL" }),
  noDelivery: z.boolean().optional(),
  handDelivery: z.boolean().optional(),
  postalService: z.boolean().optional(),
  deliveryPrice: z.number().optional(),
  condition: z.string().min(1, { message: "Condition is required" }),
  existingImages: z
    .array(
      z.object({
        id: z.string(),
        url: z.string(),
      }),
    )
    .optional(),
})

type FormValues = z.infer<typeof formSchema>

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get and validate the ID parameter
    const resolvedParams = await params;
    const id = resolvedParams.id;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: "Invalid listing ID" }, { status: 400 });
    }
    const session = await getSession()

    // Try to get from cache first
    const cacheKey = getCacheKey.listing(id)
    const cached = await redis.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        favorites: true,
        images: {
          orderBy: {
            order: 'asc'
          },
          select: {
            id: true,
            url: true
          }
        },
      },
    })

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 })
    }

    // Check if user has favorited this listing
    const isFavorite = session?.user?.id
      ? await prisma.favorite.findUnique({
          where: {
            userId_listingId: {
              userId: session.user.id,
              listingId: id,
            },
          },
        })
      : null

    const response = {
      ...listing,
      favoritesCount: listing.favorites.length,
      isFavorite: !!isFavorite,
      _count: undefined,
    }

    // Cache the response
    await redis.set(cacheKey, response, {
      ex: CACHE_TTL.LISTING,
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error fetching listing:", error)
    return NextResponse.json({ error: "Failed to fetch listing" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(request)
    const resolvedParams = await params
    const listingId = resolvedParams.id

    // Ensure user is authenticated
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse the request body
    const body = await request.json()

    // Validate the input against the form schema
    const validationResult = formSchema.safeParse(body)
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.errors)
      console.error('Request body:', body)
      return NextResponse.json(
        {
          error: "Invalid input",
          details: validationResult.error.errors,
        },
        { status: 400 },
      )
    }

    const {
      title,
      category,
      brand,
      description,
      price,
      condition,
      noDelivery,
      handDelivery,
      postalService,
      deliveryPrice,
      existingImages,
    } = validationResult.data

    // Check if the listing belongs to the current user
    const existingListing = await prisma.listing.findUnique({
      where: {
        id: listingId,
        userId: session.user.id,
      },
    })

    if (!existingListing) {
      return NextResponse.json({ error: "Listing not found or you do not have permission to edit" }, { status: 404 })
    }

    // If a brand is provided, ensure it exists in the database
    if (brand && category) {
      try {
        // Create brand if it doesn't exist
        const exists = await BrandService.exists(brand, category);
        if (!exists) {
          await BrandService.create(brand, category, session.user.id);
        }
      } catch (error) {
        console.error('Error creating brand:', error);
        return NextResponse.json({ error: 'Failed to create brand' }, { status: 400 });
      }
    }

    // Update the listing
    const updatedListing = await prisma.listing.update({
      where: { id: listingId },
      data: {
        title,
        category,
        brand,
        description,
        price,
        condition,
        deliveryOptions: {
          noDelivery: noDelivery || false,
          handDelivery: handDelivery || false,
          postalService: postalService || false,
          deliveryPrice: deliveryPrice || 0,
        },
      },
    })

    // Handle image updates if needed
    if (existingImages) {
      // Remove existing images not in the new list
      await prisma.listingImage.deleteMany({
        where: {
          listingId,
          id: {
            notIn: existingImages.map((img) => img.id),
          },
        },
      })
    }

    // Invalidate cache for this listing
    const cacheKey = getCacheKey.listing(listingId)
    await redis.del(cacheKey)

    return NextResponse.json(updatedListing, { status: 200 })
  } catch (error) {
    console.error("Listing update error:", error)
    return NextResponse.json({ error: "Failed to update listing" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(request)

    // Ensure user is authenticated
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if the listing belongs to the current user
    const existingListing = await prisma.listing.findUnique({
      where: {
        id: await Promise.resolve(params.id),
        userId: session.user.id,
      },
    })

    if (!existingListing) {
      return NextResponse.json({ error: "Listing not found or you do not have permission to delete" }, { status: 404 })
    }

    // Delete the listing
    await prisma.listing.delete({
      where: { id: await Promise.resolve(params.id) },
    })

    // Invalidate cache for this listing
    const cacheKey = getCacheKey.listing(await Promise.resolve(params.id))
    await redis.del(cacheKey)

    return NextResponse.json({ message: "Listing deleted successfully" }, { status: 200 })
  } catch (error) {
    console.error("Listing deletion error:", error)
    return NextResponse.json({ error: "Failed to delete listing" }, { status: 500 })
  }
}
