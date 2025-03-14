import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { ensureDirectoryExists } from '@/lib/uploads';

const exec = promisify(execCallback);

/**
 * API endpoint to finalize a previously scanned and processed file
 * This moves the file from the temporary location to its final destination
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the form data
    const formData = await request.formData();
    const tempFilename = formData.get('tempFilename') as string;
    const purpose = formData.get('purpose') as string;
    
    if (!tempFilename) {
      return NextResponse.json({ error: 'Missing temporary filename' }, { status: 400 });
    }

    // Validate the filename to prevent directory traversal
    const sanitizedFilename = path.basename(tempFilename);
    if (sanitizedFilename !== tempFilename) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    // Define paths
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
    const tempFilePath = path.join(tempDir, sanitizedFilename);
    
    console.log('Finalizing file:', {
      tempFilename: sanitizedFilename,
      tempFilePath,
      exists: fs.existsSync(tempFilePath)
    });

    // Check if the temp file exists
    if (!fs.existsSync(tempFilePath)) {
      return NextResponse.json({ error: 'Temporary file not found' }, { status: 404 });
    }

    // Determine the target directory based on purpose
    let targetDir: string;
    if (purpose === 'avatar') {
      targetDir = path.join(process.cwd(), 'private', 'uploads', 'avatars');
    } else if (purpose === 'listing') {
      targetDir = path.join(process.cwd(), 'private', 'uploads', 'listings');
    } else {
      // Default to 'general' for chat media files
      targetDir = path.join(process.cwd(), 'private', 'uploads', 'medias');
    }

    // Ensure the target directory exists
    ensureDirectoryExists(targetDir);

    // Get file type to determine if compression is needed
    const fileExtension = path.extname(sanitizedFilename).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(fileExtension);
    const isVideo = ['.mp4', '.webm', '.mov', '.avi'].includes(fileExtension);
    
    // Target file path
    const targetFilePath = path.join(targetDir, sanitizedFilename);
    
    // Apply high compression if it's an image or video
    if (isImage || isVideo) {
      console.log(`Applying high compression to ${isImage ? 'image' : 'video'} during finalization...`);
      
      try {
        // Log original file size
        const originalSize = fs.statSync(tempFilePath).size;
        console.log(`Original file size: ${originalSize} bytes`);
        
        if (isImage) {
          // Use ffmpeg with high compression for images (quality 5, lower = higher quality)
          // For images, we want a compression ratio of about 10x
          const ffmpegCommand = `ffmpeg -y -i "${tempFilePath}" -q:v 5 "${targetFilePath}"`;
          console.log('Executing ffmpeg command:', ffmpegCommand);
          await exec(ffmpegCommand);
        } else if (isVideo) {
          // Use ffmpeg with high compression for videos (CRF 30, higher = higher compression)
          const ffmpegCommand = `ffmpeg -y -i "${tempFilePath}" -vcodec libx264 -crf 30 "${targetFilePath}"`;
          console.log('Executing ffmpeg command:', ffmpegCommand);
          await exec(ffmpegCommand);
        }
        
        // Log compression results
        const compressedSize = fs.statSync(targetFilePath).size;
        const compressionRatio = originalSize / compressedSize;
        console.log(`Compression complete. Original: ${originalSize} bytes, Compressed: ${compressedSize} bytes`);
        console.log(`Compression ratio achieved: ${compressionRatio.toFixed(2)}x`);
        
        // Delete the temporary file
        fs.unlinkSync(tempFilePath);
      } catch (error) {
        console.error('Error during compression:', error);
        // Fallback to simple file move if compression fails
        console.log('Falling back to simple file move without compression');
        fs.renameSync(tempFilePath, targetFilePath);
      }
    } else {
      // For non-media files, just move without compression
      console.log('Non-media file, moving without compression');
      fs.renameSync(tempFilePath, targetFilePath);
    }

    // Extract original filename from the temp filename (if stored in format originalname_timestamp.ext)
    const filenameMatch = sanitizedFilename.match(/^(.+)_\d+\.[^.]+$/);
    const originalFilename = filenameMatch ? filenameMatch[1] : sanitizedFilename;

    // Return the URL for accessing the file
    return NextResponse.json({
      url: `/api/media/${sanitizedFilename}`,
      filename: sanitizedFilename,
      originalFilename: originalFilename,
      success: true
    });
  } catch (error) {
    console.error('Error finalizing upload:', error);
    return NextResponse.json({ error: 'Failed to finalize upload' }, { status: 500 });
  }
}
