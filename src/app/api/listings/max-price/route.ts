import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';

// Cache key for max price
const MAX_PRICE_CACHE_KEY = 'listings:max-price';
// Cache TTL for max price (1 hour)
const MAX_PRICE_CACHE_TTL = 60 * 60;

export async function GET() {
  try {
    let maxPrice = 10000; // Default fallback value
    
    try {
      // Try to get from cache first
      console.log('Attempting to get max price from cache');
      const cachedMaxPrice = await redis.get<number>(MAX_PRICE_CACHE_KEY);
      
      if (cachedMaxPrice !== null) {
        console.log('Using cached max price:', cachedMaxPrice);
        return NextResponse.json({ maxPrice: cachedMaxPrice });
      }
      
      // If not in cache, fetch from database
      console.log('Fetching max price from database');
      const maxPriceResult = await prisma.listing.aggregate({
        _max: {
          price: true,
        },
        where: {
          status: 'active',
        },
      });
      
      // Get the max price or default to 1000 if no listings exist
      const dbMaxPrice = maxPriceResult._max.price || 1000;
      
      // Round up to the nearest 100 and add a buffer
      maxPrice = Math.ceil(dbMaxPrice / 100) * 100 + 1000;
      
      try {
        // Cache the result
        console.log('Caching max price:', maxPrice);
        await redis.set(MAX_PRICE_CACHE_KEY, maxPrice, { ex: MAX_PRICE_CACHE_TTL });
      } catch (cacheError) {
        // If caching fails, log but continue
        console.warn('Failed to cache max price:', cacheError);
      }
    } catch (dataError) {
      // If database query fails, log and use default
      console.error('Error querying database for max price:', dataError);
      // We'll use the default maxPrice value
    }
    
    console.log('Returning max price:', maxPrice);
    return NextResponse.json({ maxPrice });
  } catch (error) {
    console.error('Unhandled error in max price API:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch max price', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
