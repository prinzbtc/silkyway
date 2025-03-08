// Script to test the antivirus UI by mocking a virus detection response
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

// Path to the API route file that handles uploads
const apiRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'upload', 'route.ts');

// Backup the original file
const backupPath = `${apiRoutePath}.backup`;
console.log(`Backing up original file to ${backupPath}`);
fs.copyFileSync(apiRoutePath, backupPath);

// Read the file content
let fileContent = fs.readFileSync(apiRoutePath, 'utf8');

// Function to modify the API route to simulate virus detection
function injectVirusDetection() {
  console.log('Modifying API route to simulate virus detection...');
  
  // Add code to simulate virus detection for files with a specific name
  const injectedCode = `
    // Simulate virus detection for test files
    if (file.name.includes('test-virus')) {
      console.log('Simulating virus detection for test file:', file.name);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Virus detected: EICAR-Test-Signature FOUND' 
        },
        { status: 400 }
      );
    }
`;
  
  // Find a good place to inject the code - after file validation but before handling different upload purposes
  const insertPoint = fileContent.indexOf('// Handle different upload purposes');
  if (insertPoint !== -1) {
    fileContent = fileContent.slice(0, insertPoint) + injectedCode + fileContent.slice(insertPoint);
    fs.writeFileSync(apiRoutePath, fileContent);
    console.log('Successfully injected virus detection simulation code');
    return true;
  } else {
    console.error('Could not find a suitable insertion point in the API route file');
    return false;
  }
}

// Function to restore the original file
function restoreOriginalFile() {
  console.log('Restoring original API route file...');
  fs.copyFileSync(backupPath, apiRoutePath);
  fs.unlinkSync(backupPath);
  console.log('Original file restored');
}

// Main function
async function main() {
  console.log('=== Testing Antivirus UI ===');
  
  try {
    // Modify the API route
    const success = injectVirusDetection();
    if (!success) {
      console.error('Failed to modify API route. Aborting test.');
      return;
    }
    
    console.log('\nAPI route modified to simulate virus detection.');
    console.log('To test the UI:');
    console.log('1. Start the development server (if not already running)');
    console.log('2. Go to a page with file upload functionality');
    console.log('3. Upload a file with "test-virus" in its name (e.g., "test-virus.jpg")');
    console.log('4. The file should be rejected with a virus detection error');
    console.log('\nPress Ctrl+C to restore the original API route file when done testing.');
    
    // Keep the script running until user terminates it
    await new Promise(() => {});
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // This will run when the user terminates the script with Ctrl+C
    restoreOriginalFile();
  }
}

// Handle script termination
process.on('SIGINT', () => {
  restoreOriginalFile();
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  // Make sure we restore the original file even if the script crashes
  try {
    if (fs.existsSync(backupPath)) {
      restoreOriginalFile();
    }
  } catch (e) {
    console.error('Error restoring original file:', e);
  }
  process.exit(1);
});
