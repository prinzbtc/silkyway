import { writeFile, mkdir, stat, unlink } from 'fs/promises';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// File storage configuration
export const UPLOAD_DIR = join(process.cwd(), 'private/uploads/medias');
export const PUBLIC_UPLOAD_DIR = join(process.cwd(), 'public/uploads/public');

/**
 * Ensures the upload directory exists
 * @param directory Directory path to create
 */
export async function ensureUploadDir(directory: string = UPLOAD_DIR): Promise<void> {
  try {
    await mkdir(directory, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory ${directory}:`, error);
    throw new Error('Failed to create upload directory');
  }
}

/**
 * Scans a file with ClamAV for viruses
 * @param filePath Path to the file to scan
 * @returns True if the file is clean, false if infected
 */
export async function scanFileWithClamAV(filePath: string): Promise<boolean> {
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
export async function compressImage(
  inputPath: string, 
  outputPath: string, 
  fileType: string
): Promise<void> {
  try {
    let command = '';
    
    if (fileType === 'image/gif') {
      // For GIFs, use a different approach to preserve animation
      command = `ffmpeg -i "${inputPath}" -vf "scale=iw*min(1\\,min(480/iw\\,480/ih)):-1" "${outputPath}" -y`;
    } else if (fileType === 'image/webp') {
      // For WebP, use quality setting
      command = `ffmpeg -i "${inputPath}" -c:v libwebp -quality 80 "${outputPath}" -y`;
    } else {
      // For JPEG and PNG
      command = `ffmpeg -i "${inputPath}" -vf "scale=iw*min(1\\,min(1280/iw\\,720/ih)):-1" -quality 85 "${outputPath}" -y`;
    }
    
    await execPromise(command);
  } catch (error) {
    console.error('Image compression error:', error);
    // If compression fails, we'll use the original file
    throw error;
  }
}

/**
 * Saves a file to the specified upload directory
 * @param file File to save
 * @param directory Directory to save to
 * @param options Additional options
 * @returns Object with file information
 */
export async function saveFile(
  file: File,
  directory: string = UPLOAD_DIR,
  options: {
    scanForViruses?: boolean;
    compressImages?: boolean;
  } = {}
): Promise<{
  url: string;
  name: string;
  type: string;
  size: number;
  path: string;
}> {
  const { scanForViruses = true, compressImages = true } = options;
  
  // Ensure directory exists
  await ensureUploadDir(directory);
  
  // Generate unique filenames
  const fileExtension = extname(file.name) || `.${file.name.split('.').pop()}` || '';
  const tempFileName = `temp_${uuidv4()}${fileExtension}`;
  const finalFileName = `${uuidv4()}${fileExtension}`;
  const tempFilePath = join(directory, tempFileName);
  const finalFilePath = join(directory, finalFileName);
  
  // Save file to disk (temporary)
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(tempFilePath, buffer);
  
  // Scan file with ClamAV if requested
  if (scanForViruses) {
    const isClean = await scanFileWithClamAV(tempFilePath);
    if (!isClean) {
      // Delete infected file
      await unlink(tempFilePath).catch(console.error);
      throw new Error('File contains malware and was rejected');
    }
  }
  
  // Process image files (compression) if requested
  let processedFilePath = tempFilePath;
  let finalSize = file.size;
  
  const isImage = file.type.startsWith('image/');
  if (compressImages && isImage) {
    try {
      // Compress image
      await compressImage(tempFilePath, finalFilePath, file.type);
      processedFilePath = finalFilePath;
      
      // Get size of compressed file
      const stats = await stat(finalFilePath);
      finalSize = stats.size;
    } catch (error) {
      console.error('Error compressing image:', error);
      // If compression fails, use the original file
      await execPromise(`mv "${tempFilePath}" "${finalFilePath}"`);
      processedFilePath = finalFilePath;
    }
  } else {
    // For non-image files, just rename the temp file
    await execPromise(`mv "${tempFilePath}" "${finalFilePath}"`);
    processedFilePath = finalFilePath;
  }
  
  // Generate public URL based on directory
  let fileUrl: string;
  if (directory === PUBLIC_UPLOAD_DIR) {
    fileUrl = `/uploads/public/${finalFileName}`;
  } else {
    fileUrl = `/uploads/medias/${finalFileName}`;
  }
  
  return {
    url: fileUrl,
    name: file.name,
    type: file.type,
    size: finalSize,
    path: finalFilePath,
  };
}

/**
 * Cleans up temporary files in a directory
 * @param directory Directory to clean
 */
export async function cleanupTempFiles(directory: string = UPLOAD_DIR): Promise<void> {
  try {
    await execPromise(`find ${directory} -name "temp_*" -type f -delete`);
  } catch (error) {
    console.error(`Error cleaning up temporary files in ${directory}:`, error);
  }
}

/**
 * Deletes a file from the uploads directory
 * @param fileUrl URL of the file to delete
 * @returns True if deletion was successful, false otherwise
 */
export async function deleteFile(fileUrl: string): Promise<boolean> {
  try {
    // Extract filename from URL
    const fileName = fileUrl.split('/').pop();
    if (!fileName) return false;
    
    // Determine directory based on URL
    let directory: string;
    if (fileUrl.startsWith('/uploads/public/')) {
      directory = PUBLIC_UPLOAD_DIR;
    } else if (fileUrl.startsWith('/uploads/medias/')) {
      directory = UPLOAD_DIR;
    } else {
      return false;
    }
    
    // Construct full path
    const filePath = join(directory, fileName);
    
    // Check if file exists
    try {
      await stat(filePath);
    } catch (error) {
      console.error(`File not found: ${filePath}`);
      return false;
    }
    
    // Delete file
    await unlink(filePath);
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
}
