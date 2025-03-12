/**
 * Replit-Optimized WhatsApp QR Code Generator
 * Designed for maximum compatibility with WhatsApp's latest security
 */

const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Auth directory
const AUTH_DIR = path.join(process.cwd(), 'auth_info');

// Create a clean auth directory
if (fs.existsSync(AUTH_DIR)) {
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
}
fs.mkdirSync(AUTH_DIR, { recursive: true });

// Clear the console and show welcome message
console.clear();
console.log('\n==============================================');
console.log('  WHATSAPP QR CODE GENERATOR FOR REPLIT');
console.log('==============================================');
console.log('A QR code will appear below shortly.');
console.log('To connect:');
console.log('1. Open WhatsApp on your phone');
console.log('2. Tap Menu (or Settings) and select "Linked Devices"');
console.log('3. Tap on "Link a Device"');
console.log('4. Point your phone camera at the QR code');
console.log('==============================================\n');

// Connection function
async function startConnection() {
  try {
    // Get the latest version of Baileys
    const { version } = await fetchLatestBaileysVersion();
    console.log(`Using Baileys version ${version.join('.')}`);
    
    // Load or initialize auth state
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    
    // Create a connection with optimized settings for Replit
    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false, // We'll handle this ourselves
      browser: ['WhatsApp Web', 'Chrome', '108.0.5359.128'],
      logger: pino({ level: 'warn' }),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      qrTimeout: 60000,
      defaultQueryTimeoutMs: 60000,
      emitOwnEvents: false,
      fireInitQueries: false,
      generateHighQualityLinkPreview: false,
      patchMessageBeforeSending: false
    });
    
    // Connection update handler
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        // When QR code is received, display it nicely
        console.log('\n==============================================');
        console.log('              SCAN THIS QR CODE');
        console.log('==============================================\n');
        qrcode.generate(qr, { small: true });
        console.log('\n==============================================');
        console.log('If this QR code expires, a new one will appear');
        console.log('==============================================\n');
      }
      
      if (connection === 'open') {
        // Successfully connected
        console.log('\n==============================================');
        console.log('           CONNECTED SUCCESSFULLY!');
        console.log('==============================================');
        console.log('Your WhatsApp bot is now authenticated and ready to use.');
        console.log('You can close this window and start your main bot application.');
        console.log('==============================================\n');
        
        // Save auth credentials
        await saveCreds();
      }
      
      if (connection === 'close') {
        // Handle disconnection
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || 'Unknown reason';
        
        console.log('\n==============================================');
        console.log(`CONNECTION CLOSED: ${reason}`);
        console.log(`Status code: ${statusCode || 'N/A'}`);
        console.log('==============================================\n');
        
        if (statusCode !== DisconnectReason.loggedOut) {
          console.log('Attempting to reconnect...');
          setTimeout(startConnection, 5000);
        } else {
          console.log('You have been logged out.');
          console.log('Please restart this script to generate a new QR code.');
        }
      }
    });
    
    // Save credentials when they are updated
    sock.ev.on('creds.update', saveCreds);
    
    return sock;
  } catch (err) {
    console.error('Connection error:', err);
    console.log('\nRetrying in 10 seconds...');
    setTimeout(startConnection, 10000);
    return null;
  }
}

// Start the connection
startConnection().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

// Keep the program running
process.stdin.resume();

// Handle termination
process.on('SIGINT', () => {
  console.log('\nExiting...');
  process.exit(0);
});