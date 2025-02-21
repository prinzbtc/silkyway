import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export type UploadType = 'listing' | 'profile' | 'message' | 'report';

interface UploadConfig {
  isPrivate: boolean;
  maxSizeInMB: number;
  allowedTypes: string[];
  maxFiles?: number;
}

const uploadConfigs: Record<UploadType, UploadConfig> = {
  listing: {
    isPrivate: false,
    maxSizeInMB: 5,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
    maxFiles: 10,
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

export async function saveFile(
  file: File,
  type: UploadType
): Promise<{ url: string; filepath: string }> {
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

  // Return appropriate URL based on privacy setting
  const url = config.isPrivate
    ? `/api/${type}/files/${filename}`
    : `/uploads/${type}/${filename}`;

  return { url, filepath };
}

export function getFilePath(filename: string, type: UploadType): string {
  const config = uploadConfigs[type];
  const baseDir = config.isPrivate ? 'private' : 'public';
  return path.join(process.cwd(), baseDir, 'uploads', type, filename);
}
