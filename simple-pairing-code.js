/**
 * Simple Pairing Code Generator
 * Specially crafted to provide pairing codes with minimal dependencies
 */

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

// Configuration
const AUTH_FOLDER = './auth_info_simple_pairing';
const PHONE_NUMBER = '4915561048015'; // Replace with your number
const BROWSER_OPTIONS = [
  ["DirectConnect", "Chrome", "110.0.0.0"],
  ["DirectConnect", "Firefox", "115.0"],
  ["DirectConnect", "Safari", "17.0"],
  ["DirectConnect", "Edge", "120.0.0.0"]
];

// Clear auth directory for fresh start
if (fs.existsSync(AUTH_FOLDER)) {
  fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
}
fs.mkdirSync(AUTH_FOLDER, { recursive: true });

// Retry mechanism
let attemptCount = 0;
const MAX_ATTEMPTS = 10;

async function generatePairingCode() {
  try {
    attemptCount++;
    console.log(`\n╔════════════════════════════════════════════╗`);
    console.log(`║      SIMPLE PAIRING CODE GENERATOR         ║`);
    console.log(`╚════════════════════════════════════════════╝`);
    console.log(`Attempt ${attemptCount}/${MAX_ATTEMPTS}`);
    
    // Format phone number (remove + if present)
    const phoneNumber = PHONE_NUMBER.startsWith('+') 
      ? PHONE_NUMBER.substring(1) 
      : PHONE_NUMBER;
    
    console.log(`Phone number formatted for pairing: ${phoneNumber}`);
    
    // Get random browser fingerprint
    const browser = BROWSER_OPTIONS[Math.floor(Math.random() * BROWSER_OPTIONS.length)];
    console.log(`Using browser fingerprint: ${browser[1]}`);
    
    // Initialize auth state
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    
    // Create socket connection
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser,
      logger: pino({ level: 'silent' }),
      mobile: false
    });
    
    // Handle connection updates
    sock.ev.on('connection.update', async update => {
      const { connection, lastDisconnect, qr } = update;
      
      // If connection closed and we haven't reached max attempts, try again
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log(`Connection closed (Status: ${statusCode || 'unknown'})`);
        
        if (attemptCount < MAX_ATTEMPTS) {
          console.log('Trying again with different browser fingerprint...');
          setTimeout(generatePairingCode, 1000);
        } else {
          console.log('Max attempts reached. Please try again later.');
          process.exit(1);
        }
      }
    });
    
    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);
    
    // Request pairing code after a brief delay
    setTimeout(async () => {
      try {
        console.log('Requesting pairing code...');
        const code = await sock.requestPairingCode(phoneNumber);
        console.log('\n╔════════════════════════════════════════════╗');
        console.log(`║  PAIRING CODE: ${code}  ║`);
        console.log('╚════════════════════════════════════════════╝\n');
        console.log('Enter this code in WhatsApp > Settings > Linked Devices > Link a Device\n');
        
        // Keep script running for a while to allow user to use the code
        console.log('This window will close in 60 seconds...');
        setTimeout(() => {
          console.log('Done!');
          process.exit(0);
        }, 60000);
      } catch (error) {
        console.error('Error requesting pairing code:', error.message);
        
        if (attemptCount < MAX_ATTEMPTS) {
          console.log('Trying again with different browser fingerprint...');
          setTimeout(generatePairingCode, 1000);
        } else {
          console.log('Max attempts reached. Please try again later.');
          process.exit(1);
        }
      }
    }, 3000);
    
  } catch (error) {
    console.error('Error in pairing code generation:', error.message);
    
    if (attemptCount < MAX_ATTEMPTS) {
      console.log('Trying again with different browser fingerprint...');
      setTimeout(generatePairingCode, 1000);
    } else {
      console.log('Max attempts reached. Please try again later.');
      process.exit(1);
    }
  }
}

// Start generating pairing code
generatePairingCode();