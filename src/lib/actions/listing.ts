'use server';

import { cache } from 'react';
import prisma from '@/lib/prisma';
import { Listing } from '@prisma/client';

export const getUserListings = cache(async (userId: string): Promise<Listing[]> => {
  try {
    const listings = await prisma.listing.findMany({
      where: {
        userId: userId,
        status: 'active' // Only fetch active listings
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        },
        media: {
          orderBy: {
            order: 'asc'
          },
          take: 1 // Get first image for listing preview
        }
      }
    });

    return listings.map((listing: Listing & { media: { url: string | null }[] }) => ({
      ...listing,
      primaryImage: listing.media[0]?.url || null
    }));
  } catch (error) {
    console.error('Error fetching user listings:', error);
    throw error;
  }
});
