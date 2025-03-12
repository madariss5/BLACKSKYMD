/**
 * 𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻 Bot Handler
 * Manages WhatsApp connection and message handling
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeInMemoryStore, fetchLatestBaileysVersion, PHONENUMBER_MH } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Import message handlers
const { messageHandler } = require('./src/handlers/messageHandler');
const { commandLoader } = require('./src/utils/commandLoader');

// Configure options
const SESSION_DIR = path.join(__dirname, 'auth_info');
const BACKUP_DIR = path.join(__dirname, 'sessions');

// Set up logger
const logger = require('./src/utils/logger');

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
    console.error('Message process error:', error.message);
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
    console.error('Send error:', error.message);
  }
}

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
    console.log('Authentication data cleared');
  } catch (error) {
    console.error('Error clearing auth data:', error);
  }
}

/**
 * Initialize WhatsApp connection with retry logic
 */
async function connectToWhatsApp(retryCount = 0) {
  try {
    connectionState.state = 'connecting';
    console.log('🟢 Starting WhatsApp authentication...');

    // Ensure session directory exists
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Fetch latest version of Baileys
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

    // Initialize auth state
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    // Create WhatsApp socket connection optimized for maximum speed
    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      logger: pino({ level: 'silent' }),
      browser: ['𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻', 'Chrome', '121.0.0'],
      connectTimeoutMs: 30000,          // Reduced timeout for faster connection
      retryRequestDelayMs: 1000,        // Faster retry for failed requests
      defaultQueryTimeoutMs: 20000,     // Reduced query timeout
      emitOwnEvents: false,             // Don't emit own events (reduces overhead)
      syncFullHistory: false,           // Don't sync full history (saves time)
      fireInitQueries: true,            // Fire initialization queries in parallel
      markOnlineOnConnect: true,        // Mark as online immediately
      transactionOpts: {                // Faster transaction options
        maxCommitRetries: 2,            // Fewer retries for failed commits
        delayBetweenTriesMs: 500        // Shorter delay between retries
      },
      getMessage: async () => ({ conversation: '' }) // Minimal message retrieval
    });

    // Update connection state
    startTime = Date.now();

    // Load all command handlers
    console.log('Loading command handlers...');
    await commandLoader.loadCommandHandlers();
    console.log(`Successfully loaded ${commandLoader.commands.size} commands`);

    // Handle connection updates with improved error handling
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionState.state = 'qr_ready';
        connectionState.qrCode = qr;
        connectionState.connected = false;
        console.log('⏳ New QR code generated');
        qrCount++;
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log(`Connection closed with status code: ${statusCode}`);
        connectionState.state = 'disconnected';
        connectionState.connected = false;

        // Handle different error scenarios
        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          console.log('Session expired or invalid. Clearing auth data...');
          await clearAuthData();

          if (retryCount < RETRY_CONFIG.maxRetries) {
            const delay = getRetryDelay(retryCount);
            console.log(`Retrying connection in ${delay/1000} seconds... (Attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries})`);
            setTimeout(() => connectToWhatsApp(retryCount + 1), delay);
          } else {
            console.log('Max retry attempts reached. Please scan new QR code.');
            await resetConnection();
          }
        } else if (statusCode === DisconnectReason.connectionClosed) {
          console.log('Connection closed by server. Reconnecting...');
          setTimeout(() => connectToWhatsApp(0), 2000);
        } else if (statusCode === DisconnectReason.connectionLost) {
          console.log('Connection lost. Attempting immediate reconnection...');
          connectToWhatsApp(0);
        } else if (statusCode === DisconnectReason.connectionReplaced) {
          console.log('Connection replaced. Please re-scan QR code.');
          await resetConnection();
        } else {
          // For unknown errors, attempt reconnection with backoff
          if (retryCount < RETRY_CONFIG.maxRetries) {
            const delay = getRetryDelay(retryCount);
            console.log(`Unknown error. Retrying in ${delay/1000} seconds...`);
            setTimeout(() => connectToWhatsApp(retryCount + 1), delay);
          } else {
            console.log('Max retry attempts reached. Manual intervention required.');
          }
        }
      } else if (connection === 'open') {
        console.log('🟢 WhatsApp connection established!');
        connectionState.state = 'connected';
        connectionState.connected = true;
        retryCount = 0; // Reset retry counter on successful connection
      }
    });

    // Optimized message event handler with minimal logging
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // Skip non-notify events for performance
      if (type !== 'notify') return;
      
      // Process all valid messages quickly
      if (messages?.length) {
        for (const message of messages) {
          // Fast skip for empty messages
          if (!message?.message) continue;
          
          // Process message directly - minimal overhead
          try {
            await handleIncomingMessage(message);
          } catch (err) {
            // Minimal error handling in case of failure
            console.error('Message error:', err.message);
          }
        }
      }
    });

    // Handle credentials update
    sock.ev.on('creds.update', async () => {
      await saveCreds();
      console.log('Credentials updated and saved');
    });

    return sock;
  } catch (error) {
    console.error('Error initializing WhatsApp connection:', error);
    connectionState.state = 'disconnected';

    if (retryCount < RETRY_CONFIG.maxRetries) {
      const delay = getRetryDelay(retryCount);
      console.log(`Connection error. Retrying in ${delay/1000} seconds...`);
      setTimeout(() => connectToWhatsApp(retryCount + 1), delay);
    } else {
      console.error('Failed to establish connection after maximum retries');
      throw error;
    }
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
          console.log(`Session backup created: ${backupPath}`);
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
        console.log(`Removed old backup: ${oldestBackup}`);
      }
    } catch (error) {
      console.error('Error creating session backup:', error);
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
    console.log('🔄 Manually resetting connection...');
    
    // Force disconnect if connected
    if (sock) {
      try {
        sock.ev.removeAllListeners();
        await sock.logout();
      } catch (e) {
        console.log('Error during logout:', e);
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
    console.error('Error resetting connection:', error);
    return { success: false, message: 'Failed to reset connection' };
  }
}

// Add process error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Keep process alive but attempt reconnection
  if (sock) {
    resetConnection();
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Keep process alive but attempt reconnection
  if (sock) {
    resetConnection();
  }
});

// Add graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Performing graceful shutdown...');
  try {
    if (sock) {
      await sock.logout();
      sock = null;
    }
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

// Start the bot with error handling
(async () => {
  try {
    console.log('Starting WhatsApp Bot...');
    await connectToWhatsApp();
    console.log('Bot initialization complete');
  } catch (error) {
    console.error('Failed to start bot:', error);
    // Don't exit, let the retry mechanism handle it
  }
})();

module.exports = {
  connectToWhatsApp,
  setupSessionBackup,
  getConnectionStatus,
  resetConnection
};