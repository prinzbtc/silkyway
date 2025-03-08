import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { exec } from 'child_process';
import { FileUploadError } from './uploads';

const execAsync = util.promisify(exec);

// Configuration for ClamAV
const CLAMSCAN_PATH = process.env.CLAMSCAN_PATH || '/usr/bin/clamscan';
const CLAMD_SOCKET = process.env.CLAMD_SOCKET || '/var/run/clamav/clamd.ctl';
// Default to using clamscan directly instead of clamd due to potential permission issues
const USE_CLAMD = process.env.USE_CLAMD === 'true';

// Mock scan for development environments where ClamAV isn't installed
const MOCK_SCAN = process.env.NODE_ENV === 'development' && process.env.MOCK_AV_SCAN === 'true';

/**
 * Scans a file for viruses using ClamAV
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

    // Use clamd daemon if configured (faster for multiple scans)
    if (USE_CLAMD) {
      return scanWithClamd(filePath);
    } 
    
    // Otherwise use clamscan directly
    return scanWithClamscan(filePath);
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
    },
    { status: 403 }
  );
}
