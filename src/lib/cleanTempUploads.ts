import fs from 'fs/promises';
import path from 'path';

const TEMP_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'temp');
const TEN_MINUTES_IN_MS = 10 * 60 * 1000; // 10 minutes in milliseconds

export async function cleanTempUploads() {
  try {
    const files = await fs.readdir(TEMP_UPLOAD_DIR);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(TEMP_UPLOAD_DIR, file);
      
      try {
        const stats = await fs.stat(filePath);
        
        // Check if file is older than 10 minutes
        if (now - stats.mtime.getTime() > TEN_MINUTES_IN_MS) {
          await fs.unlink(filePath);
          console.log(`Deleted temp file: ${file}`);
        }
      } catch (statError) {
        console.error(`Error checking file ${file}:`, statError);
      }
    }
  } catch (error) {
    console.error('Error cleaning temp uploads:', error);
  }
}

// Optional: Export a function to run cleanup periodically
export function startTempUploadCleanup(intervalMinutes = 15) {
  // Run cleanup immediately
  cleanTempUploads();

  // Then set up periodic cleanup
  return setInterval(cleanTempUploads, intervalMinutes * 60 * 1000);
}
