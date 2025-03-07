import { NextResponse } from 'next/server';
import { BrandService } from '@/lib/brands';
import { BrandCategories } from '@/lib/brands';

export async function GET(request: Request) {
  try {
    // Get query parameters
    const url = new URL(request.url);
    const category = url.searchParams.get('category') as BrandCategories | null;
    const query = url.searchParams.get('query');
    
    console.log(`API /brands: Received request with category=${category}, query=${query}`);
    
    if (category) {
      try {
        // Check if the category exists in BRAND_CATEGORIES
        if (category in BrandService.BRAND_CATEGORIES) {
          console.log(`API /brands: Fetching brands for category '${category}'`);
          
          // Get brands for a specific category
          const brands = await BrandService.getBrandsByCategory(category);
          console.log(`API /brands: Found ${brands.length} brands in database for category '${category}'`);
          
          // Get static brands for this category
          const staticBrands = BrandService.BRAND_CATEGORIES[category];
          console.log(`API /brands: Found ${staticBrands.length} static brands for category '${category}'`);
          
          // Combine database and static brands
          const allBrands = new Set<string>();
          
          // Add database brands
          brands.forEach(brand => allBrands.add(brand.name));
          
          // Add static brands
          staticBrands.forEach(brand => allBrands.add(brand));
          
          // Convert to array and sort
          let brandNames = Array.from(allBrands).sort((a, b) => a.localeCompare(b));
          
          // Filter by query if provided
          if (query && query.trim() !== '') {
            const lowerQuery = query.toLowerCase();
            brandNames = brandNames.filter(name => 
              name.toLowerCase().startsWith(lowerQuery)
            );
            console.log(`API /brands: Filtered to ${brandNames.length} brands matching query '${query}'`);
          }
          
          return NextResponse.json(brandNames);
        } else {
          // If category doesn't exist in BRAND_CATEGORIES, return an empty array
          console.warn(`API /brands: Category '${category}' not found in BRAND_CATEGORIES`);
          return NextResponse.json([]);
        }
      } catch (error) {
        console.error(`API /brands: Error fetching brands for category ${category}:`, error);
        // Return an empty array if there's an error
        return NextResponse.json([]);
      }
    } else {
      try {
        console.log(`API /brands: Fetching all brands`);
        
        // Get all brands grouped by category
        const allBrands = await BrandService.getAllBrands();
        console.log(`API /brands: Retrieved brands for ${Object.keys(allBrands).length} categories`);
        
        // Ensure we have a valid object with arrays
        const safeResult: Record<string, string[]> = {};
        
        // Validate each category and ensure it has an array of strings
        Object.entries(allBrands).forEach(([cat, brands]) => {
          if (Array.isArray(brands)) {
            let brandNames = brands.filter(brand => typeof brand === 'string');
            
            // Filter by query if provided
            if (query && query.trim() !== '') {
              const lowerQuery = query.toLowerCase();
              brandNames = brandNames.filter(name => 
                name.toLowerCase().startsWith(lowerQuery)
              );
            }
            
            safeResult[cat] = brandNames;
          } else {
            safeResult[cat] = [];
          }
        });
        
        return NextResponse.json(safeResult);
      } catch (error) {
        console.error('API /brands: Error fetching all brands:', error);
        // Return an empty object if there's an error
        return NextResponse.json({});
      }
    }
  } catch (error) {
    console.error('API /brands: Error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { brand, category } = await request.json();

    // Validate the brand and category using BrandService
    try {
      BrandService.validateBrand(brand, category);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid brand or category' },
        { status: 400 }
      );
    }

    // Check if brand already exists
    const exists = await BrandService.exists(brand, category);
    if (exists) {
      // Even if it exists in the database, make sure it's in the static list too
      BrandService.addToStaticList(brand, category);
      return NextResponse.json({ success: true }); // Brand already exists, no need to create
    }

    // Create the new brand in the database
    await BrandService.create(brand, category);
    
    // Also add to the static list for immediate use in the UI
    BrandService.addToStaticList(brand, category);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating brand:', error);
    return NextResponse.json(
      { error: 'Failed to create brand' },
      { status: 500 }
    );
  }
}
