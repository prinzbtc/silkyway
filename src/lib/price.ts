import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export type Currency = 'SOL' | 'USD' | 'EUR' | 'GBP';

const formatters = {
  SOL: new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

interface SolPriceResponse {
  usd: number;
  eur: number;
}

interface ExchangeRateResponse {
  rate: number;
}

let cachedSolPrice: SolPriceResponse | null = null;
let cachedEurRate: number | null = null;
let cachedGbpRate: number | null = null;
let lastSolPriceUpdate = 0;
let lastEurRateUpdate = 0;
let lastGbpRateUpdate = 0;

const SOL_PRICE_UPDATE_INTERVAL = 30000; // 30 seconds
const FIAT_RATE_UPDATE_INTERVAL = 3600000; // 1 hour

async function updateSolPrice() {
  const now = Date.now();
  if (!cachedSolPrice || now - lastSolPriceUpdate > SOL_PRICE_UPDATE_INTERVAL) {
    try {
      const response = await fetch('/api/prices/sol-usd');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if ('error' in data) {
        throw new Error(data.error);
      }
      cachedSolPrice = data;
      lastSolPriceUpdate = now;
    } catch (error) {
      console.error('Error fetching SOL price:', error);
      return null;
    }
  }
  return cachedSolPrice;
}

async function updateEurRate() {
  const now = Date.now();
  if (!cachedEurRate || now - lastEurRateUpdate > FIAT_RATE_UPDATE_INTERVAL) {
    try {
      const response = await fetch('/api/prices/usd-eur');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if ('error' in data) {
        throw new Error(data.error);
      }
      cachedEurRate = data.rate;
      lastEurRateUpdate = now;
    } catch (error) {
      console.error('Error fetching EUR rate:', error);
      return null;
    }
  }
  return cachedEurRate;
}

async function updateGbpRate() {
  const now = Date.now();
  if (!cachedGbpRate || now - lastGbpRateUpdate > FIAT_RATE_UPDATE_INTERVAL) {
    try {
      const response = await fetch('/api/prices/usd-gbp');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if ('error' in data) {
        throw new Error(data.error);
      }
      cachedGbpRate = data.rate;
      lastGbpRateUpdate = now;
    } catch (error) {
      console.error('Error fetching GBP rate:', error);
      return null;
    }
  }
  return cachedGbpRate;
}

export async function getSolPrice(currency: Exclude<Currency, 'SOL'>) {
  console.log('Getting SOL price for currency:', currency);
  const solPrice = await updateSolPrice();
  console.log('SOL price response:', solPrice);
  if (!solPrice) return null;

  switch (currency) {
    case 'USD':
      console.log('Returning USD price:', solPrice.usd);
      return solPrice.usd;
    case 'EUR': {
      const eurRate = await updateEurRate();
      console.log('EUR rate:', eurRate);
      const price = eurRate ? solPrice.usd * eurRate : null;
      console.log('Calculated EUR price:', price);
      return price;
    }
    case 'GBP': {
      const gbpRate = await updateGbpRate();
      console.log('GBP rate:', gbpRate);
      const price = gbpRate ? solPrice.usd * gbpRate : null;
      console.log('Calculated GBP price:', price);
      return price;
    }
  }
}

export function formatSOL(amount: number) {
  return `${formatters.SOL.format(amount)} SOL`;
}

export function formatPrice(amount: number, currency: Currency) {
  if (currency === 'SOL') {
    return formatSOL(amount);
  }
  return formatters[currency].format(amount);
}

export function lamportsToSol(lamports: number) {
  return lamports / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number) {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}
