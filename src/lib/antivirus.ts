import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { exec, spawn } from 'child_process';
import { FileUploadError } from './uploads';
import { Readable } from 'stream';
import os from 'os';
import net from 'net';
import NodeClam from 'clamscan';

const execAsync = util.promisify(exec);

// Configuration for ClamAV
const CLAMSCAN_PATH = process.env.CLAMSCAN_PATH || '/usr/bin/clamscan';
const CLAMD_SOCKET = process.env.CLAMD_SOCKET || '/var/run/clamav/clamd.ctl';
// Default to using clamd which is faster than clamscan
const USE_CLAMD = process.env.USE_CLAMD !== 'false';

// Mock scan for development environments where ClamAV isn't installed
const MOCK_SCAN = process.env.NODE_ENV === 'development' && process.env.MOCK_AV_SCAN === 'true';

// Thresholds for optimization
const STREAMING_THRESHOLD = 10 * 1024 * 1024; // 10MB - files larger than this will use streaming
const MAX_PARALLEL_SCANS = Math.max(1, Math.floor(os.cpus().length / 2)); // Use half of available CPU cores

// Initialize ClamAV scanner
let clamavScanner: any = null;
let clamavInitPromise: Promise<any> | null = null;

/**
 * Initialize the ClamAV scanner
 * This is called lazily when needed
 */
async function initClamAV() {
  if (clamavScanner) {
    return clamavScanner;
  }
  
  if (clamavInitPromise) {
    return clamavInitPromise;
  }
  
  clamavInitPromise = new Promise(async (resolve, reject) => {
    try {
      if (MOCK_SCAN) {
        console.log('[MOCK AV] Initializing mock scanner');
        resolve(null);
        return;
      }
      
      console.log('Initializing ClamAV scanner...');
      const options = {
        clamdscan: {
          socket: CLAMD_SOCKET,
          host: false,
          port: false,
          timeout: 60000,
          local_fallback: true,
          path: '/usr/bin/clamdscan',
          config_file: '/etc/clamav/clamd.conf'
        },
        clamscan: {
          path: CLAMSCAN_PATH,
          db: undefined, // Changed from null to undefined to match type
          scan_recursively: true,
          clamscan_timeout: 120000,
          active: true
        },
        preference: USE_CLAMD ? 'clamdscan' : 'clamscan'
      };
      
      const clamscan = await new NodeClam().init(options);
      console.log(`ClamAV scanner initialized using ${USE_CLAMD ? 'clamd' : 'clamscan'}`);
      const version = await clamscan.getVersion();
      console.log('ClamAV version:', version);
      
      clamavScanner = clamscan;
      resolve(clamscan);
    } catch (error: unknown) {
      console.error('Failed to initialize ClamAV scanner:', error);
      reject(error);
    }
  });
  
  return clamavInitPromise;
}

/**
 * Scans a file for viruses using ClamAV
 * Automatically selects the best method based on file size
 * @param filePath Path to the file to scan
 * @returns Object with scan result information
 */
export async function scanFile(filePath: string): Promise<{
  isInfected: boolean;
  viruses: string[];
  error?: string;
}> {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new FileUploadError(`File not found: ${filePath}`);
    }

    // Mock scan for development
    if (MOCK_SCAN) {
      console.log(`[MOCK AV SCAN] Scanning file: ${filePath}`);
      // Simulate virus detection for files containing "virus" in the name (for testing)
      const isInfected = path.basename(filePath).toLowerCase().includes('virus');
      return {
        isInfected,
        viruses: isInfected ? ['MOCK.VIRUS.DETECTED'] : [],
      };
    }

    // Check file size to determine best scan method
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    // Use streaming scan for large files
    if (fileSize > STREAMING_THRESHOLD) {
      console.log(`Using stream scan for large file (${fileSize} bytes): ${filePath}`);
      return streamScanFile(filePath);
    }

    try {
      // Use the clamscan library
      const clamscan = await initClamAV();
      
      if (!clamscan) {
        // Fall back to direct command execution if initialization failed
        if (USE_CLAMD) {
          return scanWithClamd(filePath);
        } else {
          return scanWithClamscan(filePath);
        }
      }
      
      console.log(`Scanning file with ClamAV library: ${filePath}`);
      const result = await clamscan.isInfected(filePath);
      
      return {
        isInfected: result.isInfected,
        viruses: result.viruses || [],
      };
    } catch (libError) {
      console.error('Error using ClamAV library, falling back to command line:', libError);
      
      // Fall back to direct command execution
      if (USE_CLAMD) {
        return scanWithClamd(filePath);
      } else {
        return scanWithClamscan(filePath);
      }
    }
  } catch (error) {
    console.error('Error during virus scan:', error);
    return {
      isInfected: false, // Assume clean if scan fails
      viruses: [],
      error: error instanceof Error ? error.message : 'Unknown error during virus scan',
    };
  }
}

/**
 * Scans a file using the clamscan command-line tool
 */
async function scanWithClamscan(filePath: string): Promise<{
  isInfected: boolean;
  viruses: string[];
  error?: string;
}> {
  try {
    console.log(`Scanning file with clamscan: ${filePath}`);
    const { stdout, stderr } = await execAsync(`${CLAMSCAN_PATH} --no-summary "${filePath}"`);
    
    // ClamAV returns 0 if clean, 1 if infected
    const isInfected = stdout.includes('FOUND');
    
    // Extract virus names
    const viruses: string[] = [];
    if (isInfected) {
      const match = stdout.match(/: (.+) FOUND/);
      if (match && match[1]) {
        viruses.push(match[1]);
      }
    }
    
    return { isInfected, viruses };
  } catch (error: any) {
    // ClamAV returns exit code 1 if virus found, which causes exec to throw
    if (error.stdout && error.stdout.includes('FOUND')) {
      const viruses: string[] = [];
      const match = error.stdout.match(/: (.+) FOUND/);
      if (match && match[1]) {
        viruses.push(match[1]);
      }
      return { isInfected: true, viruses };
    }
    
    // Real error
    console.error('Error scanning with clamscan:', error);
    return {
      isInfected: false,
      viruses: [],
      error: error.message || 'Unknown error during clamscan',
    };
  }
}

/**
 * Scans a file using the clamd daemon (faster for multiple scans)
 */
async function scanWithClamd(filePath: string): Promise<{
  isInfected: boolean;
  viruses: string[];
  error?: string;
}> {
  try {
    console.log(`Scanning file with clamd: ${filePath}`);
    // Use clamdscan which communicates with the clamd daemon
    const { stdout, stderr } = await execAsync(`clamdscan --no-summary "${filePath}"`);
    
    const isInfected = stdout.includes('FOUND');
    
    // Extract virus names
    const viruses: string[] = [];
    if (isInfected) {
      const match = stdout.match(/: (.+) FOUND/);
      if (match && match[1]) {
        viruses.push(match[1]);
      }
    }
    
    return { isInfected, viruses };
  } catch (error: any) {
    // ClamAV returns exit code 1 if virus found, which causes exec to throw
    if (error.stdout && error.stdout.includes('FOUND')) {
      const viruses: string[] = [];
      const match = error.stdout.match(/: (.+) FOUND/);
      if (match && match[1]) {
        viruses.push(match[1]);
      }
      return { isInfected: true, viruses };
    }
    
    // Real error
    console.error('Error scanning with clamd:', error);
    return {
      isInfected: false,
      viruses: [],
      error: error.message || 'Unknown error during clamd scan',
    };
  }
}

/**
 * Stream-based scanning for larger files
 * This avoids loading the entire file into memory
 */
export async function streamScanFile(filePath: string): Promise<{
  isInfected: boolean;
  viruses: string[];
  error?: string;
}> {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new FileUploadError(`File not found: ${filePath}`);
    }

    // Mock scan for development
    if (MOCK_SCAN) {
      console.log(`[MOCK AV STREAM SCAN] Scanning file: ${filePath}`);
      // Simulate virus detection for files containing "virus" in the name (for testing)
      const isInfected = path.basename(filePath).toLowerCase().includes('virus');
      return {
        isInfected,
        viruses: isInfected ? ['MOCK.VIRUS.DETECTED'] : [],
      };
    }
    
    try {
      // Use the clamscan library for stream scanning
      const clamscan = await initClamAV();
      
      if (!clamscan) {
        // Fall back to direct command execution if initialization failed
        if (USE_CLAMD) {
          return streamScanWithClamd(filePath);
        } else {
          return streamScanWithClamscan(filePath);
        }
      }
      
      console.log(`Stream scanning file with ClamAV library: ${filePath}`);
      const fileStream = fs.createReadStream(filePath);
      const result = await clamscan.scanStream(fileStream);
      
      return {
        isInfected: result.isInfected,
        viruses: result.viruses || [],
      };
    } catch (libError) {
      console.error('Error using ClamAV library for stream scan, falling back:', libError);
      
      // Fall back to direct command execution
      if (USE_CLAMD) {
        return streamScanWithClamd(filePath);
      } else {
        // Otherwise use clamscan directly
        return streamScanWithClamscan(filePath);
      }
    }
  } catch (error) {
    console.error('Error during virus stream scan:', error);
    return {
      isInfected: false, // Assume clean if scan fails
      viruses: [],
      error: error instanceof Error ? error.message : 'Unknown error during virus scan',
    };
  }
}

/**
 * Stream-based scanning with clamscan
 */
async function streamScanWithClamscan(filePath: string): Promise<{
  isInfected: boolean;
  viruses: string[];
  error?: string;
}> {
  return new Promise((resolve) => {
    console.log(`Stream scanning file with clamscan: ${filePath}`);
    
    const clamscan = spawn(CLAMSCAN_PATH, ['--no-summary', '--stdout', '--stream', filePath]);
    
    let stdout = '';
    let stderr = '';
    
    clamscan.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    clamscan.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    clamscan.on('close', (code) => {
      // ClamAV returns 1 if virus found, 0 if clean
      const isInfected = code === 1 || stdout.includes('FOUND');
      
      // Extract virus names
      const viruses: string[] = [];
      if (isInfected) {
        const matches = stdout.match(/: (.+) FOUND/g);
        if (matches) {
          matches.forEach(match => {
            const virus = match.match(/: (.+) FOUND/)?.[1];
            if (virus) viruses.push(virus);
          });
        }
      }
      
      if (code !== 0 && code !== 1) {
        // Real error (not virus detection)
        console.error('Error scanning with clamscan:', stderr);
        resolve({
          isInfected: false,
          viruses: [],
          error: stderr || `clamscan exited with code ${code}`,
        });
      } else {
        resolve({ isInfected, viruses });
      }
    });
    
    // Handle stream errors
    clamscan.on('error', (error) => {
      console.error('Stream scan error:', error);
      resolve({
        isInfected: false,
        viruses: [],
        error: error.message,
      });
    });
    
    // Create read stream and pipe to clamscan
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(clamscan.stdin);
    
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      clamscan.kill();
      resolve({
        isInfected: false,
        viruses: [],
        error: `File stream error: ${error.message}`,
      });
    });
  });
}

/**
 * Parse ClamAV response
 */
function parseClamdResponse(response: string): {
  isInfected: boolean;
  viruses: string[];
  error?: string;
} {
  response = response.trim();
  
  if (response.includes('ERROR')) {
    return {
      isInfected: false,
      viruses: [],
      error: response
    };
  }
  
  if (response.includes('FOUND')) {
    // Extract virus names
    const viruses = response
      .split('\n')
      .filter(line => line.includes('FOUND'))
      .map(line => {
        // Handle both direct scan and stream scan response formats
        // Direct scan format: "/path/to/file: VirusName FOUND"
        // Stream scan format: "stream: VirusName FOUND"
        const match = line.match(/: ([^:]+) FOUND/);
        return match ? match[1].trim() : 'Unknown virus';
      });
    
    return {
      isInfected: true,
      viruses
    };
  }
  
  // Check for OK response
  if (response.includes('OK')) {
    return {
      isInfected: false,
      viruses: []
    };
  }
  
  // If we get here, something unexpected happened
  return {
    isInfected: false,
    viruses: [],
    error: `Unexpected response: ${response}`
  };
}

/**
 * Stream-based scanning with clamd
 */
async function streamScanWithClamd(filePath: string): Promise<{
  isInfected: boolean;
  viruses: string[];
  error?: string;
}> {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new FileUploadError(`File not found: ${filePath}`);
    }

    return new Promise((resolve, reject) => {
      try {
        // Read file content - this is more reliable than streaming for clamd
        const fileContent = fs.readFileSync(filePath);
        const fileSize = fileContent.length;
        console.log(`Reading file for clamd scan: ${filePath}, size: ${fileSize} bytes`);
        
        // Connect to socket
        const socket = net.createConnection(CLAMD_SOCKET);
        let response = '';

        socket.on('connect', () => {
          console.log(`Connected to clamd socket for scanning: ${filePath}`);
          
          try {
            // Send INSTREAM command with null terminator
            socket.write('INSTREAM\0');
            
            // Send file content with proper length prefix
            const sizeBuffer = Buffer.alloc(4);
            sizeBuffer.writeUInt32BE(fileContent.length, 0);
            socket.write(sizeBuffer);
            socket.write(fileContent);
            
            // End with zero-length chunk
            const endBuffer = Buffer.alloc(4);
            endBuffer.writeUInt32BE(0, 0);
            socket.write(endBuffer);
            
            console.log(`File sent to clamd for scanning`);
          } catch (err: unknown) {
            console.error('Error sending data to clamd:', err);
            socket.destroy();
            if (err instanceof Error) {
              reject(new Error(`Error sending data to clamd: ${err.message}`));
            } else {
              reject(new Error(`Error sending data to clamd: ${String(err)}`));
            }
          }
        });

        socket.on('data', (data: Buffer) => {
          const chunk = data.toString();
          console.log(`ClamAV response chunk: ${chunk.trim()}`);
          response += chunk;
        });

        socket.on('end', () => {
          console.log(`ClamAV scan complete, response: ${response.trim()}`);
          
          // Parse the response
          const result = parseClamdResponse(response);
          resolve(result);
        });

        socket.on('error', (err: Error) => {
          console.error('Socket error during clamd scan:', err);
          
          // If we already have a response, we can still use it
          if (response && (response.includes('FOUND') || response.includes('OK'))) {
            console.log('Got valid response before socket error, using it');
            const result = parseClamdResponse(response);
            resolve(result);
          } else {
            reject(new Error(`Socket error during scan: ${err.message}`));
          }
        });

        // Set a timeout to prevent hanging
        setTimeout(() => {
          if (!socket.destroyed) {
            console.log('Scan timeout, closing socket');
            socket.end();
            
            if (response && (response.includes('FOUND') || response.includes('OK'))) {
              console.log('Got valid response before timeout, using it');
              const result = parseClamdResponse(response);
              resolve(result);
            } else {
              reject(new Error('Scan timeout after 30 seconds'));
            }
          }
        }, 30000);
      } catch (readError) {
        console.error('Error reading file for clamd scan:', readError);
        reject(readError);
      }
    });
  } catch (error: any) {
    console.error('Error in streamScanWithClamd:', error);
    return {
      isInfected: false,
      viruses: [],
      error: error.message || 'Unknown error in streamScanWithClamd'
    };
  }
}

/**
 * Scan a file directly from a buffer without saving to disk first
 * Useful for quick scanning before committing to disk
 */
export async function scanBuffer(buffer: Buffer, filename: string = 'unknown'): Promise<{
  isInfected: boolean;
  viruses: string[];
  error?: string;
}> {
  try {
    // Mock scan for development
    if (MOCK_SCAN) {
      console.log(`[MOCK AV BUFFER SCAN] Scanning buffer for file: ${filename}`);
      // Simulate virus detection for files containing "virus" in the name (for testing)
      const isInfected = filename.toLowerCase().includes('virus');
      return {
        isInfected,
        viruses: isInfected ? ['MOCK.VIRUS.DETECTED'] : [],
      };
    }

    try {
      // Use the clamscan library for buffer scanning
      const clamscan = await initClamAV();
      
      if (clamscan) {
        console.log(`Scanning buffer with ClamAV library for file: ${filename}`);
        // Create a readable stream from the buffer
        const bufferStream = new Readable();
        bufferStream.push(buffer);
        bufferStream.push(null); // End of stream
        
        const result = await clamscan.scanStream(bufferStream);
        
        return {
          isInfected: result.isInfected,
          viruses: result.viruses || [],
        };
      }
    } catch (libError: unknown) {
      console.error('Error using ClamAV library for buffer scan, falling back to command line:', libError);
    }
    
    // Fall back to direct command execution if library method fails
    return new Promise((resolve) => {
      console.log(`Scanning buffer with ${USE_CLAMD ? 'clamd' : 'clamscan'}: ${filename}`);
      
      const scanner = spawn(USE_CLAMD ? 'clamdscan' : CLAMSCAN_PATH, ['--no-summary', '--stdout', '-']);
      
      let stdout = '';
      let stderr = '';
      
      scanner.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      scanner.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      scanner.on('close', (code) => {
        // ClamAV returns 1 if virus found, 0 if clean
        const isInfected = code === 1 || stdout.includes('FOUND');
        
        // Extract virus names
        const viruses: string[] = [];
        if (isInfected) {
          const matches = stdout.match(/: (.+) FOUND/g);
          if (matches) {
            matches.forEach(match => {
              const virus = match.match(/: (.+) FOUND/)?.[1];
              if (virus) viruses.push(virus);
            });
          }
        }
        
        if (code !== 0 && code !== 1) {
          // Real error (not virus detection)
          console.error(`Error scanning buffer with ${USE_CLAMD ? 'clamd' : 'clamscan'}:`, stderr);
          resolve({
            isInfected: false,
            viruses: [],
            error: stderr || `scanner exited with code ${code}`,
          });
        } else {
          resolve({ isInfected, viruses });
        }
      });
      
      // Handle stream errors
      scanner.on('error', (error: Error) => {
        console.error('Buffer scan error:', error);
        resolve({
          isInfected: false,
          viruses: [],
          error: error.message,
        });
      });
      
      // Create readable stream from buffer and pipe to scanner
      const bufferStream = new Readable();
      bufferStream.push(buffer);
      bufferStream.push(null); // Signal end of stream
      bufferStream.pipe(scanner.stdin);
      
      bufferStream.on('error', (error: Error) => {
        console.error('Buffer stream error:', error);
        scanner.kill();
        resolve({
          isInfected: false,
          viruses: [],
          error: `Buffer stream error: ${error.message}`,
        });
      });
    });
  } catch (error) {
    console.error('Error during buffer scan:', error);
    return {
      isInfected: false, // Assume clean if scan fails
      viruses: [],
      error: error instanceof Error ? error.message : 'Unknown error during buffer scan',
    };
  }
}

/**
 * Batch scan multiple files with controlled parallelism
 * @param filePaths Array of file paths to scan
 * @param concurrency Maximum number of parallel scans (defaults to half of CPU cores)
 * @returns Array of scan results
 */
export async function batchScanFiles(
  filePaths: string[],
  concurrency = MAX_PARALLEL_SCANS
): Promise<Array<{ filePath: string; isInfected: boolean; viruses: string[]; error?: string }>> {
  console.log(`Starting batch scan of ${filePaths.length} files with concurrency ${concurrency}`);
  
  const results: Array<{ filePath: string; isInfected: boolean; viruses: string[]; error?: string }> = [];
  const queue = [...filePaths];
  
  // Process queue with controlled concurrency
  const processQueue = async (): Promise<void> => {
    const tasks = [];
    
    for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
      const filePath = queue.shift();
      if (!filePath) break;
      
      tasks.push(
        (async () => {
          try {
            console.log(`Scanning file: ${filePath}`);
            
            // Get file size to determine scan method
            const stats = fs.statSync(filePath);
            const fileSize = stats.size;
            
            // Choose scan method based on file size
            let scanResult;
            if (fileSize > STREAMING_THRESHOLD) {
              console.log(`Using stream scan for large file (${fileSize} bytes): ${filePath}`);
              scanResult = await streamScanFile(filePath);
            } else {
              console.log(`Using regular scan for file (${fileSize} bytes): ${filePath}`);
              scanResult = await scanFile(filePath);
            }
            
            results.push({
              filePath,
              ...scanResult
            });
            
            if (scanResult.isInfected) {
              console.error(`SECURITY ALERT: Virus detected in ${filePath}: ${scanResult.viruses.join(', ')}`);
            }
          } catch (error) {
            console.error(`Error scanning ${filePath}:`, error);
            results.push({
              filePath,
              isInfected: false,
              viruses: [],
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        })()
      );
    }
    
    // Wait for current batch to complete
    await Promise.all(tasks);
    
    // Process next batch if queue not empty
    if (queue.length > 0) {
      return processQueue();
    }
  };
  
  // Start processing queue
  await processQueue();
  
  console.log(`Batch scan completed for ${filePaths.length} files`);
  return results;
}

/**
 * Prioritized batch scanning - scans smaller files first to get quick results
 * @param filePaths Array of file paths to scan
 * @param concurrency Maximum number of parallel scans
 * @returns Array of scan results
 */
export async function prioritizedBatchScan(
  filePaths: string[],
  concurrency = MAX_PARALLEL_SCANS
): Promise<Array<{ filePath: string; isInfected: boolean; viruses: string[]; error?: string }>> {
  console.log(`Starting prioritized batch scan of ${filePaths.length} files`);
  
  // Get file sizes and sort by size (smallest first)
  const filesWithSize = filePaths.map(filePath => {
    try {
      const stats = fs.statSync(filePath);
      return { filePath, size: stats.size };
    } catch (error) {
      console.error(`Error getting file size for ${filePath}:`, error);
      return { filePath, size: Infinity }; // Put files with errors at the end
    }
  });
  
  // Sort by size (smallest first)
  filesWithSize.sort((a, b) => a.size - b.size);
  
  // Extract sorted file paths
  const sortedFilePaths = filesWithSize.map(f => f.filePath);
  
  // Use the regular batch scan with the sorted paths
  return batchScanFiles(sortedFilePaths, concurrency);
}

/**
 * Handles an infected file - logs, deletes, and returns appropriate response
 */
export function handleInfectedFile(filePath: string, viruses: string[]): NextResponse {
  console.error(`SECURITY ALERT: Infected file detected: ${filePath}`);
  console.error(`Viruses found: ${viruses.join(', ')}`);
  
  // Delete the infected file
  try {
    fs.unlinkSync(filePath);
    console.log(`Deleted infected file: ${filePath}`);
  } catch (error) {
    console.error(`Failed to delete infected file: ${filePath}`, error);
  }
  
  // Return error response
  return NextResponse.json(
    {
      success: false,
      error: 'Security scan failed. The uploaded file contains malware and has been rejected.',
      isVirusDetected: true,
    },
    { status: 403 }
  );
}
