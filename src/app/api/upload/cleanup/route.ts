import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import path from 'path';
import fs from 'fs';

/**
 * API endpoint to clean up temporary files that were uploaded but never finalized
 * This is called when a user navigates away or removes an attachment without sending
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the request body
    const body = await request.json();
    const tempFilenames = body.tempFilenames as string[];
    
    if (!tempFilenames || !Array.isArray(tempFilenames) || tempFilenames.length === 0) {
      return NextResponse.json({ error: 'No filenames provided' }, { status: 400 });
    }

    const results: { [key: string]: boolean } = {};
    
    // Process each filename
    for (const tempFilename of tempFilenames) {
      try {
        // Validate the filename to prevent directory traversal
        const sanitizedFilename = path.basename(tempFilename);
        if (sanitizedFilename !== tempFilename) {
          results[tempFilename] = false;
          continue;
        }

        // Define path for temporary location only
        const tempPath = path.join(process.cwd(), 'public', 'uploads', 'temp', sanitizedFilename);
        
        // Check and delete from temp directory only
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
          console.log(`Deleted temporary file: ${tempPath}`);
          results[tempFilename] = true;
        } else {
          console.log(`Temporary file not found for cleanup: ${tempFilename}`);
          results[tempFilename] = false;
        }
        
        // We no longer delete from the media directory as those files are considered finalized
        // and should be kept for message attachments
      } catch (error) {
        console.error(`Error cleaning up file ${tempFilename}:`, error);
        results[tempFilename] = false;
      }
    }

    return NextResponse.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error in cleanup API:', error);
    return NextResponse.json({ error: 'Failed to clean up files' }, { status: 500 });
  }
}
