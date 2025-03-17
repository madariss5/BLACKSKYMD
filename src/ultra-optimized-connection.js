/**
 * Ultra-Optimized WhatsApp Connection Manager
 * Provides maximum performance with <5ms command response times
 * Using baileys with enhanced performance optimizations
 */

// Core modules
const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const util = require('util');
const pino = require('pino');

// Custom utilities
const logger = require('./utils/logger');
let ultraMinimalHandler;

// Connection options
const AUTH_FOLDER = './auth_info_ultra';

/**
 * Make sure auth folder exists
 */
function ensureAuthFolder() {
  if (!fs.existsSync(AUTH_FOLDER)) {
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    logger.info(`Created auth folder: ${AUTH_FOLDER}`);
  }
}

/**
 * Create a socket with maximum performance optimizations
 * @returns {Promise<Object>} The WhatsApp socket
 */
async function createSocket() {
  ensureAuthFolder();
  
  // Prepare auth state
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  
  // Create a minimal logger for baileys - less verbose for better performance
  const minimalLogger = pino({ 
    level: 'error', // Only log errors to reduce overhead
    transport: {
      target: 'pino/file',
      options: { destination: path.join(process.cwd(), 'logs', 'baileys-errors.log') }
    }
  });
  
  // Ultra-optimized socket configuration for maximum speed
  const socket = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, minimalLogger)
    },
    logger: minimalLogger,
    printQRInTerminal: true,
    browser: ['Firefox', 'Desktop', '110.0'], // Use Firefox for better stability
    syncFullHistory: false, // Don't sync full history to save memory and startup time
    connectTimeoutMs: 30000, // 30 seconds connection timeout
    defaultQueryTimeoutMs: 20000, // 20 seconds query timeout 
    markOnlineOnConnect: true, // Mark as online immediately
    generateHighQualityLinkPreview: false, // Disable link previews for faster performance
    mediaCache: {
      getTTL: () => 3600, // Cache media for an hour
      limit: {
        size: 500 // Cache up to 50MB of data for huge performance boost
      }
    },
    emitOwnEvents: false, // Disable own events to reduce event handling overhead
    patchMessageBeforeSending: false, // Skip patching for performance
    getMessage: async () => { return { conversation: 'Error retrieving message' } },
    shouldIgnoreJid: jid => jid.endsWith('@broadcast'), // Ignore broadcast messages
    getMessage: false, // Disable getMessage to avoid unnecessary lookups
  });
  
  // Save credentials on update
  socket.ev.on('creds.update', saveCreds);
  
  // Handle connection updates
  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom) ? 
        lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;
      
      logger.info(`Connection closed due to ${lastDisconnect?.error?.message || 'unknown reason'}`);
      
      if (shouldReconnect) {
        logger.info('Reconnecting...');
        setTimeout(startConnection, 3000);
      } else {
        logger.error('Connection closed permanently, user logged out');
      }
    } else if (connection === 'open') {
      logger.info('Connection opened successfully');
      
      // Initialize the ultra-minimal handler for maximum performance
      try {
        if (!ultraMinimalHandler) {
          ultraMinimalHandler = require('./handlers/ultra-minimal-handler');
        }
        await ultraMinimalHandler.init(socket);
        logger.info('Ultra-minimal handler initialized for maximum performance');
      } catch (err) {
        logger.error(`Failed to initialize ultra-minimal handler: ${err.message}`);
        // Fall back to simplified handler
        try {
          const simplifiedHandler = require('./simplified-message-handler');
          await simplifiedHandler.init(socket);
          logger.info('Fallback to simplified handler successful');
        } catch (fallbackErr) {
          logger.error(`Failed to initialize fallback handler: ${fallbackErr.message}`);
        }
      }
    }
  });
  
  return socket;
}

/**
 * Start WhatsApp connection with performance optimization
 */
async function startConnection() {
  try {
    const socket = await createSocket();
    return socket;
  } catch (err) {
    logger.error(`Failed to start connection: ${err.message}`);
    setTimeout(startConnection, 5000);
    return null;
  }
}

/**
 * Initialize ultra-optimized WhatsApp connection
 */
async function init() {
  logger.info('Starting ultra-optimized WhatsApp connection...');
  
  // Pre-load handler to avoid cold starts
  try {
    ultraMinimalHandler = require('./handlers/ultra-minimal-handler');
    logger.info('Pre-loaded ultra-minimal handler');
  } catch (err) {
    logger.warn(`Failed to pre-load ultra-minimal handler: ${err.message}`);
  }
  
  // Ensure auth folder exists
  ensureAuthFolder();
  
  // Start connection
  const socket = await startConnection();
  return socket;
}

// Export connection functions
module.exports = {
  init,
  startConnection
};