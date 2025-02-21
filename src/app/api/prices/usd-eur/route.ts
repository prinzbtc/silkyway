import { NextResponse } from "next/server"

const CACHE_DURATION = 3600000 // 1 hour in milliseconds
let cachedRate: number | null = null
let lastFetchTime = 0

async function fetchUsdEurRate() {
  try {
    const url = 'https://open.er-api.com/v6/latest/USD';
    const response = await fetch(url);
    const data = await response.json();

    if (data.rates?.EUR) {
      return data.rates.EUR;
    }

    throw new Error('EUR rate not found in response');
  } catch (err) {
    console.error('Error fetching USD-EUR rate:', err);
    // Return mock rate for development
    return 0.93;
  }
}

export async function GET() {
  try {
    const currentTime = Date.now()

    if (!cachedRate || currentTime - lastFetchTime > CACHE_DURATION) {
      cachedRate = await fetchUsdEurRate()
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
