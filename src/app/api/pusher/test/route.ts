import { NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';

export async function POST() {
  return new NextResponse('This test endpoint has been disabled', { status: 404 });
}
