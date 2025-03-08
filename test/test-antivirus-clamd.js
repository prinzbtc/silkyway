/**
 * Test script for ClamAV daemon integration
 * This script directly tests clamd socket communication
 */

const fs = require('fs');
const path = require('path');
const net = require('net');

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

// Parse ClamAV response
function parseClamdResponse(response) {
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

// Scan file using clamd socket with chunking
function scanWithClamdSocket(filePath) {
  return new Promise((resolve, reject) => {
    try {
      // Read file content
      const fileContent = fs.readFileSync(filePath);
      const fileSize = fileContent.length;
      console.log(`Reading file for clamd scan: ${filePath}, size: ${fileSize} bytes`);
      
      // Connect to socket
      const socket = net.createConnection(CLAMD_SOCKET);
      let response = '';
      
      // Set socket timeout
      socket.setTimeout(60000); // 60 seconds timeout
      
      socket.on('timeout', () => {
        console.log('Socket timeout');
        socket.end();
        reject(new Error('Socket timeout after 60 seconds'));
      });

      socket.on('connect', () => {
        console.log(`Connected to clamd socket for scanning: ${filePath}`);
        
        try {
          // Send INSTREAM command with null terminator
          socket.write('INSTREAM\0', (err) => {
            if (err) {
              console.error('Error sending INSTREAM command:', err);
              socket.destroy();
              reject(new Error(`Error sending INSTREAM command: ${err.message}`));
              return;
            }
            
            // Use smaller chunks to send the file
            const CHUNK_SIZE = 1024; // 1KB chunks
            let offset = 0;
            
            const sendNextChunk = () => {
              if (offset >= fileContent.length) {
                // Send zero-length chunk to signal end of file
                const endBuffer = Buffer.alloc(4);
                endBuffer.writeUInt32BE(0, 0);
                socket.write(endBuffer, (err) => {
                  if (err) {
                    console.error('Error sending end chunk:', err);
                    socket.destroy();
                    reject(new Error(`Error sending end chunk: ${err.message}`));
                  } else {
                    console.log('End of file sent to clamd');
                  }
                });
                return;
              }
              
              // Calculate chunk size
              const chunkSize = Math.min(CHUNK_SIZE, fileContent.length - offset);
              const chunk = fileContent.slice(offset, offset + chunkSize);
              
              // Create size buffer
              const sizeBuffer = Buffer.alloc(4);
              sizeBuffer.writeUInt32BE(chunkSize, 0);
              
              // Send size followed by chunk
              socket.write(sizeBuffer, (err) => {
                if (err) {
                  console.error(`Error sending chunk size at offset ${offset}:`, err);
                  socket.destroy();
                  reject(new Error(`Error sending chunk size: ${err.message}`));
                  return;
                }
                
                socket.write(chunk, (err) => {
                  if (err) {
                    console.error(`Error sending chunk at offset ${offset}:`, err);
                    socket.destroy();
                    reject(new Error(`Error sending chunk: ${err.message}`));
                    return;
                  }
                  
                  // Move to next chunk
                  offset += chunkSize;
                  console.log(`Sent chunk: ${offset}/${fileContent.length} bytes`);
                  process.nextTick(sendNextChunk);
                });
              });
            };
            
            // Start sending chunks
            sendNextChunk();
          });
        } catch (err) {
          console.error('Error sending data to clamd:', err);
          socket.destroy();
          reject(new Error(`Error sending data to clamd: ${err.message}`));
        }
      });

      socket.on('data', (data) => {
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

      socket.on('error', (err) => {
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
    } catch (error) {
      console.error('Error reading file for clamd scan:', error);
      reject(error);
    }
  });
}

// Run tests
async function runTests() {
  try {
    // Create test files
    createTestFiles();
    
    // Test PING command
    console.log('\nTesting PING command...');
    const pingSocket = net.createConnection(CLAMD_SOCKET);
    await new Promise((resolve, reject) => {
      pingSocket.on('connect', () => {
        console.log('Connected to clamd socket');
        pingSocket.write('PING\n');
      });
      
      pingSocket.on('data', (data) => {
        console.log('PING response:', data.toString().trim());
        pingSocket.end();
        resolve();
      });
      
      pingSocket.on('error', (err) => {
        console.error('Socket error:', err);
        reject(err);
      });
    });
    
    // Test scan with clean file
    console.log('\nTesting scan with clean file...');
    const cleanResult = await scanWithClamdSocket(CLEAN_FILE_PATH);
    console.log('Clean file scan result:', cleanResult);
    
    // Test scan with EICAR file
    console.log('\nTesting scan with EICAR test virus file...');
    const eicarResult = await scanWithClamdSocket(EICAR_FILE_PATH);
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
