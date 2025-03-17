/**
 * WhatsApp Connection Manager Module
 * Provides centralized connection management for the bot
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Initialize logger
const logger = pino({ 
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

// Create auth directory if it doesn't exist
const AUTH_FOLDER = path.join(process.cwd(), 'auth_info_baileys');
if (!fs.existsSync(AUTH_FOLDER)) {
  fs.mkdirSync(AUTH_FOLDER, { recursive: true });
  logger.info(`Created auth directory: ${AUTH_FOLDER}`);
}

// Connection store to manage connection state
const connectionStore = {
  socket: null,
  qr: null,
  isConnected: false,
  lastDisconnectReason: null,
  attemptCount: 0
};

/**
 * Create a new WhatsApp connection
 * @param {Object} options - Connection options
 * @returns {Promise<Object>} - The socket connection
 */
async function connect(options = {}) {
  const {
    authFolder = AUTH_FOLDER,
    printQR = true,
    customLogLevel = 'info'
  } = options;

  try {
    // Load auth state from filesystem
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    
    // Create WhatsApp socket with provided options
    const sock = makeWASocket({
      logger: pino({ level: customLogLevel }),
      printQRInTerminal: printQR,
      auth: state,
      browser: ['BLACKSKY-MD', 'Chrome', '4.0.0'],
      defaultQueryTimeoutMs: 60000
    });

    // Set up auth state change listener
    sock.ev.on('creds.update', saveCreds);

    // Handle connection updates
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Store QR code if available
      if (qr) {
        connectionStore.qr = qr;
        logger.info('New QR code received');
      }

      // Handle connection state changes
      if (connection === 'close') {
        const shouldReconnect = 
          lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

        connectionStore.isConnected = false;
        connectionStore.lastDisconnectReason = lastDisconnect?.error?.message || 'Unknown';
        
        logger.warn(`Connection closed due to ${connectionStore.lastDisconnectReason}`);
        
        // Handle reconnection
        if (shouldReconnect && connectionStore.attemptCount < 5) {
          connectionStore.attemptCount++;
          logger.info(`Attempting to reconnect (${connectionStore.attemptCount}/5)...`);
          // Reconnection is handled by the calling code
        } else if (connectionStore.attemptCount >= 5) {
          logger.error('Maximum reconnection attempts reached');
        }
      } else if (connection === 'open') {
        connectionStore.isConnected = true;
        connectionStore.attemptCount = 0;
        logger.info('Connection opened successfully');
      }
    });

    // Store socket reference
    connectionStore.socket = sock;
    return sock;
  } catch (err) {
    logger.error('Error creating WhatsApp connection:', err);
    throw err;
  }
}

/**
 * Get the current connection status
 * @returns {Object} - Connection status information
 */
function getConnectionStatus() {
  return {
    isConnected: connectionStore.isConnected,
    lastDisconnectReason: connectionStore.lastDisconnectReason,
    attemptCount: connectionStore.attemptCount
  };
}

/**
 * Get the current QR code
 * @returns {string|null} - Current QR code or null if not available
 */
function getCurrentQR() {
  return connectionStore.qr;
}

/**
 * Get the current socket connection
 * @returns {Object|null} - Current socket or null if not connected
 */
function getSocket() {
  return connectionStore.socket;
}

module.exports = {
  connect,
  getConnectionStatus,
  getCurrentQR,
  getSocket
};