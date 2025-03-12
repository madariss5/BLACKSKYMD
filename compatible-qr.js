/**
 * Ultra-Compatible WhatsApp QR Generator
 * Designed for maximum scan success in Replit environment
 * 
 * This script combines both terminal QR code display and web-based QR code
 * for maximum compatibility and convenience.
 */

// Display banner
console.log('\n==============================================');
console.log('  WHATSAPP BOT QR CODE GENERATOR');
console.log('==============================================');
console.log('Starting WhatsApp QR code generator...');
console.log('This will display the QR code in both terminal and web interface');
console.log('==============================================\n');

// Start server for the web-based QR code
require('./server.js');