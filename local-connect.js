/**
 * Local WhatsApp Connection Script (Improved Version)
 * 
 * This script is designed to be run on your local machine (not in Replit/Heroku)
 * It will help you establish a connection and provide credentials for your bot
 * 
 * SETUP INSTRUCTIONS:
 * 1. Save this file to your local computer
 * 2. Install Node.js if you don't have it already
 * 3. Run these commands in your terminal/command prompt:
 *    npm install @whiskeysockets/baileys qrcode-terminal pino fs path
 * 4. Run: node local-connect.js
 * 5. Scan the QR code with your phone
 * 6. Credentials will be automatically sent to your number
 * 7. Upload the auth_info_baileys folder to your Heroku project
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

const AUTH_FOLDER = './auth_info_baileys';

// Configure this with your WhatsApp number (Include country code without +)
const YOUR_NUMBER = '4915561048015'; // Edit this with your WhatsApp number

// Create logger
const logger = pino({ 
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: true
    }
  } 
});

// Track connection state
let isConnected = false;
let connectionAttempt = 0;
const MAX_RETRIES = 5;

/**
 * Clear auth folder for fresh start (if needed)
 */
function clearAuthFolder() {
  if (fs.existsSync(AUTH_FOLDER)) {
    try {
      fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
      logger.info(`Cleared auth folder: ${AUTH_FOLDER}`);
    } catch (err) {
      logger.error(`Failed to clear auth folder: ${err.message}`);
    }
  }
  
  // Create fresh auth folder
  fs.mkdirSync(AUTH_FOLDER, { recursive: true });
}

/**
 * Calculate exponential backoff delay for reconnection attempts
 */
function getRetryDelay() {
  return Math.min(1000 * (2 ** connectionAttempt), 60000); // Max 60 seconds
}

/**
 * Main connection function
 */
async function connectToWhatsApp() {
  // Increment connection attempt counter
  connectionAttempt++;
  
  if (connectionAttempt > MAX_RETRIES) {
    logger.error(`Maximum connection attempts (${MAX_RETRIES}) reached. Please try again later.`);
    return;
  }
  
  // Create auth folder if it doesn't exist
  if (!fs.existsSync(AUTH_FOLDER)) {
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    logger.info(`Created auth folder: ${AUTH_FOLDER}`);
  }
  
  // Get the latest version of Baileys
  const { version } = await fetchLatestBaileysVersion();
  logger.info(`Using WA version: ${version.join('.')}`);
  
  // Load authentication state
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  
  logger.info(`Starting connection attempt ${connectionAttempt}/${MAX_RETRIES}...`);
  
  // Improved socket configuration for better connection reliability
  const socket = makeWASocket({
    version,
    printQRInTerminal: true,
    auth: state,
    logger,
    browser: ['WhatsApp Desktop', 'Chrome', '108.0.5359.125'],
    connectTimeoutMs: 60000,
    qrTimeout: 40000,
    markOnlineOnConnect: true,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 15000,
    emitOwnEvents: true,
    fireInitQueries: true,
    syncFullHistory: false,
    retryRequestDelayMs: 250
  });
  
  // Listen for auth updates
  socket.ev.on('creds.update', saveCreds);
  
  // Connection updates handling with better retry logic
  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    // Display QR code in terminal
    if (qr) {
      console.log('\n\n========== SCAN QR CODE WITH YOUR PHONE ==========\n\n');
      qrcode.generate(qr, { small: true });
      console.log('\n\nQR Code expires in 40 seconds. Be quick!\n\n');
    }
    
    // Handle successful connection
    if (connection === 'open') {
      isConnected = true;
      connectionAttempt = 0; // Reset retry counter
      logger.info('\n\n✅ CONNECTED SUCCESSFULLY!\n\n');
      logger.info(`Your authentication credentials have been saved to: ${AUTH_FOLDER}`);
      
      // Send credentials to yourself for backup
      await sendCredsToSelf(socket);
      
      console.log('\nIMPORTANT: Now upload the entire auth_info_baileys folder to your Heroku project.\n');
      console.log('Next steps:');
      console.log('1. Check your WhatsApp for the creds.json file (backup)');
      console.log('2. Zip the auth_info_baileys folder');
      console.log('3. Deploy your bot to Heroku');
      console.log('4. Use "heroku ps:copy" to upload the zip file');
      console.log('5. Extract into the auth_info_heroku folder on Heroku');
      console.log('6. Restart your Heroku dyno with "heroku dyno:restart"\n');
      
      // After sending credentials, keep the connection alive for a bit
      setTimeout(() => {
        console.log('Closing connection in 10 seconds...');
        setTimeout(() => {
          console.log('Authentication successful, exiting program');
          process.exit(0);
        }, 10000);
      }, 5000);
    }
    
    // Handle disconnection with better error handling
    if (connection === 'close') {
      isConnected = false;
      
      // Get disconnect reason
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.message || 'Unknown Error';
      
      logger.info(`Connection closed. Status: ${statusCode}, Reason: ${reason}`);
      
      // Handle specific disconnect scenarios
      if (statusCode === DisconnectReason.loggedOut) {
        logger.error('Device has been logged out. Please clear auth folder and try again.');
        // Optional: Automatically clear auth folder
        // clearAuthFolder();
        return;
      }
      
      if (statusCode === DisconnectReason.connectionLost) {
        logger.info('Connection lost. Retrying...');
      }
      
      if (statusCode === DisconnectReason.connectionReplaced) {
        logger.error('Connection replaced. Please restart the application.');
        return;
      }
      
      const retryDelay = getRetryDelay();
      logger.info(`Retrying connection in ${retryDelay/1000} seconds...`);
      
      // Use setTimeout for reconnect to prevent infinite rapid reconnect loop
      setTimeout(() => {
        connectToWhatsApp();
      }, retryDelay);
    }
  });
  
  // Return the socket
  return socket;
}

/**
 * Send credentials to yourself for backup
 * @param {Object} sock - WhatsApp socket
 */
async function sendCredsToSelf(sock) {
  try {
    // Your WhatsApp JID
    const jid = `${YOUR_NUMBER}@s.whatsapp.net`;
    
    // Check if creds.json exists
    const credsPath = path.join(AUTH_FOLDER, 'creds.json');
    if (!fs.existsSync(credsPath)) {
      logger.error('❌ creds.json not found, cannot send backup.');
      return false;
    }
    
    // Read creds.json
    const credsContent = fs.readFileSync(credsPath, 'utf8');
    
    // First, send a message notifying about the credentials
    await sock.sendMessage(jid, {
      text: `🔐 *WhatsApp Bot Authentication Backup*\n\n` +
            `Here is your credential backup from local-connect.js.\n\n` +
            `Timestamp: ${new Date().toISOString()}\n` +
            `Save this file for emergency recovery.`
    });
    
    // Then send the creds.json file
    await sock.sendMessage(jid, {
      document: Buffer.from(credsContent),
      mimetype: 'application/json',
      fileName: 'creds.json'
    });
    
    // Send additional files if they exist
    const authFiles = fs.readdirSync(AUTH_FOLDER);
    if (authFiles.includes('session-WhatsApp.json')) {
      const sessionPath = path.join(AUTH_FOLDER, 'session-WhatsApp.json');
      const sessionContent = fs.readFileSync(sessionPath, 'utf8');
      
      await sock.sendMessage(jid, {
        document: Buffer.from(sessionContent),
        mimetype: 'application/json',
        fileName: 'session-WhatsApp.json'
      });
    }
    
    // Also create a backup zip of the entire folder for easier transfer
    try {
      await sock.sendMessage(jid, {
        text: `💡 *Transfer Instructions*\n\n` +
              `To transfer these credentials to Heroku:\n\n` +
              `1. Zip the entire ${AUTH_FOLDER} folder\n` +
              `2. Upload to your Heroku server\n` +
              `3. Extract to auth_info_heroku folder\n` +
              `4. Restart your Heroku dyno\n\n` +
              `This ensures a persistent connection without 405 errors.`
      });
      
      logger.info('✅ Successfully sent credentials backup to your WhatsApp!');
      return true;
    } catch (err) {
      logger.error('Error sending transfer instructions:', err);
      return false;
    }
  } catch (err) {
    logger.error('❌ Error sending credentials to WhatsApp:', err);
    return false;
  }
}

// Show startup message
console.log('=================================================');
console.log('🤖 WHATSAPP LOCAL CONNECTION SCRIPT (IMPROVED)');
console.log('=================================================');
console.log('This script will connect to WhatsApp and generate');
console.log('authentication credentials for your Heroku bot.');
console.log('');
console.log('When the QR code appears, scan it with your phone.');
console.log('=================================================\n');

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Process terminated by user');
  process.exit(0);
});

// Start the connection
connectToWhatsApp()
  .catch(err => {
    logger.error('Fatal error starting connection:', err);
    process.exit(1);
  });