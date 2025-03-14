import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import path from 'path';
import fs from 'fs';
import { headers } from 'next/headers';

/**
 * API endpoint to serve temporary media files that have been scanned but not yet finalized
 * These are files that are in the process of being attached to a message but not yet sent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Extract and sanitize the filename parameter
    const filename = await params.filename;
    if (!filename) {
      return new NextResponse('Missing filename', { status: 400 });
    }

    // Sanitize the filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    if (sanitizedFilename !== filename) {
      return new NextResponse('Invalid filename', { status: 400 });
    }

    // Define the path to the temporary file
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
    const filePath = path.join(tempDir, sanitizedFilename);

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return new NextResponse('File not found', { status: 404 });
    }

    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    
    // Determine the MIME type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream'; // Default content type
    
    // Map common extensions to MIME types
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
    };
    
    if (ext in mimeTypes) {
      contentType = mimeTypes[ext];
    }
    
    // Set appropriate headers
    const headersList = new Headers();
    headersList.set('Content-Type', contentType);
    headersList.set('Content-Disposition', `inline; filename="${sanitizedFilename}"`);
    
    // Return the file
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: headersList,
    });
  } catch (error) {
    console.error('Error serving temp media file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
