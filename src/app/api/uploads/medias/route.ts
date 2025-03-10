import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  validateFileUpload,
  MAX_FILE_SIZE,
  MAX_FILES,
  ALLOWED_FILE_TYPES
} from '@/middleware/fileValidation';
import {
  saveFile,
  cleanupTempFiles,
  UPLOAD_DIR,
  ensureUploadDir
} from '@/lib/fileUtils';

/**
 * Handles file uploads for message attachments
 */

/**
 * Handles file uploads for message attachments
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Ensure upload directory exists
    try {
      await ensureUploadDir(UPLOAD_DIR);
    } catch (error) {
      console.error('Error creating upload directory:', error);
      return new NextResponse('Server configuration error', { status: 500 });
    }
    
    // Validate files using the middleware
    const validationError = await validateFileUpload(
      request as any, // Type cast to NextRequest
      'files',
      {
        maxFiles: MAX_FILES,
        maxFileSize: MAX_FILE_SIZE,
        allowedTypes: ALLOWED_FILE_TYPES
      }
    );
    
    if (validationError) {
      return validationError;
    }
    
    // Parse form data with files
    const formData = await request.formData();
    const files = formData.getAll('files');

    // Process each file
    const uploadedFiles = [];
    for (const file of files) {
      if (!(file instanceof File)) {
        return new NextResponse('Invalid file data', { status: 400 });
      }

      try {
        // Save the file using our utility function
        const savedFile = await saveFile(file, UPLOAD_DIR, {
          scanForViruses: true,
          compressImages: true
        });
        
        uploadedFiles.push({
          url: savedFile.url,
          name: savedFile.name,
          type: savedFile.type,
          size: savedFile.size,
        });
      } catch (error) {
        console.error('Error saving file:', error);
        return new NextResponse(
          `Error processing file ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { status: 400 }
        );
      }
    }

    // Clean up any temporary files
    await cleanupTempFiles(UPLOAD_DIR);
    
    return NextResponse.json({
      success: true,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    return new NextResponse(
      `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { status: 500 }
    );
  }
}
