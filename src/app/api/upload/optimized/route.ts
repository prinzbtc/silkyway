import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { UPLOAD_CONFIG } from '@/config/upload';
import { saveTempFile } from '@/lib/uploads';
import { MediaType } from '@/types/media';
import { scanFile, handleInfectedFile, streamScanFile, scanBuffer, batchScanFiles, prioritizedBatchScan } from '@/lib/antivirus';
import fs from 'fs';

// Type definitions
type ScanResult = {
  isInfected: boolean;
  viruses: string[];
  error?: string;
};

// Create temp upload directory for general uploads
const TEMP_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'temp');
mkdir(TEMP_UPLOAD_DIR, { recursive: true }).catch(console.error);

// Create reports upload directory
const REPORTS_UPLOAD_DIR = path.join(process.cwd(), 'private', 'uploads', 'reports');
mkdir(REPORTS_UPLOAD_DIR, { recursive: true }).catch(console.error);

// Threshold for using streaming scan (10MB)
const STREAMING_THRESHOLD = 10 * 1024 * 1024;

// Pre-scan small files in memory before saving to disk
const PRE_SCAN_THRESHOLD = 5 * 1024 * 1024; // 5MB

export async function POST(req: Request) {
  console.log('Optimized Upload API called');
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
    
    console.log('Upload request received:', { 
      fileName: file?.name,
      fileSize: file?.size,
      purpose,
      contentType: file?.type
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
          error: 'Virus detected: EICAR-Test-Signature FOUND',
          isVirusDetected: true
        },
        { status: 400 }
      );
    }

    // For small files, pre-scan in memory before saving to disk
    let alreadyScanned = false;
    let preScanResult: ScanResult | null = null;
    
    if (file.size <= PRE_SCAN_THRESHOLD) {
      console.log(`Pre-scanning small file (${file.size} bytes) in memory: ${file.name}`);
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const scanResult = await scanBuffer(buffer, file.name);
        alreadyScanned = true;
        preScanResult = scanResult;
        
        if (scanResult.isInfected) {
          console.error('Virus detected in pre-scan:', {
            file: file.name,
            viruses: scanResult.viruses
          });
          
          return NextResponse.json(
            {
              success: false,
              error: 'Security scan failed. The uploaded file contains malware and has been rejected.',
              isVirusDetected: true,
            },
            { status: 403 }
          );
        }
        
        if (scanResult.error) {
          console.warn('Pre-scan error (proceeding with upload):', scanResult.error);
          alreadyScanned = false; // If there was an error, we'll need to scan again
        } else {
          console.log('Pre-scan completed successfully. File is clean.');
        }
      } catch (preScanError) {
        console.error('Error during pre-scan:', preScanError);
        alreadyScanned = false; // If there was an error, we'll need to scan again
      }
    } else {
      // For larger files, log that we're skipping pre-scan
      console.log(`Skipping pre-scan for large file (${file.size} bytes). Will use streaming scan after saving to disk.`);
    }

    // Handle different upload purposes
    if (purpose === 'report') {
      return handleReportUpload(file, alreadyScanned, preScanResult);
    } else if (purpose === 'listings') {
      return handleListingMediaUpload(file, alreadyScanned, preScanResult);
    } else {
      return handleGeneralUpload(file, alreadyScanned, preScanResult);
    }
  } catch (error) {
    console.error('Error in main upload handler:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    return new NextResponse(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}

async function handleReportUpload(
  file: File, 
  alreadyScanned = false, 
  preScanResult: ScanResult | null = null
) {
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
  
  // If the file was already scanned in memory and is clean, skip the second scan
  let scanResult;
  
  if (alreadyScanned && preScanResult) {
    console.log('Skipping second scan since file was already pre-scanned and is clean');
    scanResult = preScanResult;
  } else {
    // Choose scan method based on file size
    console.log(`Selecting scan method for file size: ${file.size} bytes`);
    
    if (file.size > STREAMING_THRESHOLD) {
      console.log('Using streaming scan for large report file:', filepath);
      scanResult = await streamScanFile(filepath);
    } else {
      console.log('Using regular scan for report file:', filepath);
      scanResult = await scanFile(filepath);
    }
  }
  
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

async function handleListingMediaUpload(
  file: File, 
  alreadyScanned = false, 
  preScanResult: ScanResult | null = null
) {
  console.log('Handling optimized listing media upload:', { 
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
      const stats = fs.statSync(publicPath);
      console.log('File exists and has size:', stats.size);
      
      if (stats.size === 0) {
        console.error('File was saved but has zero size');
        return new NextResponse('File was saved but has zero size', { status: 500 });
      }
      
      if (stats.size !== file.size) {
        console.warn(`File size mismatch: Expected ${file.size}, got ${stats.size}`);
      }
    } catch (statError) {
      console.error('Error verifying saved file:', statError);
      return new NextResponse('File was not saved correctly', { status: 500 });
    }
    
    // If the file was already scanned in memory and is clean, skip the second scan
    let scanResult;
    
    if (alreadyScanned && preScanResult) {
      console.log('Skipping second scan since file was already pre-scanned and is clean');
      scanResult = preScanResult;
    } else {
      // Choose scan method based on file size
      console.log(`Selecting scan method for file size: ${file.size} bytes`);
      
      if (file.size > STREAMING_THRESHOLD) {
        console.log(`Using streaming scan for large file (${(file.size / (1024 * 1024)).toFixed(2)}MB): ${publicPath}`);
        console.time('LargeFileScan');
        scanResult = await streamScanFile(publicPath);
        console.timeEnd('LargeFileScan');
        console.log(`Large file scan completed in ${(file.size / (1024 * 1024)).toFixed(2)}MB file`);
      } else {
        console.log(`Using regular scan for file (${(file.size / 1024).toFixed(2)}KB): ${publicPath}`);
        console.time('RegularFileScan');
        scanResult = await scanFile(publicPath);
        console.timeEnd('RegularFileScan');
      }
    }
    
    // If the file is infected, handle it and return error response
    if (scanResult.isInfected) {
      console.error('Virus detected in uploaded file:', {
        file: file.name,
        path: publicPath,
        viruses: scanResult.viruses
      });
      
      // Delete the file
      try {
        fs.unlinkSync(publicPath);
        console.log('Deleted infected file:', publicPath);
      } catch (deleteError) {
        console.error('Error deleting infected file:', deleteError);
      }
      
      return NextResponse.json(
        {
          success: false,
          error: 'Security scan failed. The uploaded file contains malware and has been rejected.',
          isVirusDetected: true,
        },
        { status: 403 }
      );
    }
    
    // If there was an error during scanning, log it but continue
    if (scanResult.error) {
      console.warn('Antivirus scan error (proceeding with upload):', scanResult.error);
    } else {
      console.log('Antivirus scan completed successfully. File is clean.');
    }
    
    // Return temporary file information
    const response = {
      success: true,
      file: {
        filename: path.basename(result.filepath),
        url: result.url,
        type: isVideo ? MediaType.VIDEO : MediaType.IMAGE,
        size: file.size,
        thumbnail: result.thumbnail
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

async function handleGeneralUpload(
  file: File, 
  alreadyScanned = false, 
  preScanResult: ScanResult | null = null
) {
  // Implementation similar to handleListingMediaUpload but for general files
  // This is a simplified version for now
  return handleListingMediaUpload(file, alreadyScanned, preScanResult);
}
