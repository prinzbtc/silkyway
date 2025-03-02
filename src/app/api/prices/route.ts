import { NextResponse } from "next/server";
import { Currency } from "@/lib/price";

// Cache duration for different types of rates
const SOL_CACHE_DURATION = 60000; // 1 minute in milliseconds

// Cache for SOL price
let cachedSolPrice: number | null = null;
let lastSolPriceUpdate = 0;

// Fetch SOL price in USD from Birdeye API
async function fetchSolUsdPrice(): Promise<number> {
  try {
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
      return data.data.value;
    }

    throw new Error('Invalid response format');
  } catch (err) {
    console.error('Error fetching SOL price:', err);
    // Return mock data for development
    return 107.25;
  }
}

// Get the current SOL price in USD
async function getSolUsdPrice(): Promise<number> {
  const currentTime = Date.now();
  
  if (!cachedSolPrice || currentTime - lastSolPriceUpdate > SOL_CACHE_DURATION) {
    cachedSolPrice = await fetchSolUsdPrice();
    lastSolPriceUpdate = currentTime;
    console.log(`Updated SOL price: $${cachedSolPrice} USD`);
  }
  
  return cachedSolPrice;
}

// Fetch exchange rates from our exchange-rates API
async function getExchangeRates(): Promise<Record<string, number>> {
  try {
    // Import the exchange rates function directly
    const { fetchExchangeRates } = await import('../exchange-rates/route');
    const rates = await fetchExchangeRates();
    return rates;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    // Fallback rates if API fails
    return {
      'USD': 1.0,
      'EUR': 0.926, // 1 USD ≈ 0.926 EUR
      'GBP': 0.787, // 1 USD ≈ 0.787 GBP
      'EUR_USD': 1.08, // 1 EUR ≈ 1.08 USD
      'GBP_USD': 1.27, // 1 GBP ≈ 1.27 USD
      'EUR_GBP': 1.176, // 1 EUR ≈ 1.176 GBP
      'GBP_EUR': 0.85, // 1 GBP ≈ 0.85 EUR
    };
  }
}

// Convert between any two currencies (fiat or SOL)
async function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency
): Promise<number> {
  console.log(`Converting ${amount} ${fromCurrency} to ${toCurrency}`);
  
  // Normalize currencies to uppercase
  const from = fromCurrency.toUpperCase() as Currency;
  const to = toCurrency.toUpperCase() as Currency;
  
  // If currencies are the same, return the original amount
  if (from === to) {
    console.log(`Same currency, returning original amount: ${amount}`);
    return amount;
  }

  // Currencies are already normalized above

  // Get the SOL price in USD
  const solUsdPrice = await getSolUsdPrice();
  
  // Get exchange rates from our API
  const rates = await getExchangeRates();
  console.log('Exchange rates:', rates);
  
  // Handle SOL conversions separately
  if (from === 'SOL' && to === 'USD') {
    // Direct SOL to USD conversion
    return amount * solUsdPrice;
  } else if (from === 'USD' && to === 'SOL') {
    // Direct USD to SOL conversion
    return amount / solUsdPrice;
  }
  
  // Handle SOL to other fiat currencies
  if (from === 'SOL') {
    // First convert SOL to USD
    const amountInUsd = amount * solUsdPrice;
    // Then convert USD to target currency using Frankfurter rates
    if (to === 'EUR') {
      return amountInUsd * rates['EUR'];
    } else if (to === 'GBP') {
      return amountInUsd * rates['GBP'];
    }
  }
  
  // Handle fiat to SOL conversions
  if (to === 'SOL') {
    let amountInUsd;
    // First convert to USD
    if (from === 'EUR') {
      amountInUsd = amount * rates['EUR_USD'];
    } else if (from === 'GBP') {
      amountInUsd = amount * rates['GBP_USD'];
    } else {
      amountInUsd = amount;
    }
    // Then convert USD to SOL
    return amountInUsd / solUsdPrice;
  }
  
  // Handle fiat to fiat conversions
  // Direct conversion if available
  const conversionKey = `${from}_${to}`;
  if (rates[conversionKey]) {
    return amount * rates[conversionKey];
  }
  
  // USD is our base currency in Frankfurter API
  if (from === 'USD') {
    // USD to any other fiat currency
    if (rates[to]) {
      return amount * rates[to];
    }
  } else if (to === 'USD') {
    // Any fiat currency to USD
    if (rates[`${from}_USD`]) {
      return amount * rates[`${from}_USD`];
    }
  }
  
  // Cross-currency conversions via USD
  if (from === 'EUR' && to === 'GBP') {
    return amount * rates['EUR_GBP'];
  } else if (from === 'GBP' && to === 'EUR') {
    return amount * rates['GBP_EUR'];
  }
  
  // Fallback if no conversion path is found
  console.error(`No conversion path found for ${from} to ${to}`);
  return amount;
}

export const dynamic = 'force-dynamic'; // Disable static optimization

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const amount = parseFloat(url.searchParams.get('amount') || '0');
    const from = url.searchParams.get('from') as Currency || 'USD';
    const to = url.searchParams.get('to') as Currency || 'USD';
    
    // Validate inputs
    if (isNaN(amount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    
    if (!['USD', 'EUR', 'GBP', 'SOL'].includes(from) || !['USD', 'EUR', 'GBP', 'SOL'].includes(to)) {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
    }
    
    // Perform the conversion
    const convertedAmount = await convertCurrency(amount, from, to);
    
    // Return the result
    return NextResponse.json({
      amount,
      from,
      to,
      convertedAmount,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error in currency conversion:', error);
    return NextResponse.json({ error: 'Conversion failed' }, { status: 500 });
  }
}
