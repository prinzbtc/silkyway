import prisma from '@/lib/prisma';
import { Prisma, Brand } from '@prisma/client';
import { z } from 'zod';
import { categories } from './categories';
import type { Category } from './categories';

// Define brand categories
export const BRAND_CATEGORIES = {
  automobiles: ['Toyota', 'BMW', 'Mercedes-Benz', 'Honda', 'Ford'] as const,
  electronics: ['Apple', 'Samsung', 'Sony', 'Dell', 'Lenovo'] as const,
  clothing: ['Nike', 'Adidas', 'Zara', 'H&M', 'Uniqlo'] as const,
  books: ['Penguin', 'Harper Collins', 'Oxford', 'Cambridge'] as const,
  furniture: ['IKEA', 'West Elm', 'Article', 'Wayfair'] as const,
  sports: ['Wilson', 'Nike', 'Adidas', 'Under Armour'] as const,
  toys: ['LEGO', 'Hasbro', 'Mattel', 'Fisher-Price', 'Playmobil'] as const,
  other: [] as const,
};

// Extract brand categories type
export type BrandCategories = keyof typeof BRAND_CATEGORIES;

// Brand validation schema
const brandSchema = z.object({
  name: z.string().min(1, "Brand name is required"),
  category: z.string().refine(
    (val): val is BrandCategories => 
      categories.some((cat: Category) => cat.value === val),
    'Invalid category'
  )
});

// Brand management service
export const BrandService = {
  // Validate brand input
  validateBrand: (brand: string, category: string) => {
    return brandSchema.parse({ name: brand, category });
  },

  // Check if a brand exists in the database
  exists: async (name: string, category: string): Promise<boolean> => {
    const existingBrand = await prisma.brand.findUnique({
      where: { 
        name_category: { 
          name, 
          category 
        } 
      }
    });
    return !!existingBrand;
  },

  // Create a new brand in the database
  create: async (name: string, category: string, userId?: string) => {
    // Validate input first
    brandSchema.parse({ name, category });

    // Check if brand already exists
    const brandExists = await BrandService.exists(name, category);
    if (brandExists) {
      throw new Error(`Brand ${name} already exists in ${category}`);
    }

    // Create brand
    return prisma.brand.create({
      data: {
        name,
        category,
        userId
      }
    });
  },

  // Get brands for a specific category
  getBrandsByCategory: async (category: BrandCategories) => {
    return prisma.brand.findMany({
      where: { category },
      orderBy: { name: 'asc' }
    });
  },

  // Sync static brands with database
  syncStaticBrands: async () => {
    const syncPromises = (Object.entries(BRAND_CATEGORIES) as Array<[BrandCategories, readonly string[]]>).flatMap(
      ([category, brandList]) => 
        brandList.map((brandName: string) => 
          prisma.brand.upsert({
            where: { 
              name_category: { 
                name: brandName, 
                category 
              } 
            },
            update: {},
            create: { 
              name: brandName, 
              category 
            }
          })
        )
    );

    return Promise.all(syncPromises);
  },

  // Get all brands grouped by category
  getAllBrands: async () => {
    const dbBrands = await prisma.brand.findMany({
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    // Group brands by category
    return dbBrands.reduce((acc: Record<BrandCategories, string[]>, brandItem: Brand) => {
      if (!acc[brandItem.category as BrandCategories]) {
        acc[brandItem.category as BrandCategories] = [];
      }
      acc[brandItem.category as BrandCategories].push(brandItem.name);
      return acc;
    }, {} as Record<BrandCategories, string[]>);
  }
};
