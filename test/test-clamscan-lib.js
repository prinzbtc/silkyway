/**
 * Test script for ClamAV daemon integration using the clamscan library
 */

const fs = require('fs');
const path = require('path');
const NodeClam = require('clamscan');

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

// Run tests with clamscan library
async function runTests() {
  try {
    // Create test files
    createTestFiles();
    
    // Initialize ClamAV scanner
    console.log('Initializing ClamAV scanner...');
    const options = {
      clamdscan: {
        socket: process.env.CLAMD_SOCKET || '/var/run/clamav/clamd.ctl',
        host: false,
        port: false,
        timeout: 60000,
        local_fallback: true,
        path: '/usr/bin/clamdscan',
        config_file: '/etc/clamav/clamd.conf'
      },
      preference: 'clamdscan' // Use clamdscan (daemon) over clamscan
    };
    
    // Create instance
    const clamscan = await new NodeClam().init(options);
    
    console.log('ClamAV scanner initialized');
    console.log('Version:', await clamscan.getVersion());
    
    // Test scan with clean file
    console.log('\nTesting scan with clean file...');
    const cleanResult = await clamscan.isInfected(CLEAN_FILE_PATH);
    console.log('Clean file scan result:', cleanResult);
    
    // Test scan with EICAR file
    console.log('\nTesting scan with EICAR test virus file...');
    const eicarResult = await clamscan.isInfected(EICAR_FILE_PATH);
    console.log('EICAR file scan result:', eicarResult);
    
    // Test scan with stream
    console.log('\nTesting stream scan with clean file...');
    const cleanStream = fs.createReadStream(CLEAN_FILE_PATH);
    const cleanStreamResult = await clamscan.scanStream(cleanStream);
    console.log('Clean file stream scan result:', cleanStreamResult);
    
    // Test scan with stream for EICAR
    console.log('\nTesting stream scan with EICAR test virus file...');
    const eicarStream = fs.createReadStream(EICAR_FILE_PATH);
    const eicarStreamResult = await clamscan.scanStream(eicarStream);
    console.log('EICAR file stream scan result:', eicarStreamResult);
    
    console.log('\nAll tests completed!');
    
    // Verify results
    if (!cleanResult.isInfected && !cleanStreamResult.isInfected) {
      console.log('✅ Clean file tests passed - no virus detected');
    } else {
      console.error('❌ Clean file tests failed - false positive detected');
    }
    
    if (eicarResult.isInfected && eicarStreamResult.isInfected) {
      console.log('✅ EICAR file tests passed - virus correctly detected');
      console.log('Detected viruses:', [
        eicarResult.viruses || 'Unknown virus',
        eicarStreamResult.viruses || 'Unknown virus'
      ]);
    } else {
      console.error('❌ EICAR file tests failed - virus not detected');
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
