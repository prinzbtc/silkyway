import { NextResponse } from "next/server"

const CACHE_DURATION = 3600000 // 1 hour in milliseconds
let cachedRate: number | null = null
let lastFetchTime = 0

async function fetchUsdGbpRate() {
  try {
    const url = 'https://open.er-api.com/v6/latest/USD';
    const response = await fetch(url);
    const data = await response.json();

    if (data.rates?.GBP) {
      return data.rates.GBP;
    }

    throw new Error('GBP rate not found in response');
  } catch (err) {
    console.error('Error fetching USD-GBP rate:', err);
    // Return mock rate for development
    return 0.79;
  }
}

export async function GET() {
  try {
    const currentTime = Date.now()

    if (!cachedRate || currentTime - lastFetchTime > CACHE_DURATION) {
      cachedRate = await fetchUsdGbpRate()
      lastFetchTime = currentTime
    }

    if (!cachedRate) {
      return NextResponse.json({ error: 'Rate unavailable' }, { status: 500 });
    }

    return NextResponse.json({ rate: cachedRate });
  } catch (error) {
    console.error('Error in GET handler:', error);
    return NextResponse.json({ error: 'Rate unavailable' }, { status: 500 });
  }
}
