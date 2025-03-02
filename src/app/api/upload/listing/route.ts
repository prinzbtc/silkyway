import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { validateFile, saveTempFile, getMediaType, mapDbMediaToMediaFile } from '@/lib/uploads';
import prisma from '@/lib/prisma';
import { MediaType, MediaProcessingStatus } from '@/types/media';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const order = formData.get('order') ? parseInt(formData.get('order') as string) : 0;
    const listingId = formData.get('listingId') as string;
    const isMain = formData.get('isMain') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file
    await validateFile(file, 'temp');

    // Save file to temp directory first
    const { url, filepath, type } = await saveTempFile(file);

    // Create a media record in the database
    const media = await prisma.listingMedia.create({
      data: {
        url,
        filename: file.name,
        type,
        order,
        isMainMedia: isMain,
        status: MediaProcessingStatus.PENDING,
        originalFilename: file.name,
        userId: session.user.id,
        updatedAt: new Date(),
        ...(listingId ? { listingId } : {})
      }
    });

    // Return the media info
    return NextResponse.json(mapDbMediaToMediaFile(media));
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    );
  }
}
