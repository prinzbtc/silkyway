import { LAMPORTS_PER_SOL } from '@solana/web3.js';

// Currency type that includes all supported currencies
// Note: The database schema only has USD, EUR, GBP as enum values
// SOL is supported in the application but not as a database currency
export type Currency = 'SOL' | 'USD' | 'EUR' | 'GBP';

// Currency formatters for display
const formatters = {
  SOL: new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }),
  USD: new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }),
  EUR: new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }),
  GBP: new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }),
};

// Cache for conversions to reduce API calls
interface CacheEntry {
  value: number;
  timestamp: number;
}

const conversionCache: Record<string, CacheEntry> = {};
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Convert between any two currencies (fiat or SOL)
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: Currency | string,
  toCurrency: Currency | string
): Promise<number | null> {
  // Normalize currency inputs
  const normalizedFromCurrency = normalizeCurrency(fromCurrency);
  const normalizedToCurrency = normalizeCurrency(toCurrency);
  
  // If amount is invalid, return null
  if (amount === undefined || amount === null || isNaN(amount)) {
    console.log(`convertCurrency - Invalid amount: ${amount}`);
    return null;
  }
  
  // If currencies are the same (case insensitive), return the original amount
  if (normalizedFromCurrency.toUpperCase() === normalizedToCurrency.toUpperCase()) {
    console.log(`convertCurrency - Same currency (${normalizedFromCurrency} === ${normalizedToCurrency}), returning original amount: ${amount}`);
    return amount;
  }
  
  // Create a cache key
  const cacheKey = `${amount}_${normalizedFromCurrency}_${normalizedToCurrency}`;
  const now = Date.now();
  
  // Check if we have a cached value that's still valid
  if (conversionCache[cacheKey] && now - conversionCache[cacheKey].timestamp < CACHE_DURATION) {
    console.log(`convertCurrency - Using cached value for ${cacheKey}: ${conversionCache[cacheKey].value}`);
    return conversionCache[cacheKey].value;
  }
  
  try {
    // Call the centralized API for conversion
    console.log(`convertCurrency - Fetching conversion from API: ${amount} ${normalizedFromCurrency} to ${normalizedToCurrency}`);
    const response = await fetch(`/api/prices?amount=${amount}&from=${normalizedFromCurrency}&to=${normalizedToCurrency}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if ('error' in data) {
      throw new Error(data.error);
    }
    
    // Cache the result
    conversionCache[cacheKey] = {
      value: data.convertedAmount,
      timestamp: now
    };
    
    console.log(`convertCurrency - Conversion result: ${data.convertedAmount} (${amount} ${normalizedFromCurrency} to ${normalizedToCurrency})`);
    return data.convertedAmount;
  } catch (error) {
    console.error('Error converting currency:', error);
    return null;
  }
}

/**
 * Convert fiat currency to SOL
 */
export async function convertFiatToSol(
  amount: number,
  currency: Currency | string
): Promise<number | null> {
  const normalizedCurrency = normalizeCurrency(currency);
  
  // If the currency is already SOL, return the original amount
  if (normalizedCurrency === 'SOL') {
    return amount;
  }
  
  return convertCurrency(amount, normalizedCurrency, 'SOL');
}

/**
 * Get the SOL price in the specified fiat currency
 */
export async function getSolPrice(currency: Exclude<Currency, 'SOL'> | string): Promise<number | null> {
  const normalizedCurrency = normalizeCurrency(currency);
  
  if (normalizedCurrency === 'SOL') {
    return 1; // 1 SOL = 1 SOL
  }
  
  // Convert 1 SOL to the target currency
  return convertCurrency(1, 'SOL', normalizedCurrency);
}

/**
 * Normalize currency input to ensure it's a valid Currency type
 * This function handles various input types that might come from the database or API
 */
export function normalizeCurrency(currency: Currency | string | undefined | null): Currency {
  // Enhanced debugging for the incoming currency value
  console.log(`normalizeCurrency - Incoming currency:`, currency, 
    `type:`, typeof currency, 
    `constructor:`, currency && (currency as any).constructor ? (currency as any).constructor.name : 'N/A',
    `toString:`, currency ? currency.toString() : 'N/A');
  
  // Handle undefined, null or empty string
  if (currency === undefined || currency === null || currency === '') {
    console.log(`normalizeCurrency - Currency is undefined, null or empty, defaulting to USD`);
    return 'USD';
  }
  
  // Handle potential database enum values (which might be lowercase or objects)
  // Convert to uppercase string for comparison
  let currencyStr: string;
  
  try {
    currencyStr = currency.toString().toUpperCase();
    console.log(`normalizeCurrency - Converted to string: ${currencyStr}`);
  } catch (error) {
    console.error(`normalizeCurrency - Error converting currency to string:`, error);
    return 'USD';
  }
  
  // Validate that it's one of our supported currencies
  if (!['USD', 'EUR', 'GBP', 'SOL'].includes(currencyStr)) {
    console.log(`normalizeCurrency - Invalid currency: ${currencyStr}, defaulting to USD`);
    return 'USD';
  }
  
  // Return the normalized currency
  console.log(`normalizeCurrency - Normalized currency: ${currencyStr}`);
  return currencyStr as Currency;
}

/**
 * Format SOL amount for display
 */
export function formatSOL(amount: number): string {
  return `${formatters.SOL.format(amount)} SOL`;
}

/**
 * Format price in specified currency for display
 */
export function formatPrice(amount: number, currency: Currency | string): string {
  const normalizedCurrency = normalizeCurrency(currency);
  
  if (normalizedCurrency === 'SOL') {
    return formatSOL(amount);
  }
  return formatters[normalizedCurrency].format(amount);
}

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return sol * LAMPORTS_PER_SOL;
}
