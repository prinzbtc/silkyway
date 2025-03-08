const net = require('net');
const fs = require('fs');
const path = require('path');

// Path to clamd socket
const CLAMD_SOCKET = process.env.CLAMD_SOCKET || '/var/run/clamav/clamd.ctl';

// Test the PING command
function testPing() {
  return new Promise((resolve, reject) => {
    console.log('Testing PING command...');
    const socket = net.createConnection(CLAMD_SOCKET);
    let response = '';
    
    socket.on('connect', () => {
      console.log('Connected to clamd socket');
      socket.write('PING\n');
    });
    
    socket.on('data', (data) => {
      response += data.toString();
      console.log('Response:', response);
      socket.end();
    });
    
    socket.on('end', () => {
      resolve(response);
    });
    
    socket.on('error', (err) => {
      console.error('Socket error:', err);
      reject(err);
    });
  });
}

// Test the VERSION command
function testVersion() {
  return new Promise((resolve, reject) => {
    console.log('Testing VERSION command...');
    const socket = net.createConnection(CLAMD_SOCKET);
    let response = '';
    
    socket.on('connect', () => {
      console.log('Connected to clamd socket');
      socket.write('VERSION\n');
    });
    
    socket.on('data', (data) => {
      response += data.toString();
      console.log('Response:', response);
      socket.end();
    });
    
    socket.on('end', () => {
      resolve(response);
    });
    
    socket.on('error', (err) => {
      console.error('Socket error:', err);
      reject(err);
    });
  });
}

// Test the STATS command
function testStats() {
  return new Promise((resolve, reject) => {
    console.log('Testing STATS command...');
    const socket = net.createConnection(CLAMD_SOCKET);
    let response = '';
    
    socket.on('connect', () => {
      console.log('Connected to clamd socket');
      socket.write('STATS\n');
    });
    
    socket.on('data', (data) => {
      response += data.toString();
      console.log('Response:', response);
      socket.end();
    });
    
    socket.on('end', () => {
      resolve(response);
    });
    
    socket.on('error', (err) => {
      console.error('Socket error:', err);
      reject(err);
    });
  });
}

// Test the RELOAD command (requires privileges)
function testReload() {
  return new Promise((resolve, reject) => {
    console.log('Testing RELOAD command...');
    const socket = net.createConnection(CLAMD_SOCKET);
    let response = '';
    
    socket.on('connect', () => {
      console.log('Connected to clamd socket');
      socket.write('RELOAD\n');
    });
    
    socket.on('data', (data) => {
      response += data.toString();
      console.log('Response:', response);
      socket.end();
    });
    
    socket.on('end', () => {
      resolve(response);
    });
    
    socket.on('error', (err) => {
      console.error('Socket error:', err);
      reject(err);
    });
  });
}

// Run all tests
async function runTests() {
  try {
    console.log('=== Testing ClamAV Daemon Socket Commands ===');
    console.log(`Socket path: ${CLAMD_SOCKET}`);
    
    // Test basic commands
    await testPing();
    await testVersion();
    await testStats();
    
    // Test reload (may fail due to permissions)
    try {
      await testReload();
    } catch (err) {
      console.log('Reload test failed as expected (requires privileges)');
    }
    
    console.log('All tests completed!');
  } catch (err) {
    console.error('Test failed:', err);
  }
}

// Run the tests
runTests();
