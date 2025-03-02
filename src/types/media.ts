export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO'
}

export enum MediaProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface MediaFile {
  id?: string;
  url?: string;
  filename: string;
  type: MediaType;
  order: number;
  isMainMedia?: boolean;
  isMain?: boolean; // Keep for backward compatibility
  thumbnail?: string;
  status?: MediaProcessingStatus;
  file?: File; // For client-side use only
}

export interface UploadProgress {
  fileId: string;
  progress: number; // 0-100
  status: MediaProcessingStatus;
  error?: string;
}
