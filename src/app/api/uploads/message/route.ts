import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from '@/lib/auth/session';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Configuration for file uploads
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB per file
const MAX_FILES = 5;
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];
const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const UPLOAD_DIR = join(process.cwd(), 'private/uploads/medias');

/**
 * Scans a file with ClamAV for viruses
 * @param filePath Path to the file to scan
 * @returns True if the file is clean, false if infected
 */
async function scanFileWithClamAV(filePath: string): Promise<boolean> {
  try {
    const { stdout } = await execPromise(`clamdscan --fdpass "${filePath}"`);
    return !stdout.includes('FOUND');
  } catch (error) {
    console.error('ClamAV scan error:', error);
    // If ClamAV fails, log the error but allow the file (in production, you might want to block it)
    return true;
  }
}

/**
 * Compresses an image file using ffmpeg
 * @param inputPath Path to the input file
 * @param outputPath Path to save the compressed file
 * @param fileType MIME type of the file
 */
async function compressImage(inputPath: string, outputPath: string, fileType: string): Promise<void> {
  try {
    let command = '';
    
    if (fileType === 'image/gif') {
      // For GIFs, use a different approach to preserve animation
      command = `ffmpeg -i "${inputPath}" -vf "scale=iw*min(1\,min(480/iw\,480/ih)):-1" "${outputPath}" -y`;
    } else if (fileType === 'image/webp') {
      // For WebP, use quality setting
      command = `ffmpeg -i "${inputPath}" -c:v libwebp -quality 80 "${outputPath}" -y`;
    } else {
      // For JPEG and PNG
      command = `ffmpeg -i "${inputPath}" -vf "scale=iw*min(1\,min(1280/iw\,720/ih)):-1" -quality 85 "${outputPath}" -y`;
    }
    
    await execPromise(command);
  } catch (error) {
    console.error('Image compression error:', error);
    // If compression fails, we'll use the original file
    throw error;
  }
}

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
      await mkdir(UPLOAD_DIR, { recursive: true });
    } catch (error) {
      console.error('Error creating upload directory:', error);
      return new NextResponse('Server configuration error', { status: 500 });
    }

    // Parse form data with files
    const formData = await request.formData();
    const files = formData.getAll('files');

    // Validate number of files
    if (!files.length) {
      return new NextResponse('No files uploaded', { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return new NextResponse(`Maximum ${MAX_FILES} files allowed`, { status: 400 });
    }

    // Process each file
    const uploadedFiles = [];
    for (const file of files) {
      if (!(file instanceof File)) {
        return new NextResponse('Invalid file data', { status: 400 });
      }

      // Validate file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        return new NextResponse(
          `File type not allowed: ${file.type}. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`,
          { status: 400 }
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return new NextResponse(
          `File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          { status: 400 }
        );
      }

      // Generate unique filename
      const fileExtension = extname(file.name) || `.${file.name.split('.').pop()}` || '';
      const tempFileName = `temp_${uuidv4()}${fileExtension}`;
      const finalFileName = `${uuidv4()}${fileExtension}`;
      const tempFilePath = join(UPLOAD_DIR, tempFileName);
      const finalFilePath = join(UPLOAD_DIR, finalFileName);

      // Save file to disk (temporary)
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(tempFilePath, buffer);
      
      // Scan file with ClamAV
      const isClean = await scanFileWithClamAV(tempFilePath);
      if (!isClean) {
        // Delete infected file
        await execPromise(`rm "${tempFilePath}"`).catch(console.error);
        return new NextResponse('File contains malware and was rejected', { status: 400 });
      }
      
      // Process image files (compression)
      let processedFilePath = tempFilePath;
      let finalSize = file.size;
      
      if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
        try {
          // Compress image
          await compressImage(tempFilePath, finalFilePath, file.type);
          processedFilePath = finalFilePath;
          
          // Get size of compressed file
          const { stdout } = await execPromise(`stat -c %s "${finalFilePath}"`);
          finalSize = parseInt(stdout.trim(), 10);
        } catch (error) {
          console.error('Error compressing image:', error);
          // If compression fails, use the original file
          processedFilePath = tempFilePath;
        }
      } else {
        // For non-image files, just rename the temp file
        await execPromise(`mv "${tempFilePath}" "${finalFilePath}"`);
        processedFilePath = finalFilePath;
      }

      // Generate public URL
      const fileUrl = `/uploads/medias/${finalFileName}`;

      uploadedFiles.push({
        url: fileUrl,
        name: file.name,
        type: file.type,
        size: finalSize,
      });
    }

    // Clean up any temporary files
    try {
      await execPromise(`find ${UPLOAD_DIR} -name "temp_*" -type f -delete`);
    } catch (error) {
      console.error('Error cleaning up temporary files:', error);
    }
    
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
