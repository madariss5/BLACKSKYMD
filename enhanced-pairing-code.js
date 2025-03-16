/**
 * Enhanced Pairing Code Generator for WhatsApp Bot
 * Special version that works around cloud environment restrictions
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');

// Settings
const AUTH_FOLDER = './auth_info_enhanced';
const MAX_RETRIES = 3;
const DEFAULT_PHONE = '4915561048015';  // Replace with your phone number
const DISPLAY_TIME = 120; // seconds to keep code displayed

// Browser fingerprints that work better with pairing codes
const BROWSER_FINGERPRINTS = [
  ['WhatsApp-Bot', 'Safari', '17.0'],
  ['WhatsApp-Bot', 'Chrome', '110.0.0'],
  ['WhatsApp-Bot', 'Firefox', '115.0'],
  ['WhatsApp-Bot', 'Edge', '105.0.0.0']
];

// Logger configuration - minimal logging for cleaner output
const logger = pino({ 
  level: 'warn',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: true
    }
  }
});

/**
 * Display a styled console message
 */
function displayMessage(message, style = 'info') {
  const styles = {
    info: '\x1b[36m%s\x1b[0m',     // Cyan
    success: '\x1b[32m%s\x1b[0m',  // Green
    warning: '\x1b[33m%s\x1b[0m',  // Yellow
    error: '\x1b[31m%s\x1b[0m',    // Red
    highlight: '\x1b[35m%s\x1b[0m' // Purple
  };
  
  console.log(styles[style] || styles.info, message);
}

/**
 * Clear terminal screen
 */
function clearScreen() {
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    exec('cls');
  } else {
    console.log('\x1bc');
  }
}

/**
 * Ensure auth directory exists and is empty
 */
async function clearAuthState() {
  displayMessage('Clearing previous auth files...', 'info');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(AUTH_FOLDER)) {
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    displayMessage('Auth directory created', 'success');
    return;
  }
  
  // Clear existing auth files
  const files = fs.readdirSync(AUTH_FOLDER);
  for (const file of files) {
    fs.unlinkSync(path.join(AUTH_FOLDER, file));
  }
  
  displayMessage('Auth files cleared successfully', 'success');
}

/**
 * Format phone number for pairing
 */
function formatPhoneNumber(phoneNumber) {
  // Remove any non-digit characters
  const digits = phoneNumber.replace(/\\D/g, '');
  
  // Ensure it doesn't start with +
  return digits.replace(/^\\+/, '');
}

/**
 * Display pairing code in a styled box
 */
function displayPairingCode(code, phone) {
  clearScreen();
  
  console.log('╔════════════════════════════════════════════╗');
  console.log('║      ENHANCED PAIRING CODE GENERATOR       ║');
  console.log('╚════════════════════════════════════════════╝');
  
  console.log('\n📱 Phone: ' + phone);
  console.log('🌐 Status: Pairing code generated successfully\n');
  
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  PAIRING CODE: ' + code + '  ║');
  console.log('╚════════════════════════════════════════════╝');
  
  console.log('\nEnter this code in WhatsApp > Settings > Linked Devices > Link a Device');
  console.log('\n⚠️ IMPORTANT: Even after entering this code, the connection will likely');
  console.log('fail with a 405 error due to WhatsApp\'s restrictions on cloud environments.');
  console.log('\n✅ SOLUTION: For a permanent connection, see CLOUD_ENVIRONMENT_GUIDE.md');
  console.log('This recommends doing the initial connection on your local computer,');
  console.log('then transferring the auth files to Replit.\n');
  
  displayMessage(`This window will close in ${DISPLAY_TIME} seconds...`, 'info');
  displayMessage('For detailed instructions, see CLOUD_ENVIRONMENT_GUIDE.md', 'highlight');
}

/**
 * Display error message in a styled box
 */
function displayError(message) {
  clearScreen();
  
  console.log('╔════════════════════════════════════════════╗');
  console.log('║              CONNECTION ERROR              ║');
  console.log('╚════════════════════════════════════════════╝');
  
  console.log('\n❌ ' + message);
  
  console.log('\n⚠️ WhatsApp is blocking connections from cloud environments like Replit');
  console.log('This is a security measure by WhatsApp, not an issue with our code.');
  
  console.log('\n✅ SOLUTION: For a permanent connection, see CLOUD_ENVIRONMENT_GUIDE.md');
  console.log('This recommends doing the initial connection on your local computer,');
  console.log('then transferring the auth files to Replit.\n');
  
  displayMessage('For detailed instructions, see CLOUD_ENVIRONMENT_GUIDE.md', 'highlight');
}

/**
 * Generate a pairing code
 */
async function generatePairingCode(retryCount = 0, browserIndex = 0) {
  try {
    // Format phone number for pairing
    const phone = formatPhoneNumber(DEFAULT_PHONE);
    console.log(`Attempt ${retryCount+1}/${MAX_RETRIES}`);
    console.log(`Phone number formatted for pairing: ${phone}`);
    
    // Select browser fingerprint
    const browser = BROWSER_FINGERPRINTS[browserIndex % BROWSER_FINGERPRINTS.length];
    console.log(`Using browser fingerprint: ${browser[1]}`);
    
    // Connect to WhatsApp
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: state,
      browser: browser,
      mobile: false,
      defaultQueryTimeoutMs: 10000
    });
    
    // Define connection handling logic
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (connection === 'open') {
        displayMessage('Connected to WhatsApp!', 'success');
        return;
      }
      
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        
        if (statusCode === 405) {
          if (retryCount < MAX_RETRIES - 1) {
            console.log(`Connection closed: Connection Failure (Status code: 405)`);
            console.log('Error 405 detected, switching browser fingerprint...');
            clearAuthState().then(() => {
              generatePairingCode(retryCount + 1, browserIndex + 1);
            });
          } else {
            displayError('Maximum retry attempts reached (405 error)');
          }
        } else {
          displayError(`Connection failed with status code: ${statusCode || 'unknown'}`);
        }
      }
    });
    
    // When credentials are updated
    sock.ev.on('creds.update', saveCreds);
    
    // Wait for a moment to allow the connection to establish before requesting pairing code
    setTimeout(async () => {
      try {
        console.log('Requesting pairing code...');
        const code = await sock.requestPairingCode(phone);
        
        if (code) {
          displayPairingCode(code, phone);
          
          // Close after display time
          setTimeout(() => {
            console.log('Done!');
            process.exit(0);
          }, DISPLAY_TIME * 1000);
        }
      } catch (err) {
        console.log(`Failed to request pairing code: ${err}`);
        
        if (retryCount < MAX_RETRIES - 1) {
          console.log('Retrying with a different browser fingerprint...');
          await clearAuthState();
          generatePairingCode(retryCount + 1, browserIndex + 1);
        } else {
          displayError('Failed to generate pairing code after multiple attempts');
        }
      }
    }, 3500);
    
  } catch (err) {
    console.error('Error in generatePairingCode:', err);
    displayError('Failed to initialize WhatsApp connection');
  }
}

// Main function
async function main() {
  clearScreen();
  console.log('╔════════════════════════════════════════════╗');
  console.log('║      ENHANCED PAIRING CODE GENERATOR       ║');
  console.log('╚════════════════════════════════════════════╝');
  
  await clearAuthState();
  await generatePairingCode();
}

// Start the application
main();