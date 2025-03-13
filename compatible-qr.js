/**
 * Ultra-Compatible WhatsApp QR Generator
 * Designed for maximum scan success in Replit environment
 * 
 * This script combines both terminal QR code display and web-based QR code
 * for maximum compatibility and convenience.
 * 
 * This version has been updated to prevent Error 440 (conflict) issues
 * by using a dedicated authentication directory and mutex locking.
 */

// Set environment variable for QR server authentication directory
// This ensures it uses a separate directory from the bot handler
process.env.AUTH_DIR = 'auth_info_qr';
process.env.BOT_MODE = 'QR_SERVER';

// Display banner
console.log('\n==============================================');
console.log('  WHATSAPP BOT QR CODE GENERATOR');
console.log('==============================================');
console.log('Starting WhatsApp QR code generator...');
console.log('This will display the QR code in both terminal and web interface');
console.log('Auth directory: ' + process.env.AUTH_DIR);
console.log('==============================================\n');

// Create auth directory if it doesn't exist
const fs = require('fs');
const path = require('path');
const authDir = path.join(__dirname, process.env.AUTH_DIR);

if (!fs.existsSync(authDir)) {
  console.log(`Creating authentication directory: ${authDir}`);
  fs.mkdirSync(authDir, { recursive: true });
}

// Start server for the web-based QR code
require('./server.js');