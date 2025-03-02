import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import util from 'util';
import { MediaType, MediaProcessingStatus } from '@/types/media';
import prisma from '@/lib/prisma';

const execPromise = util.promisify(exec);

interface ProcessMediaOptions {
  inputPath: string;
  outputDir: string;
  filename: string;
  mediaType: MediaType;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxVideoDuration?: number; // in seconds
}

/**
 * Process media (image or video) and return the processed file path
 */
export async function processMedia(options: ProcessMediaOptions): Promise<{
  url: string;
  thumbnail?: string;
  status: MediaProcessingStatus;
  error?: string;
}> {
  const {
    inputPath,
    outputDir,
    filename,
    mediaType,
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 80,
    maxVideoDuration = 600 // 10 minutes
  } = options;

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  // For images, preserve the original extension if it's jpg/jpeg/png
  // For videos, always convert to mp4
  let outputExtension = 'jpg';
  if (mediaType === MediaType.VIDEO) {
    outputExtension = 'mp4';
  } else if (mediaType === MediaType.IMAGE) {
    const originalExt = path.parse(filename).ext.toLowerCase();
    if (['.jpg', '.jpeg', '.png'].includes(originalExt)) {
      // Keep original extension without the dot
      outputExtension = originalExt.substring(1);
    }
  }
  
  const outputFilename = `${path.parse(filename).name}.${outputExtension}`;
  const outputPath = path.join(outputDir, outputFilename);
  
  try {
    if (mediaType === MediaType.IMAGE) {
      console.log(`Processing image ${filename}`);
      
      // Check if the input path is the same as the output path
      const isSamePath = inputPath === outputPath;
      console.log(`Input path: ${inputPath}`);
      console.log(`Output path: ${outputPath}`);
      console.log(`Same path: ${isSamePath}`);
      
      // If input and output paths are the same, create a temporary copy to process
      let pathToProcess = inputPath;
      if (isSamePath) {
        const tempPath = `${inputPath}.temp`;
        console.log(`Creating temporary copy at ${tempPath}`);
        await fs.promises.copyFile(inputPath, tempPath);
        pathToProcess = tempPath;
      }
      
      try {
        // Process image using sharp (needs to be installed)
        const sharp = await import('sharp');
        
        // Read the image metadata first
        const metadata = await sharp.default(pathToProcess).metadata();
        console.log(`Image metadata:`, {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          orientation: metadata.orientation || 'none'
        });
        
        // Create a new sharp instance with more explicit orientation handling
        const sharpInstance = sharp.default(pathToProcess, {
          // Ensure we read the orientation from EXIF
          failOnError: false
        });
        
        // Apply transformations while preserving orientation
        const pipeline = sharpInstance
          // First rotate based on EXIF orientation
          .rotate()
          // Then resize the image
          .resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true
          });
        
        // Determine output format based on extension
        const outputExt = path.parse(outputFilename).ext.toLowerCase();
        console.log(`Output format based on extension: ${outputExt}`);
        
        if (outputExt === '.png') {
          console.log(`Processing as PNG with quality: ${Math.min(quality, 90)}`);
          await pipeline
            .png({ quality: Math.min(quality, 90) })
            .toFile(outputPath);
        } else {
          // Default to JPEG for all other formats
          console.log(`Processing as JPEG with quality: ${quality}`);
          await pipeline
            .jpeg({ 
              quality,
              mozjpeg: true, // Better compression
            })
            .toFile(outputPath);
        }
        
        // Clean up temp file if created
        if (isSamePath && pathToProcess !== inputPath) {
          console.log(`Cleaning up temporary file ${pathToProcess}`);
          await fs.promises.unlink(pathToProcess).catch(err => {
            console.error(`Error deleting temp file: ${err.message}`);
          });
        }
        
        console.log(`Image processed: ${filename} -> ${outputFilename} (format: ${outputExt})`);

        return {
          url: `/uploads/listings/${outputFilename}`,
          status: MediaProcessingStatus.COMPLETED
        };
      } catch (imageError) {
        console.error(`Error processing image ${filename}:`, imageError);
        
        // Clean up temp file if created
        if (isSamePath && pathToProcess !== inputPath) {
          console.log(`Cleaning up temporary file ${pathToProcess} after error`);
          await fs.promises.unlink(pathToProcess).catch(() => {});
        }
        
        throw imageError;
      }
    } else if (mediaType === MediaType.VIDEO) {
      console.log(`Processing video ${filename}`);
      
      // First check video duration
      console.log(`Checking duration of video ${filename}`);
      const { stdout: durationOutput } = await execPromise(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`
      );
      
      const duration = parseFloat(durationOutput.trim());
      console.log(`Video duration: ${duration} seconds (max allowed: ${maxVideoDuration} seconds)`);
      
      if (duration > maxVideoDuration) {
        throw new Error(`Video duration exceeds maximum allowed (${maxVideoDuration} seconds)`);
      }

      // Generate thumbnail
      const thumbnailFilename = `${path.parse(filename).name}_thumb.jpg`;
      const thumbnailPath = path.join(outputDir, thumbnailFilename);
      
      console.log(`Generating thumbnail for video ${filename} at ${thumbnailPath}`);
      let thumbnailGenerated = false;
      try {
        // Try to generate at 1 second
        await execPromise(
          `ffmpeg -i "${inputPath}" -ss 00:00:01 -frames:v 1 -q:v 2 "${thumbnailPath}"`
        );
        thumbnailGenerated = true;
        console.log(`Thumbnail generated successfully at ${thumbnailPath}`);
      } catch (thumbnailError) {
        console.error(`Error generating thumbnail at 1 second for video ${filename}:`, thumbnailError);
        
        // Try again at 0 seconds if first attempt failed
        try {
          await execPromise(
            `ffmpeg -i "${inputPath}" -ss 00:00:00 -frames:v 1 -q:v 2 "${thumbnailPath}"`
          );
          thumbnailGenerated = true;
          console.log(`Thumbnail generated successfully at 0 seconds at ${thumbnailPath}`);
        } catch (secondThumbnailError) {
          console.error(`Error generating thumbnail at 0 seconds for video ${filename}:`, secondThumbnailError);
          // Continue with video processing even if thumbnail generation fails
        }
      }

      // Compress video
      console.log(`Compressing video ${filename} to ${outputPath}`);
      try {
        // Add timeout to prevent hanging
        const ffmpegCommand = `ffmpeg -i "${inputPath}" -vf "scale='min(${maxWidth},iw)':'min(${maxHeight},ih)'" -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k -t ${maxVideoDuration} "${outputPath}"`;
        
        // Create a promise that resolves after a timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Video compression timed out after ${5 * 60} seconds`));
          }, 5 * 60 * 1000); // 5 minute timeout
        });
        
        // Race the ffmpeg command against the timeout
        await Promise.race([
          execPromise(ffmpegCommand),
          timeoutPromise
        ]);
        
        console.log(`Video compressed successfully to ${outputPath}`);
        
        // Verify the output file exists and has content
        const stats = await fs.promises.stat(outputPath);
        if (stats.size === 0) {
          throw new Error('Compressed video file is empty');
        }
      } catch (compressionError) {
        console.error(`Error compressing video ${filename}:`, compressionError);
        // Copy the original file as fallback instead of failing
        console.log(`Using original video file as fallback`);
        try {
          await fs.promises.copyFile(inputPath, outputPath);
          console.log(`Copied original video to ${outputPath} as fallback`);
        } catch (copyError) {
          console.error(`Failed to copy original video as fallback:`, copyError);
          throw compressionError; // Re-throw if even the fallback fails
        }
      }

      console.log(`Video processing completed for ${filename}`);
      return {
        url: `/uploads/listings/${outputFilename}`,
        thumbnail: thumbnailGenerated ? `/uploads/listings/${thumbnailFilename}` : undefined,
        status: MediaProcessingStatus.COMPLETED
      };
    } else {
      throw new Error(`Unsupported media type: ${mediaType}`);
    }
  } catch (error) {
    console.error('Media processing error:', error);
    return {
      url: `/uploads/temp/${filename}`, // Return original file path
      status: MediaProcessingStatus.FAILED,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Map database media to frontend MediaFile format
 */
export function mapDbMediaToMediaFile(dbMedia: any): any {
  return {
    id: dbMedia.id,
    url: dbMedia.url,
    filename: dbMedia.filename,
    type: dbMedia.type as MediaType,
    order: dbMedia.order,
    isMain: dbMedia.isMainMedia,
    thumbnail: dbMedia.thumbnail,
    status: dbMedia.status as MediaProcessingStatus,
  };
}

/**
 * Clean up unused media files
 */
export async function cleanupUnusedMedia(olderThanHours = 24): Promise<number> {
  try {
    // Find media records that are older than the specified time and not associated with any listing
    const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    const unusedMedia = await prisma.listingMedia.findMany({
      where: {
        createdAt: {
          lt: cutoffDate
        },
        listingId: {
          equals: null
        }
      }
    });
    
    // Delete the files and records
    let deletedCount = 0;
    
    for (const media of unusedMedia) {
      try {
        // Log the media object structure
        console.log('Media object structure:', Object.keys(media));
        
        // Delete the file
        if (media.url) {
          const filePath = path.join(process.cwd(), 'public', new URL(media.url).pathname);
          if (fs.existsSync(filePath)) {
            await unlink(filePath);
          }
        }
        
        // Delete thumbnail if exists
        if (media.thumbnail) {
          const thumbnailPath = path.join(process.cwd(), 'public', new URL(media.thumbnail).pathname);
          if (fs.existsSync(thumbnailPath)) {
            await unlink(thumbnailPath);
          }
        }
        
        // Delete the record
        await prisma.listingMedia.delete({
          where: { id: media.id }
        });
        
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete media ${media.id}:`, error);
      }
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up unused media:', error);
    return 0;
  }
}

/**
 * Delete temporary files
 */
export async function cleanupTempFiles(olderThanHours = 24): Promise<number> {
  try {
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
    if (!fs.existsSync(tempDir)) {
      return 0;
    }
    
    const files = await fs.promises.readdir(tempDir);
    const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.promises.stat(filePath);
      
      if (stats.isFile() && stats.mtimeMs < cutoffTime) {
        await unlink(filePath);
        deletedCount++;
      }
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up temp files:', error);
    return 0;
  }
}
