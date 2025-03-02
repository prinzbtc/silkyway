import { NextResponse } from "next/server";

const CACHE_DURATION = 3600000; // 1 hour in milliseconds
let cachedRates: Record<string, number> = {};
let lastFetchTime = 0;

// Fetch exchange rates from Frankfurter API
export async function fetchExchangeRates() {
  const currentTime = Date.now();
  
  // Return cached rates if available and not expired
  if (Object.keys(cachedRates).length > 0 && currentTime - lastFetchTime < CACHE_DURATION) {
    console.log('Using cached exchange rates');
    return cachedRates;
  }
  
  try {
    // Initialize rates object with USD as base (1.0)
    const rates: Record<string, number> = { 'USD': 1.0 };
    
    // Fetch USD to EUR rate
    const usdToEurResponse = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR');
    if (!usdToEurResponse.ok) {
      throw new Error(`HTTP error fetching USD to EUR rate! status: ${usdToEurResponse.status}`);
    }
    const usdToEurData = await usdToEurResponse.json();
    rates['EUR'] = usdToEurData.rates.EUR;
    console.log(`Found rate: 1 USD = ${rates['EUR']} EUR`);
    
    // Fetch USD to GBP rate
    const usdToGbpResponse = await fetch('https://api.frankfurter.app/latest?from=USD&to=GBP');
    if (!usdToGbpResponse.ok) {
      throw new Error(`HTTP error fetching USD to GBP rate! status: ${usdToGbpResponse.status}`);
    }
    const usdToGbpData = await usdToGbpResponse.json();
    rates['GBP'] = usdToGbpData.rates.GBP;
    console.log(`Found rate: 1 USD = ${rates['GBP']} GBP`);
    
    // Fetch EUR to USD rate
    const eurToUsdResponse = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD');
    if (!eurToUsdResponse.ok) {
      throw new Error(`HTTP error fetching EUR to USD rate! status: ${eurToUsdResponse.status}`);
    }
    const eurToUsdData = await eurToUsdResponse.json();
    rates['EUR_USD'] = eurToUsdData.rates.USD;
    console.log(`Found rate: 1 EUR = ${rates['EUR_USD']} USD`);
    
    // Fetch GBP to USD rate
    const gbpToUsdResponse = await fetch('https://api.frankfurter.app/latest?from=GBP&to=USD');
    if (!gbpToUsdResponse.ok) {
      throw new Error(`HTTP error fetching GBP to USD rate! status: ${gbpToUsdResponse.status}`);
    }
    const gbpToUsdData = await gbpToUsdResponse.json();
    rates['GBP_USD'] = gbpToUsdData.rates.USD;
    console.log(`Found rate: 1 GBP = ${rates['GBP_USD']} USD`);
    
    // Fetch EUR to GBP rate
    const eurToGbpResponse = await fetch('https://api.frankfurter.app/latest?from=EUR&to=GBP');
    if (!eurToGbpResponse.ok) {
      throw new Error(`HTTP error fetching EUR to GBP rate! status: ${eurToGbpResponse.status}`);
    }
    const eurToGbpData = await eurToGbpResponse.json();
    rates['EUR_GBP'] = eurToGbpData.rates.GBP;
    console.log(`Found rate: 1 EUR = ${rates['EUR_GBP']} GBP`);
    
    // Fetch GBP to EUR rate
    const gbpToEurResponse = await fetch('https://api.frankfurter.app/latest?from=GBP&to=EUR');
    if (!gbpToEurResponse.ok) {
      throw new Error(`HTTP error fetching GBP to EUR rate! status: ${gbpToEurResponse.status}`);
    }
    const gbpToEurData = await gbpToEurResponse.json();
    rates['GBP_EUR'] = gbpToEurData.rates.EUR;
    console.log(`Found rate: 1 GBP = ${rates['GBP_EUR']} EUR`);
    
    // Cache the rates
    cachedRates = rates;
    lastFetchTime = currentTime;
    
    // Log all calculated rates
    console.log("All exchange rates:", rates);
    return rates;
  } catch (error) {
    console.error("Error fetching exchange rates:", error);
    // Fallback to reasonable rates if the API fails
    return {
      'USD': 1.0,
      'EUR': 0.926, // 1 USD ≈ 0.926 EUR (typical rate)
      'GBP': 0.787, // 1 USD ≈ 0.787 GBP (typical rate)
      'EUR_USD': 1.08, // 1 EUR ≈ 1.08 USD
      'GBP_USD': 1.27, // 1 GBP ≈ 1.27 USD
      'EUR_GBP': 1.176, // 1 EUR ≈ 1.176 GBP
      'GBP_EUR': 0.85, // 1 GBP ≈ 0.85 EUR
    };
  }
}

export async function GET() {
  const currentTime = Date.now();

  if (Object.keys(cachedRates).length === 0 || currentTime - lastFetchTime > CACHE_DURATION) {
    try {
      cachedRates = await fetchExchangeRates();
      lastFetchTime = currentTime;
      console.log("Exchange rates updated:", cachedRates);
    } catch (error) {
      console.error("Error updating exchange rates:", error);
      return NextResponse.json({ error: "Failed to fetch exchange rates" }, { status: 500 });
    }
  }

  return NextResponse.json({ 
    rates: cachedRates,
    timestamp: lastFetchTime,
    cacheExpires: lastFetchTime + CACHE_DURATION
  });
}
