import { NextResponse } from "next/server"

const CACHE_DURATION = 60000 // 1 minute in milliseconds
let cachedPrice: { usd: number; eur: number } | null = null
let lastFetchTime = 0

async function fetchSolPrice() {
  try {
    // Use node-fetch compatible request
    const response = await fetch('https://public-api.birdeye.so/defi/price?address=So11111111111111111111111111111111111111112', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-chain': 'solana',
        'X-API-KEY': '46b9f420d1e648189541986d1de7d659'
      },
      next: { revalidate: 30 } // Cache for 30 seconds
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Birdeye API response:', data);

    if (data.success && data.data?.value) {
      return {
        usd: data.data.value,
        eur: data.data.value // EUR conversion will be handled by usd-eur route
      };
    }

    throw new Error('Invalid response format');
  } catch (err) {
    console.error('Error fetching SOL price:', err);
    // Return mock data for development
    return {
      usd: 107.25,
      eur: 107.25
    };
  }
}

export const dynamic = 'force-dynamic' // Disable static optimization

export async function GET() {
  try {
    const currentTime = Date.now()

    if (!cachedPrice || currentTime - lastFetchTime > CACHE_DURATION) {
      cachedPrice = await fetchSolPrice()
      lastFetchTime = currentTime
    }

    if (!cachedPrice) {
      return NextResponse.json({ error: 'Price unavailable' }, { status: 500 });
    }

    return NextResponse.json(cachedPrice);
  } catch (error) {
    console.error('Error in GET handler:', error);
    return NextResponse.json({ error: 'Price unavailable' }, { status: 500 });
  }
}
