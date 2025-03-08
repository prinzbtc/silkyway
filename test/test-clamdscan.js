/**
 * Test script for ClamAV daemon integration using clamdscan
 * This script tests the antivirus scanning functionality using the clamdscan utility
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Test directory
const TEST_DIR = path.join(__dirname, 'test-files');
const CLEAN_FILE_PATH = path.join(TEST_DIR, 'clean-test.txt');
const EICAR_FILE_PATH = path.join(TEST_DIR, 'eicar-test.txt');

// EICAR test virus signature
const EICAR_SIGNATURE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

// Create test directory if it doesn't exist
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

// Create test files
function createTestFiles() {
  console.log('Creating test files...');
  fs.writeFileSync(CLEAN_FILE_PATH, 'This is a clean test file with no virus signatures.');
  console.log(`Created clean test file at ${CLEAN_FILE_PATH}`);
  
  fs.writeFileSync(EICAR_FILE_PATH, EICAR_SIGNATURE);
  console.log(`Created EICAR test file at ${EICAR_FILE_PATH}`);
}

// Clean up test files
function cleanupTestFiles() {
  try {
    fs.unlinkSync(CLEAN_FILE_PATH);
    fs.unlinkSync(EICAR_FILE_PATH);
    console.log('Test files cleaned up');
  } catch (err) {
    console.error('Error cleaning up test files:', err);
  }
}

// Scan file using clamdscan
async function scanWithClamdscan(filePath) {
  return new Promise((resolve) => {
    console.log(`Scanning file with clamdscan: ${filePath}`);
    
    const clamdscan = spawn('clamdscan', ['--no-summary', '--stdout', filePath]);
    
    let stdout = '';
    let stderr = '';
    
    clamdscan.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    clamdscan.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    clamdscan.on('close', (code) => {
      console.log(`clamdscan exited with code ${code}`);
      console.log(`stdout: ${stdout.trim()}`);
      
      if (stderr) {
        console.error(`stderr: ${stderr.trim()}`);
      }
      
      // ClamAV returns 1 if virus found, 0 if clean
      const isInfected = code === 1 || stdout.includes('FOUND');
      
      // Extract virus names
      const viruses = [];
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
        resolve({
          isInfected: false,
          viruses: [],
          error: stderr || `clamdscan exited with code ${code}`,
        });
      } else {
        resolve({ isInfected, viruses });
      }
    });
    
    // Handle stream errors
    clamdscan.on('error', (error) => {
      console.error('Scan error:', error);
      resolve({
        isInfected: false,
        viruses: [],
        error: error.message,
      });
    });
  });
}

// Check if clamd is running
async function checkClamdStatus() {
  try {
    console.log('Checking clamd status...');
    const { stdout, stderr } = await exec('clamdscan --version');
    console.log('clamdscan version:', stdout.trim());
    
    if (stderr) {
      console.error('stderr:', stderr);
    }
    
    return true;
  } catch (error) {
    console.error('Error checking clamd status:', error.message);
    return false;
  }
}

// Run tests
async function runTests() {
  try {
    // Check if clamd is running
    const clamdRunning = await checkClamdStatus();
    if (!clamdRunning) {
      console.error('clamd is not running or clamdscan is not available. Please start the ClamAV daemon.');
      return;
    }
    
    // Create test files
    createTestFiles();
    
    // Test scan with clean file
    console.log('\nTesting scan with clean file...');
    const cleanResult = await scanWithClamdscan(CLEAN_FILE_PATH);
    console.log('Clean file scan result:', cleanResult);
    
    // Test scan with EICAR file
    console.log('\nTesting scan with EICAR test virus file...');
    const eicarResult = await scanWithClamdscan(EICAR_FILE_PATH);
    console.log('EICAR file scan result:', eicarResult);
    
    console.log('\nAll tests completed!');
    
    // Verify results
    if (!cleanResult.isInfected) {
      console.log('✅ Clean file test passed - no virus detected');
    } else {
      console.error('❌ Clean file test failed - false positive detected');
    }
    
    if (eicarResult.isInfected) {
      console.log('✅ EICAR file test passed - virus correctly detected');
      console.log('Detected viruses:', eicarResult.viruses);
    } else {
      console.error('❌ EICAR file test failed - virus not detected');
    }
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up
    cleanupTestFiles();
  }
}

// Run the tests
runTests();
