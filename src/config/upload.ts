import { MediaType } from '@/types/media';

export const UPLOAD_CONFIG = {
  // General settings
  MAX_TOTAL_FILES: 8,
  
  // Image settings
  IMAGE: {
    MAX_FILES: 7,
    MAX_SIZE_MB: 3,
    ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
    MAX_WIDTH: 1920,
    MAX_HEIGHT: 1080,
    QUALITY: 80,
  },
  
  // Video settings
  VIDEO: {
    MAX_FILES: 1,
    MAX_SIZE_MB: 70,
    ALLOWED_TYPES: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
    MAX_DURATION_SECONDS: 600, // 10 minutes
    MAX_WIDTH: 1280,
    MAX_HEIGHT: 720,
  },
  
  // Paths
  PATHS: {
    TEMP: '/uploads/temp',
    LISTING: '/uploads/listing',
    PROFILE: '/uploads/profile',
  }
};

export function getMediaTypeConfig(type: MediaType) {
  return type === MediaType.IMAGE ? UPLOAD_CONFIG.IMAGE : UPLOAD_CONFIG.VIDEO;
}

export function isVideoFile(file: File): boolean {
  return UPLOAD_CONFIG.VIDEO.ALLOWED_TYPES.includes(file.type);
}

export function isImageFile(file: File): boolean {
  return UPLOAD_CONFIG.IMAGE.ALLOWED_TYPES.includes(file.type);
}

export function validateMediaCount(imageCount: number, videoCount: number): boolean {
  return (
    imageCount <= UPLOAD_CONFIG.IMAGE.MAX_FILES &&
    videoCount <= UPLOAD_CONFIG.VIDEO.MAX_FILES &&
    (imageCount + videoCount) <= UPLOAD_CONFIG.MAX_TOTAL_FILES
  );
}
