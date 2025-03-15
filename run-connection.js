/**
 * WhatsApp Bot Connection Helper
 * This script helps initialize a WhatsApp connection when encountering issues
 */

const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🤖 WhatsApp Bot Connection Helper 🤖\n');
console.log('This tool helps establish a connection to WhatsApp when experiencing issues.\n');
console.log('Available connection methods:');
console.log('1. Standard Web Connection (default)');
console.log('2. Web-based QR Code Generator (recommended for connection issues)');
console.log('3. Terminal-only QR Code (most reliable, but requires terminal access)');
console.log('4. Exit');

rl.question('\nPlease select a connection method (1-4): ', (choice) => {
  switch (choice.trim()) {
    case '1':
      console.log('\nStarting standard web connection on port 5000...');
      console.log('Visit http://localhost:5000 to scan the QR code.');
      spawn('node', ['src/index.js'], { stdio: 'inherit' });
      break;
    
    case '2':
      console.log('\nStarting web-based QR generator on port 5001...');
      console.log('Visit http://localhost:5001 to scan the QR code.');
      spawn('node', ['src/qr-generator.js'], { stdio: 'inherit' });
      break;
    
    case '3':
      console.log('\nStarting terminal-only QR code generator...');
      console.log('Look for the QR code in your terminal window.');
      spawn('node', ['src/terminal-qr.js'], { stdio: 'inherit' });
      break;
    
    case '4':
      console.log('Exiting...');
      process.exit(0);
      break;
    
    default:
      console.log('Invalid choice. Starting standard web connection...');
      spawn('node', ['src/index.js'], { stdio: 'inherit' });
  }
  
  rl.close();
});