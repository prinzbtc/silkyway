// Simple script to test the antivirus scanning functionality
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

// Path to the EICAR test file
const eicarFilePath = path.join(__dirname, '..', 'eicar-test.txt');
// Path to a clean test file
const cleanFilePath = path.join(__dirname, '..', 'clean-test.txt');

// Create a clean test file
fs.writeFileSync(cleanFilePath, 'This is a clean test file with no viruses.');

// Configuration
const CLAMSCAN_PATH = '/usr/bin/clamscan';

// Function to scan a file
async function scanFile(filePath) {
  console.log(`Scanning file: ${filePath}`);
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Run clamscan on the file
    const command = `${CLAMSCAN_PATH} --no-summary ${filePath}`;
    console.log(`Running command: ${command}`);
    
    try {
      const { stdout, stderr } = await execAsync(command);
      console.log('Scan output:', stdout);
      
      // Check if the file is infected
      const isInfected = stdout.includes('FOUND');
      
      if (isInfected) {
        console.log(`❌ File is infected: ${filePath}`);
        return {
          isInfected: true,
          viruses: ['Virus detected'],
        };
      } else {
        console.log(`✅ File is clean: ${filePath}`);
        return {
          isInfected: false,
          viruses: [],
        };
      }
    } catch (error) {
      // ClamAV returns non-zero exit code when it finds a virus
      if (error.stdout && error.stdout.includes('FOUND')) {
        console.log(`❌ File is infected: ${filePath}`);
        // Extract virus name from the output
        const virusMatch = error.stdout.match(/: (.*) FOUND/);
        const virus = virusMatch ? virusMatch[1] : 'Unknown virus';
        
        return {
          isInfected: true,
          viruses: [virus],
        };
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error scanning file:', error);
    return {
      isInfected: false,
      viruses: [],
      error: error.message,
    };
  }
}

// Main function to run tests
async function runTests() {
  console.log('=== Testing Antivirus Scanning ===');
  
  // Test with EICAR test file (should detect virus)
  console.log('\n--- Testing with EICAR test file (should detect virus) ---');
  const eicarResult = await scanFile(eicarFilePath);
  console.log('EICAR test result:', eicarResult);
  
  // Test with clean file (should be clean)
  console.log('\n--- Testing with clean file (should be clean) ---');
  const cleanResult = await scanFile(cleanFilePath);
  console.log('Clean file test result:', cleanResult);
  
  // Clean up
  console.log('\nCleaning up test files...');
  fs.unlinkSync(cleanFilePath);
  console.log('Test completed!');
}

// Run the tests
runTests().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
