// Load environment variables first
require('dotenv').config();

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

// Import message handlers
const { messageHandler } = require('./src/handlers/messageHandler');

// Configure options
const SESSION_DIR = path.join(__dirname, 'auth_info');
const BACKUP_DIR = path.join(__dirname, 'sessions');
const PORT = parseInt(process.env.PORT || '5000', 10);

// Set up pino logger properly
const logger = pino({
    level: 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    }
});

// Initialize express app
const app = express();

// Basic middleware
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
});

// Basic health check
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        port: PORT
    });
});

// Globals 
let sock = null;
let startTime = Date.now();
let connectionState = {
    state: 'disconnected',  // disconnected, connecting, qr_ready, connected
    qrCode: null,
    uptime: 0,
    connected: false
};

let qrCount = 0;
let backupInterval = null;

// Add new retry configuration
const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 2000, // Start with 2 seconds
  maxDelay: 60000  // Max 1 minute delay
};

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt) {
    const delay = Math.min(
        RETRY_CONFIG.maxDelay,
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt)
    );
    return delay + (Math.random() * 1000); // Add jitter
}

/**
 * Clear authentication data
 */
async function clearAuthData() {
    try {
        if (fs.existsSync(SESSION_DIR)) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }
        logger.info('Authentication data cleared');
    } catch (error) {
        logger.error('Error clearing auth data:', error);
    }
}

/**
 * Initialize WhatsApp connection with retry logic
 */
async function connectToWhatsApp(retryCount = 0) {
    try {
        connectionState.state = 'connecting';
        logger.info('🟢 Starting WhatsApp authentication...');

        // Ensure session directory exists
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
            logger.info('Created session directory');
        }

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        logger.info('Auth state loaded');

        // Create WhatsApp socket connection with proper logger
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: logger.child({ level: 'silent' }), // Properly initialize child logger
            browser: ['𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻', 'Chrome', '121.0.0'],
            connectTimeoutMs: 60000,
            retryRequestDelayMs: 2000,
            defaultQueryTimeoutMs: 60000,
            emitOwnEvents: false,             
            syncFullHistory: false,           
            fireInitQueries: true,            
            markOnlineOnConnect: true,        
            transactionOpts: {                
                maxCommitRetries: 2,            
                delayBetweenTriesMs: 500        
            },
            getMessage: async () => ({ conversation: '' }) 
        });

        logger.info('Socket connection created');

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            logger.debug('Connection update:', update);

            if (qr) {
                connectionState.state = 'qr_ready';
                connectionState.qrCode = qr;
                connectionState.connected = false;
                logger.info('⏳ New QR code generated');
                qrCount++;
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                logger.info(`Connection closed with status code: ${statusCode}`);
                connectionState.state = 'disconnected';
                connectionState.connected = false;

                const shouldReconnect = (lastDisconnect?.error instanceof Boom)? 
                    lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;

                logger.info('Connection closed due to:', lastDisconnect?.error?.message);

                if (shouldReconnect) {
                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        logger.info('Session expired or invalid. Clearing auth data...');
                        await clearAuthData();
                    }

                    if (retryCount < RETRY_CONFIG.maxRetries) {
                        const delay = getRetryDelay(retryCount);
                        logger.info(`Retrying connection in ${delay/1000} seconds... (Attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries})`);
                        setTimeout(() => connectToWhatsApp(retryCount + 1), delay);
                    } else {
                        logger.info('Max retry attempts reached. Please scan new QR code.');
                        await resetConnection();
                    }
                }
            } else if (connection === 'open') {
                logger.info('🟢 WhatsApp connection established!');
                connectionState.state = 'connected';
                connectionState.connected = true;
                retryCount = 0; // Reset retry counter on successful connection
            }
        });

        // Handle messages
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type === 'notify') {
                for (const message of messages) {
                    try {
                        await messageHandler(sock, message);
                    } catch (err) {
                        logger.error('Error handling message:', err);
                    }
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

        return sock;
    } catch (error) {
        logger.error('Error in WhatsApp connection:', error);
        throw error;
    }
}

/**
 * Backup session at regular intervals
 */
function setupSessionBackup() {
  // Clear existing interval if it exists
  if (backupInterval) {
    clearInterval(backupInterval);
  }
  
  // Set up new interval (every 5 minutes)
  backupInterval = setInterval(() => {
    try {
      const timestamp = Date.now();
      const backupPath = path.join(BACKUP_DIR, `creds_backup_${timestamp}.json`);
      
      // Copy current auth file
      const authFiles = fs.readdirSync(SESSION_DIR);
      for (const file of authFiles) {
        if (file.includes('creds')) {
          const srcPath = path.join(SESSION_DIR, file);
          fs.copyFileSync(srcPath, backupPath);
          logger.info(`Session backup created: ${backupPath}`);
          break;
        }
      }
      
      // Limit number of backups to 5
      const backups = fs.readdirSync(BACKUP_DIR)
                        .filter(file => file.startsWith('creds_backup_'))
                        .sort();
                        
      if (backups.length > 5) {
        const oldestBackup = path.join(BACKUP_DIR, backups[0]);
        fs.unlinkSync(oldestBackup);
        logger.info(`Removed old backup: ${oldestBackup}`);
      }
    } catch (error) {
      logger.error('Error creating session backup:', error);
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

/**
 * Get current connection status
 */
function getConnectionStatus() {
  connectionState.uptime = getUptime();
  return connectionState;
}

/**
 * Reset the connection state and reconnect
 */
async function resetConnection() {
  try {
    logger.info('🔄 Manually resetting connection...');
    
    // Force disconnect if connected
    if (sock) {
      try {
        sock.ev.removeAllListeners();
        await sock.logout();
      } catch (e) {
        logger.info('Error during logout:', e);
        // Continue anyway
      }
      sock = null;
    }
    
    // Reset state
    connectionState.state = 'connecting';
    connectionState.qrCode = null;
    connectionState.connected = false;
    
    // Reconnect
    connectToWhatsApp();
    
    return { success: true, message: 'Connection reset initiated' };
  } catch (error) {
    logger.error('Error resetting connection:', error);
    return { success: false, message: 'Failed to reset connection' };
  }
}


/**
 * Get formatted uptime string
 */
function getUptime() {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Parse message to determine its type
 */
/**
 * Fast message type detection - optimized for performance
 * Works by checking the most common message types first
 */
function getMessageType(message) {
  if (!message?.message) return null;
  
  // Check most common message types first (optimized order)
  const content = message.message;
  
  // Fast path for text messages (most common)
  if (content.conversation) return 'conversation';
  if (content.extendedTextMessage) return 'extendedTextMessage';
  
  // Fast path for media types (second most common)
  if (content.imageMessage) return 'imageMessage';
  if (content.videoMessage) return 'videoMessage';
  if (content.stickerMessage) return 'stickerMessage';
  
  // Less common types
  if (content.audioMessage) return 'audioMessage';
  if (content.documentMessage) return 'documentMessage';
  
  // Fall back to object key detection for any other types
  return Object.keys(content)[0] || null;
}

/**
 * Handle incoming messages using the optimized message handler
 */
async function handleIncomingMessage(message) {
  // Fast exit conditions - most common filters
  if (!message?.key?.remoteJid || 
      message.key.remoteJid === 'status@broadcast' || 
      !message.message) {
    return;
  }
  
  try {
    // Directly pass to message handler - minimal overhead
    await messageHandler(sock, message);
  } catch (error) {
    // Minimal error logging
    logger.error('Message process error:', error.message);
  }
}

/**
 * Send a response based on type - optimized for performance
 */
async function sendResponse(jid, response) {
  // Fast exit for common error cases
  if (!sock || !response || !jid) return;

  try {
    // Fast path: String responses (most common)
    if (typeof response === 'string') {
      return await sock.sendMessage(jid, { text: response });
    }
    
    // Object responses with optimal type checking
    if (response.text) {
      return await sock.sendMessage(jid, { text: response.text });
    } 
    
    if (response.image) {
      return await sock.sendMessage(jid, { 
        image: response.image,
        caption: response.caption || ''
      });
    } 
    
    if (response.sticker) {
      return await sock.sendMessage(jid, { sticker: response.sticker });
    }
    
    // Handle other media types
    if (response.video) {
      return await sock.sendMessage(jid, { 
        video: response.video,
        caption: response.caption || ''
      });
    }
    
    if (response.audio) {
      return await sock.sendMessage(jid, { 
        audio: response.audio,
        mimetype: 'audio/mp4'
      });
    }
    
    // Handle array of responses
    if (Array.isArray(response)) {
      for (const item of response) {
        await sendResponse(jid, item);
      }
    }
  } catch (error) {
    // Minimal error logging for speed
    logger.error('Send error:', error.message);
  }
}

/**
 * Main application startup
 */
async function start() {
    try {
        logger.info('Starting 𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻...');
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`Process ID: ${process.pid}`);

        // Create required directories
        [SESSION_DIR, BACKUP_DIR].forEach(dir => {
            if (!fs.existsSync(dir)) {
                logger.info(`Creating directory: ${dir}`);
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // Start HTTP server
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`Server started successfully on port ${PORT}`);

            // Initialize WhatsApp connection after server is ready
            (async () => {
                try {
                    logger.info('Initializing WhatsApp connection...');
                    await connectToWhatsApp();
                    setupSessionBackup(); //Start backup process
                    logger.info('WhatsApp connection initialized');
                } catch (error) {
                    logger.error('Failed to initialize WhatsApp:', error);
                    process.exit(1);
                }
            })();
        });

        server.on('error', (err) => {
            logger.error('Server error:', err);
            if (err.code === 'EADDRINUSE') {
                logger.error(`Port ${PORT} is already in use`);
            }
            process.exit(1);
        });

    } catch (error) {
        logger.error('Failed to start application:', error);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err);
    process.exit(1);
});

// Start application if running directly
if (require.main === module) {
    start().catch((error) => {
        logger.error('Fatal error during startup:', error);
        process.exit(1);
    });
}

module.exports = { connectToWhatsApp, setupSessionBackup, getConnectionStatus, resetConnection, start };