import { NextRequest, NextResponse } from 'next/server';

// Configuration for file validation
export const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB per file
export const MAX_FILES = 5;
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
export const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
];

/**
 * Validates files in a FormData request
 * @param formData The FormData containing files to validate
 * @param fieldName The name of the field containing the files
 * @param options Validation options
 * @returns An error message if validation fails, null if validation passes
 */
export async function validateFiles(
  formData: FormData,
  fieldName: string = 'files',
  options: {
    maxFiles?: number;
    maxFileSize?: number;
    allowedTypes?: string[];
  } = {}
): Promise<string | null> {
  // Set default options
  const {
    maxFiles = MAX_FILES,
    maxFileSize = MAX_FILE_SIZE,
    allowedTypes = ALLOWED_FILE_TYPES,
  } = options;

  // Get files from form data
  const files = formData.getAll(fieldName);

  // Check if any files were provided
  if (!files.length) {
    return 'No files uploaded';
  }

  // Check number of files
  if (files.length > maxFiles) {
    return `Maximum ${maxFiles} files allowed`;
  }

  // Validate each file
  for (const file of files) {
    if (!(file instanceof File)) {
      return 'Invalid file data';
    }

    // Validate file type
    if (!allowedTypes.includes(file.type)) {
      return `File type not allowed: ${file.type}. Allowed types: ${allowedTypes.join(', ')}`;
    }

    // Validate file size
    if (file.size > maxFileSize) {
      return `File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum size: ${maxFileSize / (1024 * 1024)}MB`;
    }

    // Additional validation for images - check dimensions
    if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
      try {
        // Create a blob URL for the file
        const url = URL.createObjectURL(file);
        
        // Load the image to check dimensions
        const img = new Image();
        const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          img.onload = () => {
            resolve({ width: img.width, height: img.height });
            URL.revokeObjectURL(url);
          };
          img.onerror = () => {
            reject(new Error('Failed to load image'));
            URL.revokeObjectURL(url);
          };
          img.src = url;
        }).catch(() => null);
        
        // If we couldn't get dimensions, skip this check
        if (dimensions) {
          const { width, height } = dimensions;
          const MAX_DIMENSION = 5000; // Maximum width or height in pixels
          
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            return `Image dimensions too large: ${width}x${height}px. Maximum dimension: ${MAX_DIMENSION}px`;
          }
        }
      } catch (error) {
        console.error('Error validating image dimensions:', error);
        // Continue without dimension validation if it fails
      }
    }
  }

  // All validations passed
  return null;
}

/**
 * Middleware to validate file uploads
 * @param request The incoming request
 * @param fieldName The name of the field containing the files
 * @param options Validation options
 * @returns A response with an error message if validation fails, null if validation passes
 */
export async function validateFileUpload(
  request: NextRequest,
  fieldName: string = 'files',
  options: {
    maxFiles?: number;
    maxFileSize?: number;
    allowedTypes?: string[];
  } = {}
): Promise<NextResponse | null> {
  try {
    // Clone the request to avoid consuming the body
    const clonedRequest = request.clone();
    
    // Parse form data
    const formData = await clonedRequest.formData();
    
    // Validate files
    const error = await validateFiles(formData, fieldName, options);
    
    // Return error response if validation fails
    if (error) {
      return NextResponse.json(
        { error },
        { status: 400 }
      );
    }
    
    // Validation passed
    return null;
  } catch (error) {
    console.error('Error validating file upload:', error);
    return NextResponse.json(
      { error: 'Error processing file upload' },
      { status: 500 }
    );
  }
}
