// Solana Program IDs and Addresses
export const ESCROW_PROGRAM_ID = process.env.NEXT_PUBLIC_ESCROW_PROGRAM_ID || 'YOUR_ESCROW_PROGRAM_ID';
export const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS || 'YOUR_TREASURY_ADDRESS';

// API Configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000';

// Feature Flags
export const ENABLE_ANALYTICS = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true';
export const MAINTENANCE_MODE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';

// Limits and Constraints
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILES_PER_LISTING = 10;
export const MIN_PRICE = 0.000001; // Minimum price in SOL
export const MAX_PRICE = 100000; // Maximum price in SOL

// Cache and Performance
export const CACHE_TTL = 60 * 60; // 1 hour in seconds
export const API_RATE_LIMIT = 100; // Requests per minute

// Social Links
export const SOCIAL_LINKS = {
  twitter: 'https://twitter.com/silkyway',
  discord: 'https://discord.gg/silkyway',
  github: 'https://github.com/silkyway',
};

// SEO and Metadata
export const DEFAULT_SEO = {
  title: 'Silkyway - Secure P2P Marketplace',
  description: 'Buy and sell items securely using Solana blockchain escrow.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://silkyway.com',
    site_name: 'Silkyway',
  },
};
