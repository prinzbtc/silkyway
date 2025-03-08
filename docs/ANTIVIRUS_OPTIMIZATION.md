# ClamAV Optimization for Large Files and High-Volume Uploads

This document outlines the optimizations made to the ClamAV virus scanning process in the Silkyway marketplace, particularly for handling large files and high-volume uploads.

## Table of Contents

1. [Streaming Virus Scanning](#streaming-virus-scanning)
2. [Parallel Scanning](#parallel-scanning)
3. [Pre-Scanning in Memory](#pre-scanning-in-memory)
4. [Prioritized Scanning](#prioritized-scanning)
5. [Configuration Options](#configuration-options)
6. [Performance Considerations](#performance-considerations)

## Streaming Virus Scanning

The original implementation loaded entire files into memory before scanning, which is inefficient for large files. The new streaming approach:

- Uses Node.js streams to pipe file data directly to ClamAV
- Significantly reduces memory usage for large files
- Allows scanning to begin before the entire file is read
- Implemented in `antivirus-stream.ts`

```typescript
// Example usage:
import { streamScanFile } from '@/lib/antivirus-stream';

// For large files, use streaming scan
if (file.size > 10 * 1024 * 1024) { // 10MB
  const scanResult = await streamScanFile(filePath);
} else {
  // Use regular scan for smaller files
  const scanResult = await scanFile(filePath);
}
```

## Parallel Scanning

For handling multiple file uploads, we've implemented batch processing with controlled parallelism:

- Scans multiple files concurrently with a configurable limit
- Automatically adjusts based on available CPU cores
- Prevents system overload during high-volume uploads
- Implemented in `batch-antivirus.ts`

```typescript
// Example usage:
import { batchScanFiles } from '@/lib/batch-antivirus';

// Scan multiple files with default parallelism (half of CPU cores)
const scanResults = await batchScanFiles([file1Path, file2Path, file3Path]);

// Or specify custom concurrency
const scanResults = await batchScanFiles([file1Path, file2Path, file3Path], 2);
```

## Pre-Scanning in Memory

For small files, we now offer pre-scanning directly from memory before saving to disk:

- Avoids unnecessary disk I/O for infected files
- Faster rejection of malicious files
- Implemented in `antivirus-stream.ts` as `scanBuffer`

```typescript
// Example usage:
import { scanBuffer } from '@/lib/antivirus-stream';

// For small files, pre-scan in memory
if (file.size <= 5 * 1024 * 1024) { // 5MB
  const buffer = Buffer.from(await file.arrayBuffer());
  const scanResult = await scanBuffer(buffer, file.name);
  
  if (scanResult.isInfected) {
    // Reject file without saving to disk
  }
}
```

## Prioritized Scanning

For batch uploads, we now prioritize scanning smaller files first:

- Provides faster feedback for most files
- Improves user experience during multi-file uploads
- Implemented in `batch-antivirus.ts` as `prioritizedBatchScan`

```typescript
// Example usage:
import { prioritizedBatchScan } from '@/lib/batch-antivirus';

// Scan multiple files, prioritizing smaller files first
const scanResults = await prioritizedBatchScan([file1Path, file2Path, file3Path]);
```

## Configuration Options

The optimized scanning system includes several configurable thresholds:

```typescript
// In optimized-route.ts:

// Threshold for using streaming scan
const STREAMING_THRESHOLD = 10 * 1024 * 1024; // 10MB

// Pre-scan small files in memory before saving to disk
const PRE_SCAN_THRESHOLD = 5 * 1024 * 1024; // 5MB

// In batch-antivirus.ts:
const MAX_PARALLEL_SCANS = Math.max(1, Math.floor(os.cpus().length / 2)); // Use half of available CPU cores
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB
```

These thresholds can be adjusted based on your server's resources and typical file sizes.

## Performance Considerations

### Memory Usage

- **Streaming Scan**: Uses minimal memory regardless of file size
- **Regular Scan**: Loads entire file into memory
- **Pre-Scanning**: Temporarily loads small files into memory

### CPU Usage

- **Parallel Scanning**: Set `MAX_PARALLEL_SCANS` based on available CPU cores
- **Default**: Uses half of available CPU cores to leave resources for other operations

### Disk I/O

- **Pre-Scanning**: Reduces disk writes by rejecting infected files before saving
- **Streaming**: Reads files sequentially, reducing random I/O

### Recommended Server Specifications

For optimal performance with high-volume uploads:

- **CPU**: 4+ cores (8+ recommended for production)
- **RAM**: 8GB minimum (16GB+ recommended)
- **Disk**: SSD storage for faster scanning
- **Network**: High bandwidth for handling multiple simultaneous uploads

## Integration with Upload Process

The optimized scanning is integrated into the upload process in `/app/api/upload/optimized/route.ts`, which:

1. Pre-scans small files in memory
2. Uses streaming for large files
3. Selects the appropriate scanning method based on file size
4. Handles infected files appropriately
5. **Avoids double scanning** - If a file has already been pre-scanned in memory and is clean, we skip the second scan after saving to disk

To use the optimized upload route, update your API routes to point to the new implementation.

## Avoiding Double Scanning

A key optimization is avoiding unnecessary duplicate scans:

```typescript
// If the file was already scanned in memory and is clean, skip the second scan
let scanResult;

if (alreadyScanned && preScanResult) {
  console.log('Skipping second scan since file was already pre-scanned and is clean');
  scanResult = preScanResult;
} else {
  // Choose scan method based on file size
  console.log(`Selecting scan method for file size: ${file.size} bytes`);
  
  if (file.size > STREAMING_THRESHOLD) {
    console.log('Using streaming scan for large file:', publicPath);
    scanResult = await streamScanFile(publicPath);
  } else {
    console.log('Using regular scan for file:', publicPath);
    scanResult = await scanFile(publicPath);
  }
}
```

This approach significantly reduces upload times for small files, which would otherwise be scanned twice - once in memory and once after saving to disk.

## Handling Large Files (Videos)

For large files like videos (up to 70MB), we use a streaming-based approach that avoids loading the entire file into memory:

1. **Skip Pre-Scan**: Files larger than 5MB skip the memory pre-scan
2. **Stream-Based Scanning**: Files larger than 10MB use a streaming scan approach
3. **Progress Tracking**: The scanning process includes progress tracking for large files

```typescript
// In streamScanWithClamscan function
const progressInterval = setInterval(() => {
  const elapsedSeconds = (Date.now() - startTime) / 1000;
  if (elapsedSeconds > 5 && !progressReported) {
    console.log(`Still scanning ${filePath} (${fileSizeMB}MB) - ${elapsedSeconds.toFixed(1)}s elapsed...`);
    progressReported = true;
  } else if (elapsedSeconds > 10) {
    console.log(`Scan in progress for ${filePath} - ${elapsedSeconds.toFixed(1)}s elapsed...`);
  }
}, 5000); // Report progress every 5 seconds
```

This implementation efficiently handles files up to the 70MB limit in the MediaUploader component while providing detailed logging about the scanning process.
