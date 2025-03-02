import { writeFile, mkdir } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { MediaType, MediaProcessingStatus } from '@/types/media';
import { mapDbMediaToMediaFile } from './uploads.server';

export type UploadType = 'listings' | 'profile' | 'message' | 'report' | 'temp';

interface UploadConfig {
  isPrivate: boolean;
  maxSizeInMB: number;
  allowedTypes: string[];
  maxFiles?: number;
}

const uploadConfigs: Record<UploadType, UploadConfig> = {
  listings: {
    isPrivate: false,
    maxSizeInMB: 70,
    allowedTypes: [
      'image/jpeg', 
      'image/jpg', 
      'image/png', 
      'image/gif',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo'
    ],
    maxFiles: 8,
  },
  profile: {
    isPrivate: false,
    maxSizeInMB: 2,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
    maxFiles: 1,
  },
  message: {
    isPrivate: true,
    maxSizeInMB: 3,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'],
    maxFiles: 5,
  },
  report: {
    isPrivate: true,
    maxSizeInMB: 3,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'],
    maxFiles: 3,
  },
  temp: {
    isPrivate: false,
    maxSizeInMB: 70,
    allowedTypes: [
      'image/jpeg', 
      'image/jpg', 
      'image/png', 
      'image/gif',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo'
    ],
    maxFiles: 8,
  },
};

export class FileUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileUploadError';
  }
}

export async function validateFile(file: File, type: UploadType): Promise<void> {
  const config = uploadConfigs[type];

  if (!config.allowedTypes.includes(file.type)) {
    throw new FileUploadError(
      `Invalid file type. Allowed types: ${config.allowedTypes.join(', ')}`
    );
  }

  if (file.size > config.maxSizeInMB * 1024 * 1024) {
    throw new FileUploadError(
      `File too large. Maximum size: ${config.maxSizeInMB}MB`
    );
  }
}

export function getUploadConfig(type: UploadType): UploadConfig {
  return uploadConfigs[type];
}

export function getMediaType(file: File): MediaType {
  if (file.type.startsWith('image/')) {
    return MediaType.IMAGE;
  } else if (file.type.startsWith('video/')) {
    return MediaType.VIDEO;
  }
  throw new FileUploadError(`Unsupported file type: ${file.type}`);
}

export async function saveTempFile(
  file: File
): Promise<{ url: string; filepath: string; type: MediaType; thumbnail?: string }> {
  console.log('saveTempFile called with file:', { 
    name: file.name, 
    size: file.size, 
    type: file.type 
  });
  
  const config = uploadConfigs['temp'];
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
  console.log('Upload directory:', uploadDir);

  try {
    // Ensure upload directory exists
    console.log('Creating upload directory if it doesn\'t exist');
    await mkdir(uploadDir, { recursive: true });
    console.log('Upload directory created/verified');

    // Generate unique filename
    const fileExtension = file.name.split('.').pop();
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}.${fileExtension}`;
    const filepath = path.join(uploadDir, filename);
    console.log('Generated filepath:', filepath);

    // Convert file to buffer and save it
    console.log('Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer();
    console.log('File converted to arrayBuffer, size:', arrayBuffer.byteLength);
    
    const buffer = Buffer.from(arrayBuffer);
    console.log('Buffer created, size:', buffer.length);
    
    console.log('Writing file to disk...');
    await writeFile(filepath, buffer);
    
    // Verify file was written correctly
    try {
      const fs = require('fs');
      const stats = fs.statSync(filepath);
      console.log('File written successfully to:', filepath, 'Size:', stats.size);
      
      if (stats.size === 0) {
        console.error('WARNING: File was created but has zero size!');
      }
    } catch (verifyError) {
      console.error('Error verifying file was written:', verifyError);
    }

    // Determine media type
    const type = getMediaType(file);
    console.log('Media type determined:', type);

    // Generate thumbnail for video files
    let thumbnail: string | undefined;
    if (type === MediaType.VIDEO) {
      try {
        console.log('Generating thumbnail for video file...');
        // Generate a thumbnail filename
        const thumbnailFilename = `${randomName}_thumb.jpg`;
        const thumbnailPath = path.join(uploadDir, thumbnailFilename);
        
        console.log('Thumbnail will be saved at:', thumbnailPath);
        
        // Use ffmpeg to generate thumbnail
        const util = require('util');
        const exec = util.promisify(require('child_process').exec);
        
        console.log('Executing ffmpeg command...');
        const ffmpegCommand = `ffmpeg -i "${filepath}" -ss 00:00:01 -frames:v 1 -q:v 2 "${thumbnailPath}"`;
        console.log('Command:', ffmpegCommand);
        
        const { stdout, stderr } = await exec(ffmpegCommand);
        
        if (stderr) {
          console.log('ffmpeg stderr:', stderr);
        }
        
        if (stdout) {
          console.log('ffmpeg stdout:', stdout);
        }
        
        // Verify thumbnail was created
        console.log('Verifying thumbnail was created...');
        if (fs.existsSync(thumbnailPath)) {
          const thumbnailStats = fs.statSync(thumbnailPath);
          console.log('Thumbnail file stats:', thumbnailStats);
          
          if (thumbnailStats.size > 0) {
            thumbnail = `/uploads/temp/${thumbnailFilename}`;
            console.log('Video thumbnail generated successfully:', thumbnail);
          } else {
            console.warn('Thumbnail file exists but has zero size');
          }
        } else {
          console.warn('Thumbnail file was not created by ffmpeg');
        }
      } catch (thumbnailError) {
        console.error('Error generating video thumbnail:', thumbnailError);
        if (thumbnailError instanceof Error) {
          console.error('Error stack:', thumbnailError.stack);
        }
        // Continue without thumbnail if generation fails
      }
    }

    // Return appropriate URL
    const url = `/uploads/temp/${filename}`;
    console.log('Returning URL:', url, thumbnail ? `with thumbnail: ${thumbnail}` : 'without thumbnail');

    return { url, filepath, type, thumbnail };
  } catch (error) {
    console.error('Error in saveTempFile:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    throw error; // Re-throw to be handled by the caller
  }
}

export async function saveFile(
  file: File,
  type: UploadType
): Promise<{ url: string; filepath: string; mediaType: MediaType }> {
  const config = uploadConfigs[type];
  const baseDir = config.isPrivate ? 'private' : 'public';
  const uploadDir = path.join(process.cwd(), baseDir, 'uploads', type);

  // Ensure upload directory exists
  await mkdir(uploadDir, { recursive: true });

  // Generate unique filename
  const fileExtension = file.name.split('.').pop();
  const randomName = crypto.randomBytes(16).toString('hex');
  const filename = `${randomName}.${fileExtension}`;
  const filepath = path.join(uploadDir, filename);

  // Convert file to buffer and save it
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  // Determine media type
  const mediaType = getMediaType(file);

  // Return appropriate URL based on privacy setting
  const url = config.isPrivate
    ? `/api/${type}/files/${filename}`
    : `/uploads/${type}/${filename}`;

  return { url, filepath, mediaType };
}

export function getFilePath(filename: string, type: UploadType): string {
  const config = uploadConfigs[type];
  const baseDir = config.isPrivate ? 'private' : 'public';
  return path.join(process.cwd(), baseDir, 'uploads', type, filename);
}

/**
 * Moves a file from the temp directory to the specified target directory
 * @param tempUrl The URL of the temporary file (e.g., /uploads/temp/abc123.jpg)
 * @param targetType The type of upload (e.g., 'listing')
 * @returns The new URL of the file in the target directory and the thumbnail URL if applicable
 */
export async function moveFileFromTemp(
  tempUrl: string,
  targetType: UploadType
): Promise<{ url: string; thumbnail?: string }> {
  try {
    // Extract filename from URL
    const filename = tempUrl.split('/').pop();
    if (!filename) {
      throw new Error(`Invalid temp URL: ${tempUrl}`);
    }

    // Define source and target paths
    const tempPath = path.join(process.cwd(), 'public', 'uploads', 'temp', filename);
    const config = uploadConfigs[targetType];
    const baseDir = config.isPrivate ? 'private' : 'public';
    const targetDir = path.join(process.cwd(), baseDir, 'uploads', targetType);
    
    // Ensure target directory exists
    await mkdir(targetDir, { recursive: true });
    
    // Define target path
    const targetPath = path.join(targetDir, filename);
    
    // Read the file from temp
    const fs = require('fs');
    const fileContent = await fs.promises.readFile(tempPath);
    
    // Write to target location
    await fs.promises.writeFile(targetPath, fileContent);
    
    // Verify file was written correctly
    const stats = await fs.promises.stat(targetPath);
    if (stats.size === 0) {
      throw new Error(`File was moved but has zero size: ${targetPath}`);
    }
    
    // Return the new URL
    const newUrl = config.isPrivate
      ? `/api/${targetType}/files/${filename}`
      : `/uploads/${targetType}/${filename}`;
    
    console.log(`File moved from ${tempPath} to ${targetPath}`);
    console.log(`URL updated from ${tempUrl} to ${newUrl}`);
    
    // Check if there's a thumbnail file to move as well
    let thumbnailUrl: string | undefined;
    const fileBaseName = path.parse(filename).name;
    const thumbnailFilename = `${fileBaseName}_thumb.jpg`;
    const tempThumbnailPath = path.join(process.cwd(), 'public', 'uploads', 'temp', thumbnailFilename);
    
    // Check if thumbnail exists
    if (fs.existsSync(tempThumbnailPath)) {
      try {
        // Define target thumbnail path
        const targetThumbnailPath = path.join(targetDir, thumbnailFilename);
        
        // Read the thumbnail file from temp
        const thumbnailContent = await fs.promises.readFile(tempThumbnailPath);
        
        // Write to target location
        await fs.promises.writeFile(targetThumbnailPath, thumbnailContent);
        
        // Verify thumbnail was written correctly
        const thumbnailStats = await fs.promises.stat(targetThumbnailPath);
        if (thumbnailStats.size > 0) {
          thumbnailUrl = config.isPrivate
            ? `/api/${targetType}/files/${thumbnailFilename}`
            : `/uploads/${targetType}/${thumbnailFilename}`;
          
          console.log(`Thumbnail moved from ${tempThumbnailPath} to ${targetThumbnailPath}`);
          console.log(`Thumbnail URL updated to ${thumbnailUrl}`);
        }
      } catch (thumbnailError) {
        console.error('Error moving thumbnail file:', thumbnailError);
        // Continue without thumbnail if there's an error
      }
    }
    
    return { url: newUrl, thumbnail: thumbnailUrl };
  } catch (error) {
    console.error('Error moving file from temp:', error);
    // If there's an error, return the original URL
    return { url: tempUrl };
  }
}

export { mapDbMediaToMediaFile };
