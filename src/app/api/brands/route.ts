import { NextResponse } from 'next/server';
import { BrandService } from '@/lib/brands';

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
      return NextResponse.json({ success: true }); // Brand already exists, no need to create
    }

    // Create the new brand
    await BrandService.create(brand, category);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating brand:', error);
    return NextResponse.json(
      { error: 'Failed to create brand' },
      { status: 500 }
    );
  }
}
