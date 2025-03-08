const net = require('net');
const fs = require('fs');
const path = require('path');

// Path to clamd socket
const CLAMD_SOCKET = process.env.CLAMD_SOCKET || '/var/run/clamav/clamd.ctl';

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

// Properly formatted INSTREAM scan
function instreamScan(filePath) {
  return new Promise((resolve, reject) => {
    console.log(`Scanning file: ${filePath}`);
    
    // Read file content
    const fileContent = fs.readFileSync(filePath);
    console.log(`File size: ${fileContent.length} bytes`);
    
    // Connect to socket
    const socket = net.createConnection(CLAMD_SOCKET);
    let response = '';
    
    socket.on('connect', () => {
      console.log('Connected to clamd socket');
      
      // Send INSTREAM command
      socket.write('zINSTREAM\0');
      
      // Send file content with proper length prefix
      const sizeBuffer = Buffer.alloc(4);
      sizeBuffer.writeUInt32BE(fileContent.length, 0);
      socket.write(sizeBuffer);
      socket.write(fileContent);
      
      // End with zero-length chunk
      const endBuffer = Buffer.alloc(4);
      endBuffer.writeUInt32BE(0, 0);
      socket.write(endBuffer);
      
      console.log('File sent to clamd');
    });
    
    socket.on('data', (data) => {
      response += data.toString();
      console.log('Response chunk:', data.toString());
    });
    
    socket.on('end', () => {
      console.log('Final response:', response);
      resolve(response);
    });
    
    socket.on('error', (err) => {
      console.error('Socket error:', err);
      reject(err);
    });
    
    // Set timeout
    setTimeout(() => {
      if (!socket.destroyed) {
        socket.end();
        if (response) {
          resolve(response + ' (timeout)');
        } else {
          reject(new Error('Socket timeout'));
        }
      }
    }, 5000);
  });
}

// Run tests
async function runTests() {
  try {
    // Create test files
    createTestFiles();
    
    // Test clean file
    console.log('\nTesting clean file...');
    const cleanResult = await instreamScan(CLEAN_FILE_PATH);
    console.log('Clean file result:', cleanResult);
    
    // Test EICAR file
    console.log('\nTesting EICAR test virus file...');
    const eicarResult = await instreamScan(EICAR_FILE_PATH);
    console.log('EICAR file result:', eicarResult);
    
    console.log('\nAll tests completed!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up
    cleanupTestFiles();
  }
}

// Run the tests
runTests();
