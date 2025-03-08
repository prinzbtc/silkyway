import { startTempUploadCleanup } from './cleanTempUploads';

// Start the cleanup process when this module is imported
const cleanupInterval = startTempUploadCleanup();

// Optional: Export a way to stop the cleanup if needed
export function stopTempUploadCleanup() {
  clearInterval(cleanupInterval);
}
