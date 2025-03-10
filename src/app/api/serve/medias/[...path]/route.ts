import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { join } from 'path';
import { promises as fs } from 'fs';
import { stat } from 'fs/promises';
import prisma from '@/lib/prisma';

// Configure allowed file types and their MIME types
const ALLOWED_MIME_TYPES = {
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  // Documents
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * Securely serves media files from the private uploads directory
 * Includes authentication and authorization checks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Get the file path from the URL
    const filePath = params.path.join('/');
    
    // Basic validation to prevent directory traversal attacks
    if (filePath.includes('..') || !filePath) {
      return new NextResponse('Invalid file path', { status: 400 });
    }

    // Check if user is authenticated
    const session = await getSession();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Construct the full file path
    const fullPath = join(process.cwd(), 'private/uploads/medias', filePath);
    
    // Check if file exists
    try {
      const stats = await stat(fullPath);
      if (!stats.isFile()) {
        return new NextResponse('Not found', { status: 404 });
      }
    } catch (error) {
      return new NextResponse('Not found', { status: 404 });
    }

    // Determine file extension and MIME type
    const fileExtension = '.' + filePath.split('.').pop()?.toLowerCase();
    const contentType = ALLOWED_MIME_TYPES[fileExtension as keyof typeof ALLOWED_MIME_TYPES] || 'application/octet-stream';

    // Check authorization - verify this user has access to this file
    // This checks if the user is a participant in any conversation that contains a message with this file
    const fileUrl = `/uploads/medias/${filePath}`;
    const messageWithAttachment = await prisma.message.findFirst({
      where: {
        attachments: {
          path: ['$[*].url'],
          array_contains: fileUrl,
        },
        OR: [
          { senderId: session.user.id },
          { receiverId: session.user.id },
        ],
      },
      select: {
        id: true,
      },
    });

    if (!messageWithAttachment) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Read and serve the file
    const fileBuffer = await fs.readFile(fullPath);
    
    // Set cache control headers - private to prevent caching by CDNs, max-age for browser caching
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error serving media file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
