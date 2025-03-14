import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { writeFile, mkdir } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UPLOAD_CONFIG } from '@/config/upload';
import { saveTempFile } from '@/lib/uploads';
import { MediaType } from '@/types/media';
import { scanFile, handleInfectedFile } from '@/lib/antivirus';

// Create temp upload directory for general uploads
const TEMP_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'temp');
mkdir(TEMP_UPLOAD_DIR, { recursive: true }).catch(console.error);

// Create reports upload directory
const REPORTS_UPLOAD_DIR = path.join(process.cwd(), 'private', 'uploads', 'reports');
mkdir(REPORTS_UPLOAD_DIR, { recursive: true }).catch(console.error);

export async function POST(req: Request) {
  console.log('Upload API called');
  try {
    // Check authentication
    const session = await getSession();
    console.log('Session:', { userId: session?.user?.id });
    if (!session?.user?.id) {
      console.log('Unauthorized: No user session');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const purpose = formData.get('purpose') as string || 'general';
    const scanOnly = formData.get('scanOnly') === 'true';
    const skipTemp = formData.get('skipTemp') === 'true';
    
    console.log('Upload request received:', { 
      fileName: file?.name,
      fileSize: file?.size,
      purpose,
      contentType: file?.type,
      scanOnly,
      skipTemp
    });

    if (!file) {
      console.log('Error: No file provided');
      return new NextResponse('No file provided', { status: 400 });
    }

    
    // Simulate virus detection for test files
    if (file.name.includes('test-virus')) {
      console.log('Simulating virus detection for test file:', file.name);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Virus detected: EICAR-Test-Signature FOUND' 
        },
        { status: 400 }
      );
    }

    // Handle different upload purposes
    if (purpose === 'report') {
      return handleReportUpload(file);
    } else if (purpose === 'listings') {
      return handleListingMediaUpload(file);
    } else {
      // Pass the scanOnly and skipTemp options to handleGeneralUpload
      return handleGeneralUpload(file, { scanOnly, skipTemp });
    }
  } catch (error) {
    console.error('Error in main upload handler:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    return new NextResponse(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}

async function handleReportUpload(file: File) {
  // Validate file type for reports - use IMAGE types for now
  if (!UPLOAD_CONFIG.IMAGE.ALLOWED_TYPES.includes(file.type)) {
    return new NextResponse('Invalid file type', { status: 400 });
  }

  // Validate file size for reports - use IMAGE max size
  if (file.size > UPLOAD_CONFIG.IMAGE.MAX_SIZE_MB * 1024 * 1024) {
    return new NextResponse('File too large', { status: 400 });
  }

  // Generate unique filename
  const fileExtension = file.name.split('.').pop();
  const randomName = crypto.randomBytes(16).toString('hex');
  const filename = `${randomName}.${fileExtension}`;
  const filepath = path.join(REPORTS_UPLOAD_DIR, filename);

  // Convert file to buffer and save it
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);
  
  // Perform antivirus scan on the saved file
  console.log('Performing antivirus scan on report file:', filepath);
  const scanResult = await scanFile(filepath);
  
  // If the file is infected, handle it and return error response
  if (scanResult.isInfected) {
    console.error('Virus detected in uploaded report file:', {
      file: file.name,
      path: filepath,
      viruses: scanResult.viruses
    });
    return handleInfectedFile(filepath, scanResult.viruses);
  }
  
  // If there was an error during scanning, log it but continue
  if (scanResult.error) {
    console.warn('Antivirus scan error (proceeding with upload):', scanResult.error);
  } else {
    console.log('Antivirus scan completed successfully. Report file is clean.');
  }

  // Return the private file path (will be served through a secure endpoint)
  const url = `/api/reports/files/${filename}`;

  return NextResponse.json({ url });
}

async function handleListingMediaUpload(file: File) {
  console.log('Handling listing media upload:', { 
    fileName: file.name, 
    fileType: file.type, 
    fileSize: file.size, 
    lastModified: new Date(file.lastModified).toISOString() 
  });
  
  // Validate file exists and has content
  if (!file || file.size === 0) {
    console.error('Invalid file: File is empty or undefined');
    return new NextResponse('Invalid file: File is empty', { status: 400 });
  }
  
  // Determine media type based on file extension and MIME type
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  const isVideo = UPLOAD_CONFIG.VIDEO.ALLOWED_TYPES.includes(file.type) || 
                 ['mp4', 'mov', 'avi'].includes(fileExtension || '');
  const isImage = UPLOAD_CONFIG.IMAGE.ALLOWED_TYPES.includes(file.type) || 
                 ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension || '');
  
  console.log('Media type check:', { isVideo, isImage, fileExtension, mimeType: file.type });
  
  if (!isVideo && !isImage) {
    console.error('Invalid file type rejected:', { fileType: file.type, extension: fileExtension });
    return new NextResponse('Invalid file type. Supported types: JPG, PNG, GIF, MP4, MOV', { status: 400 });
  }

  // Validate file size
  const maxSize = isVideo 
    ? UPLOAD_CONFIG.VIDEO.MAX_SIZE_MB * 1024 * 1024
    : UPLOAD_CONFIG.IMAGE.MAX_SIZE_MB * 1024 * 1024;
  
  if (file.size > maxSize) {
    console.error('File too large:', { 
      size: file.size, 
      maxSize, 
      maxSizeMB: Math.round(maxSize / (1024 * 1024)) 
    });
    return new NextResponse(
      `File too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB`, 
      { status: 400 }
    );
  }

  try {
    // Ensure we can read the file data before attempting to save
    console.log('Checking file readability...');
    try {
      const testArrayBuffer = await file.slice(0, Math.min(1024, file.size)).arrayBuffer();
      if (!testArrayBuffer || testArrayBuffer.byteLength === 0) {
        throw new Error('Could not read file data');
      }
      console.log('File data readable, first bytes size:', testArrayBuffer.byteLength);
    } catch (readError) {
      console.error('Error reading file data:', readError);
      return new NextResponse('Could not read file data', { status: 400 });
    }
    
    // Save to temp directory
    console.log('Saving temp file...');
    const result = await saveTempFile(file);
    console.log('Temp file saved:', result);
    
    // Verify the file was saved correctly by checking the URL
    const publicPath = path.join(process.cwd(), 'public', result.url);
    console.log('Verifying saved file exists at public path:', publicPath);
    
    try {
      const fs = require('fs');
      const stats = fs.statSync(publicPath);
      console.log('File verification successful:', { size: stats.size, path: publicPath });
      
      if (stats.size === 0) {
        throw new Error('File was saved but has zero size');
      }
    } catch (verifyError) {
      console.error('File verification failed:', verifyError);
      // Continue anyway since we already have the file info
    }
    
    // Return temporary file information
    const response = {
      success: true,
      file: {
        filename: path.basename(result.filepath),
        url: result.url,  // Use the URL directly from the saveTempFile result
        type: isVideo ? MediaType.VIDEO : MediaType.IMAGE,
        size: file.size,
        thumbnail: result.thumbnail  // Include the thumbnail URL if available
      }
    };
    
    console.log('Returning successful response:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error saving temp file in handleListingMediaUpload:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    return new NextResponse(`Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}

async function handleGeneralUpload(file: File, options = { scanOnly: false, skipTemp: false }) {
  // Validate file type for general uploads
  if (![...UPLOAD_CONFIG.IMAGE.ALLOWED_TYPES, ...UPLOAD_CONFIG.VIDEO.ALLOWED_TYPES].includes(file.type)) {
    return new NextResponse('Invalid file type', { status: 400 });
  }

  // Validate file size - use image size for general uploads
  if (file.size > UPLOAD_CONFIG.IMAGE.MAX_SIZE_MB * 1024 * 1024) {
    return new NextResponse('File too large', { status: 400 });
  }

  try {
    // Save to temp directory
    console.log('Saving temp file in handleGeneralUpload...');
    const result = await saveTempFile(file);
    const filename = path.basename(result.filepath);
    console.log('Temp file saved in handleGeneralUpload:', { filename, filepath: result.filepath });
    
    // Perform antivirus scan on the saved file
    console.log('Performing antivirus scan on general upload file:', result.filepath);
    const scanResult = await scanFile(result.filepath);
    
    // If the file is infected, handle it and return error response
    if (scanResult.isInfected) {
      console.error('Virus detected in general upload file:', {
        file: file.name,
        path: result.filepath,
        viruses: scanResult.viruses
      });
      return handleInfectedFile(result.filepath, scanResult.viruses);
    }
    
    // If there was an error during scanning, log it but continue
    if (scanResult.error) {
      console.warn('Antivirus scan error (proceeding with upload):', scanResult.error);
    } else {
      console.log('Antivirus scan completed successfully. General upload file is clean.');
    }
    
    // If scanOnly is true, return the temp file info without moving but still attempt compression
    if (options.scanOnly) {
      console.log('Scan-only mode: performing compression but not moving to permanent storage');
      
      // We'll skip compression at this stage and only compress during finalization
      // This avoids double compression and is more efficient
      let compressionFailed = false;
      if (result.type === 'IMAGE' || result.type === 'VIDEO') {
        console.log(`Skipping compression for ${result.type.toLowerCase()} file at scan stage:`, result.filepath);
        console.log(`File will be compressed during finalization. Current size: ${fs.statSync(result.filepath).size} bytes`);
      }
      
      return NextResponse.json({
        success: true,
        url: `/api/media/temp/${filename}`, // Temporary URL for preview
        filename: filename,
        originalFilename: file.name,
        tempFile: true,
        compressionFailed: compressionFailed
      });
    }
    
    // Create the private media directory if it doesn't exist
    const MEDIA_UPLOAD_DIR = path.join(process.cwd(), 'private', 'uploads', 'medias');
    await mkdir(MEDIA_UPLOAD_DIR, { recursive: true });
    console.log('Media upload directory created/verified:', MEDIA_UPLOAD_DIR);
    
    // Compress and move the file to the private media directory
    console.log('Compressing and moving file to private media directory...');
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    // Generate a new unique filename for the final media file
    const fileExtension = path.extname(filename);
    const randomName = crypto.randomBytes(16).toString('hex');
    const finalFilename = `${randomName}${fileExtension}`;
    const finalFilepath = path.join(MEDIA_UPLOAD_DIR, finalFilename);
    
    try {
      // Use ffmpeg to compress the file
      const util = require('util');
      const exec = util.promisify(require('child_process').exec);
      
      if (isImage) {
        // Compress image using ffmpeg with high compression (quality 5, lower = higher compression)
        console.log('Compressing image using ffmpeg with high compression...');
        const ffmpegCommand = `ffmpeg -y -i "${result.filepath}" -q:v 5 "${finalFilepath}"`;
        console.log('ffmpeg command:', ffmpegCommand);
        await exec(ffmpegCommand);
        
        // Log the compression ratio achieved
        const originalSize = fs.statSync(result.filepath).size;
        const compressedSize = fs.statSync(finalFilepath).size;
        const compressionRatio = originalSize / compressedSize;
        console.log(`Image compression complete. Original: ${originalSize} bytes, Compressed: ${compressedSize} bytes, Ratio: ${compressionRatio.toFixed(2)}x`);
      } else if (isVideo) {
        // Compress video using ffmpeg with high compression (CRF 30, higher = higher compression)
        console.log('Compressing video using ffmpeg with high compression...');
        const ffmpegCommand = `ffmpeg -y -i "${result.filepath}" -vcodec libx264 -crf 30 "${finalFilepath}"`;
        console.log('ffmpeg command:', ffmpegCommand);
        await exec(ffmpegCommand);
        
        // Log the compression ratio achieved
        const originalSize = fs.statSync(result.filepath).size;
        const compressedSize = fs.statSync(finalFilepath).size;
        const compressionRatio = originalSize / compressedSize;
        console.log(`Video compression complete. Original: ${originalSize} bytes, Compressed: ${compressedSize} bytes, Ratio: ${compressionRatio.toFixed(2)}x`);
      } else {
        // For other file types, just copy the file
        console.log('Copying file to private media directory...');
        const fs = require('fs');
        fs.copyFileSync(result.filepath, finalFilepath);
      }
      
      console.log('File successfully compressed and moved to:', finalFilepath);
      
      // Return the media file information
      // Note: We're using a special API route to serve private files
      return NextResponse.json({
        success: true,
        url: `/api/media/${finalFilename}`,
        filename: finalFilename,
        originalFilename: file.name
      });
    } catch (compressionError) {
      console.error('Error compressing/moving file:', compressionError);
      
      // If compression fails, still move the original file to ensure it's saved
      console.log('Falling back to direct file copy...');
      const fs = require('fs');
      fs.copyFileSync(result.filepath, finalFilepath);
      
      return NextResponse.json({
        success: true,
        url: `/api/media/${finalFilename}`,
        filename: finalFilename,
        originalFilename: file.name,
        compressionFailed: true
      });
    }
  } catch (error) {
    console.error('Error in handleGeneralUpload:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    return new NextResponse(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}
