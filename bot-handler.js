/**
 * WhatsApp Bot Handler
 * Manages WhatsApp connection and message handling
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeInMemoryStore, fetchLatestBaileysVersion, PHONENUMBER_MH } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Configurable options
const SESSION_DIR = path.join(__dirname, 'auth_info');
const BACKUP_DIR = path.join(__dirname, 'sessions');

// Globals 
let sock = null;
let startTime = Date.now();
let connectionState = {
  state: 'disconnected',  // disconnected, connecting, qr_ready, connected
  qrCode: null,
  uptime: 0
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
 * Handle incoming commands
 */
async function handleCommand(message, text) {
  console.log('Command received:', text);
  const sender = message.key.remoteJid;

  if (text.startsWith('!ping')) {
    return { text: 'Pong! 🏓' };
  } 
  
  if (text.startsWith('!help')) {
    return { 
      text: '🤖 *Available Commands*\n\n' +
            '!ping - Check if bot is online\n' +
            '!help - Show this help message\n' +
            '!about - About this bot\n' +
            '!uptime - Show bot uptime'
    };
  }

  if (text.startsWith('!about')) {
    return { 
      text: '🤖 *WhatsApp Bot*\n\n' +
            'A sophisticated WhatsApp multi-device bot that delivers intelligent, ' +
            'interactive, and educational experiences through advanced messaging capabilities.'
    };
  }

  if (text.startsWith('!uptime')) {
    return { text: `🕒 Bot uptime: ${getUptime()}` };
  }

  // No command matched
  return null;
}

/**
 * Parse message to determine its type
 */
function getMessageType(message) {
  const types = ['conversation', 'imageMessage', 'videoMessage', 'extendedTextMessage', 'stickerMessage', 'documentMessage', 'audioMessage'];
  const messageContent = message.message || {};
  
  for (const type of types) {
    if (messageContent[type]) return type;
  }
  
  return null;
}

/**
 * Handle an incoming message
 */
async function handleIncomingMessage(message) {
  try {
    // Ignore messages from status broadcast
    if (message.key.remoteJid === 'status@broadcast') return;
    
    // Get message type
    const messageType = getMessageType(message);
    if (!messageType) return;
    
    // Extract message text
    let messageText = '';
    if (messageType === 'conversation') {
      messageText = message.message.conversation;
    } else if (messageType === 'extendedTextMessage' && message.message.extendedTextMessage?.text) {
      messageText = message.message.extendedTextMessage.text;
    } else {
      // Handle non-text messages (like stickers, images, etc.)
      const caption = message.message[messageType]?.caption;
      messageText = caption || '';
    }
    
    // Check if message is a command
    if (messageText.startsWith('!')) {
      const response = await handleCommand(message, messageText);
      if (response) {
        await sendResponse(message.key.remoteJid, response);
      }
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
}

/**
 * Send a response based on type
 */
async function sendResponse(jid, response) {
  try {
    if (!sock) return;
    
    if (response.text) {
      await sock.sendMessage(jid, { text: response.text });
    } else if (response.image) {
      await sock.sendMessage(jid, { 
        image: response.image,
        caption: response.caption || ''
      });
    } else if (response.sticker) {
      await sock.sendMessage(jid, { sticker: response.sticker });
    }
  } catch (error) {
    console.error('Error sending response:', error);
  }
}

/**
 * Initialize WhatsApp connection
 */
async function connectToWhatsApp() {
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

    // Create socket connection
    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      logger: pino({ level: 'silent' })
    });

    // Update connection state
    startTime = Date.now();

    // Handle connection updates
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        connectionState.state = 'qr_ready';
        connectionState.qrCode = qr;
        console.log('⏳ Generating QR code, please wait...');
        console.log('✅ QR code generated! Check web interface at http://localhost:5000');
        qrCount++;
      }
      
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error instanceof Boom &&
                              lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
        
        console.log('Connection closed due to ', lastDisconnect?.error);
        connectionState.state = 'disconnected';
        
        if (shouldReconnect) {
          console.log('Reconnecting...');
          connectToWhatsApp();
        } else {
          console.log('Not reconnecting.');
        }
      } else if (connection === 'open') {
        console.log('🟢 WhatsApp connection established!');
        connectionState.state = 'connected';
      }
    });

    // Handle messages
    sock.ev.on('messages.upsert', ({ messages }) => {
      if (!messages || !messages[0]) return;
      
      // Handle each message
      for (const message of messages) {
        if (message.key.fromMe) continue; // Skip own messages
        
        handleIncomingMessage(message);
      }
    });

    // Handle credentials update
    sock.ev.on('creds.update', saveCreds);

    return sock;
  } catch (error) {
    console.error('Error initializing WhatsApp connection:', error);
    connectionState.state = 'disconnected';
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

module.exports = {
  connectToWhatsApp,
  setupSessionBackup,
  getConnectionStatus
};