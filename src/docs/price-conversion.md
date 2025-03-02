# Silkyway Price Conversion System

This document outlines the simplified price conversion system used in the Silkyway marketplace.

## Overview

The price conversion system allows users to:

1. Create listings in their preferred fiat currency (USD, EUR, GBP)
2. View listings in their preferred currency, with automatic conversion
3. See SOL equivalents for all prices, regardless of the original listing currency

## Architecture

### Core Components

1. **Centralized API Endpoint**: `/api/prices/route.ts`
   - Single endpoint for all currency conversions
   - Handles conversions between SOL, USD, EUR, and GBP
   - Implements caching to reduce API calls
   - Uses European Central Bank (ECB) as the primary source for exchange rates
   - Provides fallback to hardcoded rates if API fails

2. **Price Library**: `/src/lib/price.ts`
   - Core utility functions for currency conversion and formatting
   - `convertCurrency()`: Converts between any two currencies
   - `normalizeCurrency()`: Standardizes currency inputs
   - Formatting functions for display

3. **Unified Price Hook**: `/src/hooks/usePrice.ts`
   - Consolidated hook that replaces multiple separate hooks
   - Handles all price conversion needs in one place
   - Provides formatted values ready for display
   - Manages loading states and error handling

### Data Flow

1. Component needs to display a price
2. Component calls `usePrice(amount, currency)`
3. Hook fetches conversions from the API
4. API fetches rates from ECB and/or Birdeye (for SOL)
5. Converted values are returned and cached
6. Component displays the formatted values

## Usage

```tsx
// Import the hook
import { usePrice } from '@/hooks/usePrice';

// Use in a component
function MyComponent({ listing }) {
  // Get all price data
  const { 
    formattedOriginal,    // Original price formatted (e.g., "$100.00")
    formattedPreferred,   // Price in user's preferred currency
    formattedSol,         // SOL equivalent formatted
    solAmount,            // Raw SOL amount
    isPreferredLoading,   // Loading state for preferred currency
    isSolLoading,         // Loading state for SOL conversion
    showConverted         // Whether to show converted price (true when currencies differ)
  } = usePrice(listing.price, listing.currency);

  return (
    <div>
      {/* Show either original or converted price */}
      <div className="price">
        {showConverted ? formattedPreferred : formattedOriginal}
        {isPreferredLoading && showConverted && 
          <span>(converting...)</span>}
      </div>
      
      {/* Always show SOL equivalent */}
      <div className="sol-price">
        {isSolLoading ? 'Converting to SOL...' : formattedSol}
      </div>
    </div>
  );
}
```

## Caching Strategy

- API responses are cached for 30 seconds
- SOL prices from Birdeye are cached for 30 seconds
- Fiat exchange rates from ECB are cached for 1 hour

## Supported Currencies

- SOL
- USD
- EUR
- GBP

## Error Handling

- Retry mechanism with exponential backoff
- Fallback to previous successful conversion if available
- Clear error states for UI feedback
