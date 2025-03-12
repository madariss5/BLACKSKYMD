/**
 * WhatsApp Bot QR Web Server Launcher
 * This file launches the web server for the QR code scanner
 */

// Display banner
console.log('\n==============================================');
console.log('  WHATSAPP WEB QR CODE SERVER');
console.log('==============================================');
console.log('Starting WhatsApp QR code web server...');
console.log('This will allow you to scan the QR code from your browser');
console.log('==============================================\n');

// Launch the server
require('./server.js');