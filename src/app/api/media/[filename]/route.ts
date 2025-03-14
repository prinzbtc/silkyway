import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import path from 'path';
import fs from 'fs';
import { headers } from 'next/headers';

/**
 * API route to serve private media files
 * This route is used to serve files from the private/uploads/medias directory
 * It requires authentication to access the files
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  // In NextJS App Router, params needs to be awaited
  const rawFilename = await params.filename;
  console.log('Media API route called for file:', rawFilename);
  
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user?.id) {
      console.log('Unauthorized access attempt to media file:', rawFilename);
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Sanitize filename to prevent directory traversal attacks
    const filename = rawFilename.replace(/\.\./g, '').replace(/\//g, '');
    
    // Construct the file path
    const mediaDir = path.join(process.cwd(), 'private', 'uploads', 'medias');
    const filePath = path.join(mediaDir, filename);
    
    console.log('Attempting to serve file from path:', filePath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log('File not found:', filePath);
      return new NextResponse('File not found', { status: 404 });
    }
    
    // Get file stats
    const stat = fs.statSync(filePath);
    
    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream'; // Default content type
    
    if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.png') {
      contentType = 'image/png';
    } else if (ext === '.gif') {
      contentType = 'image/gif';
    } else if (ext === '.mp4') {
      contentType = 'video/mp4';
    } else if (ext === '.webp') {
      contentType = 'image/webp';
    } else if (ext === '.pdf') {
      contentType = 'application/pdf';
    }
    
    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    
    // Set appropriate headers
    const headersList = new Headers();
    headersList.set('Content-Type', contentType);
    headersList.set('Content-Length', stat.size.toString());
    headersList.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    console.log('Serving media file:', filename, 'Content-Type:', contentType, 'Size:', stat.size);
    
    // Return the file
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: headersList,
    });
  } catch (error) {
    console.error('Error serving media file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
