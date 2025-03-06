import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function GET(request: NextRequest) {
  try {
    // Get all listing keys
    const keys = await redis.keys('listing:*');
    console.log('Found listing keys:', keys);
    
    let deleted = 0;
    if (keys.length > 0) {
      deleted = await redis.del(...keys);
    }
    
    return NextResponse.json({
      success: true,
      message: `Cleared ${deleted} listing cache entries`,
      clearedKeys: keys
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
