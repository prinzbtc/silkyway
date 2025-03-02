import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import path from 'path';
import { processMedia, mapDbMediaToMediaFile } from '@/lib/uploads.server';
import { MediaType, MediaProcessingStatus } from '@/types/media';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { mediaId, tempUrl, filename, mediaType, listingId } = body;

    if (!mediaId || !tempUrl || !filename || !mediaType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get the temp file path
    const tempFilePath = path.join(
      process.cwd(),
      'public',
      new URL(tempUrl).pathname
    );

    // Define output directory
    const outputDir = path.join(process.cwd(), 'public', 'uploads', 'listings');

    // Update media status to processing
    await prisma.listingMedia.update({
      where: { id: mediaId },
      data: { 
        status: MediaProcessingStatus.PROCESSING,
        updatedAt: new Date()
      }
    });

    // Process the media file
    const result = await processMedia({
      inputPath: tempFilePath,
      outputDir,
      filename,
      mediaType: mediaType as MediaType,
    });

    // Update the media record with processed file info
    const media = await prisma.listingMedia.update({
      where: { id: mediaId },
      data: {
        url: result.url,
        thumbnail: result.thumbnail,
        status: result.status,
        updatedAt: new Date(),
        ...(listingId ? { listingId } : {})
      }
    });

    return NextResponse.json({
      success: true,
      mediaId,
      media: mapDbMediaToMediaFile(media)
    });
  } catch (error) {
    console.error('Error processing media:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// API route to get media processing status
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get mediaId from query params
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('mediaId');

    if (!mediaId) {
      return NextResponse.json(
        { error: 'Missing mediaId parameter' },
        { status: 400 }
      );
    }

    // Get media processing status
    const media = await prisma.listingMedia.findUnique({
      where: { id: mediaId },
      select: {
        id: true,
        url: true,
        thumbnail: true,
        status: true
      }
    });

    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(mapDbMediaToMediaFile(media));
  } catch (error) {
    console.error('Error getting media status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
