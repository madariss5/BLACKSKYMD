/**
 * Safari-based WhatsApp Connection
 * Advanced connection system optimized for cloud environments
 * Features automatic credential backup and enhanced error recovery
 * Version: 1.2.2
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fsPromises = require('fs').promises;

// Initialize Express
const app = express();
const port = process.env.PORT || 5000;

// Configuration
const AUTH_FOLDER = process.env.AUTH_DIR || './auth_info_safari';
const VERSION = '1.2.2';
const MAX_RETRIES = 10;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const RECONNECT_INTERVAL = 60000; // 1 minute base interval
const QR_TIMEOUT = 60000; // 1 minute QR timeout

// Environment detection
const IS_CLOUD_ENV = process.env.REPLIT_ID || process.env.HEROKU_APP_ID;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Setup logger with improved formatting
const LOGGER = pino({ 
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: false,
      ignore: 'hostname,pid',
      translateTime: 'SYS:standard'
    }
  }
}).child({ name: 'BLACKSKY-MD' });

// Connection state
let sock = null;
let connectionRetries = 0;
let reconnectTimer = null;
let heartbeatTimer = null;
let cleanupTimer = null;
let qrDisplayTimer = null;
let qrGenerated = false;
let connectionState = 'disconnected';
let lastDisconnectCode = null;
let lastQRCode = null;
let isReconnecting = false;
let lastConnectTime = null;
let connectionUptime = 0;
let qrRetryCount = 0;

// Safari fingerprint (optimized for reliability)
const SAFARI_FINGERPRINT = {
  browser: ['Safari', '17.0'],
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
};

// Setup Express routes
app.get('/', (req, res) => {
  const uptime = lastConnectTime ? Math.floor((Date.now() - lastConnectTime) / 1000) : 0;
  res.json({
    status: connectionState,
    retries: connectionRetries,
    maxRetries: MAX_RETRIES,
    hasQR: !!lastQRCode,
    qrRetries: qrRetryCount,
    lastError: lastDisconnectCode,
    version: VERSION,
    uptime: uptime,
    isReconnecting,
    totalUptime: connectionUptime
  });
});

app.get('/status', (req, res) => {
  res.json({
    state: connectionState,
    qrGenerated,
    retries: connectionRetries,
    qrRetries: qrRetryCount,
    lastError: lastDisconnectCode,
    environment: IS_CLOUD_ENV ? 'cloud' : 'local',
    timestamp: new Date().toISOString(),
    lastConnectTime: lastConnectTime ? new Date(lastConnectTime).toISOString() : null
  });
});

// Start Express server
const server = app.listen(port, '0.0.0.0', () => {
  LOGGER.info(`Status monitor running on port ${port}`);
});

// Update the displayQRCode function with enhanced logging
function displayQRCode(qr) {
  LOGGER.info(`Generating QR code (Attempt ${qrRetryCount + 1}/${MAX_RETRIES})`);

  console.log('\n▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄');
  console.log('█                   SCAN QR CODE TO CONNECT                      █');
  console.log('▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀\n');

  try {
    // Generate QR in terminal with small size for better cloud compatibility
    qrcode.generate(qr, { small: true });
    LOGGER.info('QR code generated successfully');

    console.log('\n▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄');
    console.log(`█  Scan within ${QR_TIMEOUT/1000} seconds. Attempt ${qrRetryCount + 1} of ${MAX_RETRIES}   █`);
    console.log('▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀\n');

    // Set QR timeout
    if (qrDisplayTimer) clearTimeout(qrDisplayTimer);
    qrDisplayTimer = setTimeout(() => {
      if (connectionState === 'awaiting_scan') {
        LOGGER.warn('QR code expired, initiating new QR generation');
        qrRetryCount++;
        if (qrRetryCount < MAX_RETRIES) {
          handleReconnection('QR timeout');
        } else {
          LOGGER.error('Max QR retry attempts reached, restarting process');
          process.exit(1); // Force restart in cloud environment
        }
      }
    }, QR_TIMEOUT);

  } catch (err) {
    LOGGER.error('Error generating QR code:', err);
    // Attempt to recover by using baileys built-in QR display
    sock.ev.emit('connection.update', { qr: qr });
  }
}

// Initialize connection
async function initializeConnection() {
  // Clear all existing auth folders to prevent conflicts
  const authFolders = [
    './auth_info_baileys',
    './auth_info_terminal',
    './auth_info_safari',
    './auth_info_web'
  ];

  for (const folder of authFolders) {
    if (fs.existsSync(folder)) {
      LOGGER.info(`Cleaning up auth folder: ${folder}`);
      fs.rmSync(folder, { recursive: true, force: true });
    }
  }

  // Create fresh auth folder
  fs.mkdirSync(AUTH_FOLDER, { recursive: true });
  LOGGER.info('Fresh auth folder created');

  // Reset QR state
  qrRetryCount = 0;
  lastQRCode = null;
  if (qrDisplayTimer) clearTimeout(qrDisplayTimer);
}

// Heartbeat mechanism
function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);

  heartbeatTimer = setInterval(async () => {
    if (sock && sock.user) {
      try {
        await sock.sendPresenceUpdate('available');
        LOGGER.debug('Heartbeat sent successfully');

        // Update connection uptime
        if (lastConnectTime) {
          connectionUptime = Math.floor((Date.now() - lastConnectTime) / 1000);
        }
      } catch (err) {
        LOGGER.warn('Heartbeat failed:', err.message);
        if (!isReconnecting) {
          handleReconnection('Heartbeat failure');
        }
      }
    }
  }, HEARTBEAT_INTERVAL);
}

// Cleanup mechanism
function startCleanup() {
  if (cleanupTimer) clearInterval(cleanupTimer);

  cleanupTimer = setInterval(async () => {
    if (sock && sock.user) {
      try {
        // Clear any pending messages
        await sock.sendPresenceUpdate('unavailable');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await sock.sendPresenceUpdate('available');

        LOGGER.debug('Cleanup completed successfully');
      } catch (err) {
        LOGGER.warn('Cleanup failed:', err.message);
      }
    }
  }, CLEANUP_INTERVAL);
}

// Handle reconnection
async function handleReconnection(reason) {
  if (isReconnecting) {
    LOGGER.info('Reconnection already in progress, skipping...');
    return;
  }

  isReconnecting = true;
  connectionState = 'reconnecting';

  try {
    LOGGER.info(`Initiating reconnection due to: ${reason}`);

    // Clear existing timers
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (cleanupTimer) clearInterval(cleanupTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);

    // Wait before attempting reconnection
    const delay = Math.min(Math.pow(2, connectionRetries) * 1000, RECONNECT_INTERVAL);
    LOGGER.info(`Waiting ${delay/1000}s before reconnection attempt...`);

    await new Promise(resolve => setTimeout(resolve, delay));

    // Initialize fresh connection
    await initializeConnection();
    await startConnection();
  } catch (err) {
    LOGGER.error('Error during reconnection:', err);
    connectionState = 'error';
  } finally {
    isReconnecting = false;
  }
}

// Generate unique device ID
function generateDeviceId() {
  const randomString = Math.random().toString(36).substring(2, 7);
  const timestamp = Date.now().toString().slice(-6);
  return `BLACKSKY-MD-${timestamp}-${randomString}`;
}

// Handle connection updates
async function handleConnectionUpdate(update) {
  const { connection, lastDisconnect, qr } = update;

  if (qr) {
    qrGenerated = true;
    lastQRCode = qr;
    LOGGER.info(`QR Code received (Attempt ${qrRetryCount + 1}/${MAX_RETRIES})`);
    connectionState = 'awaiting_scan';
    displayQRCode(qr);
  }

  if (connection === 'close') {
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const reason = lastDisconnect?.error?.message || 'Unknown';

    lastDisconnectCode = statusCode;
    connectionState = 'disconnected';
    lastConnectTime = null;

    LOGGER.info(`Connection closed (Code: ${statusCode}). Reason: ${reason}`);

    // Handle specific error cases
    if (statusCode === DisconnectReason.loggedOut || 
        (lastDisconnect?.error instanceof Boom && lastDisconnect.error.output.statusCode === 440)) {
      LOGGER.warn('Session expired or logged out, clearing auth state');
      connectionRetries = 0;
      qrRetryCount = 0; // Reset QR retries on logout
      handleReconnection('Session expired');
    } else if (statusCode === 405) {
      LOGGER.warn('405 error detected - adjusting connection parameters');
      if (connectionRetries < MAX_RETRIES) {
        connectionRetries++;
        handleReconnection('Rate limit (405)');
      } else {
        LOGGER.error('Max retries reached - restarting process');
        process.exit(1); // Force restart in cloud environment
      }
    } else {
      // Generic reconnection logic
      if (connectionRetries < MAX_RETRIES) {
        connectionRetries++;
        handleReconnection('Generic error');
      } else {
        LOGGER.error('Max retries reached - restarting process');
        process.exit(1); // Force restart in cloud environment
      }
    }
  } else if (connection === 'open') {
    connectionState = 'connected';
    lastQRCode = null;
    qrRetryCount = 0;
    connectionRetries = 0;
    lastConnectTime = Date.now();

    // Clear QR timeout if it exists
    if (qrDisplayTimer) {
      clearTimeout(qrDisplayTimer);
      qrDisplayTimer = null;
    }

    LOGGER.info('✅ SUCCESSFULLY CONNECTED TO WHATSAPP!');
    LOGGER.info(`📱 Connected as: ${sock.user?.id || 'Unknown'}`);

    // Start monitoring systems
    startHeartbeat();
    startCleanup();

    try {
      // Send welcome message
      if (sock && sock.user) {
        await sock.sendMessage(sock.user.id, { 
          text: `🤖 *BLACKSKY-MD Bot Connected!*\n\n` +
                `_Connection Time: ${new Date().toLocaleString()}_\n` +
                `_Version: ${VERSION}_\n\n` +
                `Send *!help* to see available commands.` 
        });
        LOGGER.info('Welcome message sent');
      }
    } catch (err) {
      LOGGER.error('Error sending welcome message:', err);
    }
  }
}

// Utility function to send typing indicator
async function showTypingIndicator(sock, jid, durationMs = 1000) {
  try {
    await sock.presenceSubscribe(jid);
    await sock.sendPresenceUpdate('composing', jid);
    
    // Wait for the specified duration
    await new Promise(resolve => setTimeout(resolve, durationMs));
    
    // Stop typing indicator
    await sock.sendPresenceUpdate('paused', jid);
    return true;
  } catch (err) {
    LOGGER.error(`Error showing typing indicator: ${err.message}`);
    return false;
  }
}

// Copy auth files to main auth folder with verification
async function copyAuthToMain() {
  try {
    const mainAuthFolder = './auth_info_baileys';
    if (!fs.existsSync(mainAuthFolder)) {
      fs.mkdirSync(mainAuthFolder, { recursive: true });
    }
    
    // Clear any existing files in the main folder
    const existingFiles = fs.readdirSync(mainAuthFolder);
    for (const file of existingFiles) {
      const filePath = path.join(mainAuthFolder, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    }
    
    if (fs.existsSync(AUTH_FOLDER)) {
      // Get the list of source files
      const files = fs.readdirSync(AUTH_FOLDER);
      LOGGER.info(`Copying ${files.length} auth files to main folder...`);
      
      // Copy each file
      let copiedCount = 0;
      for (const file of files) {
        const srcPath = path.join(AUTH_FOLDER, file);
        const destPath = path.join(mainAuthFolder, file);
        if (fs.statSync(srcPath).isFile()) {
          fs.copyFileSync(srcPath, destPath);
          copiedCount++;
        }
      }
      
      // Verify the copy was successful
      const verifyFiles = fs.readdirSync(mainAuthFolder);
      LOGGER.info(`Auth files copied: ${copiedCount}/${files.length}, verified: ${verifyFiles.length} files present in target folder`);
      
      // Make sure essential files were copied
      const essentialFiles = ['creds.json'];
      for (const essential of essentialFiles) {
        const essentialPath = path.join(mainAuthFolder, essential);
        if (!fs.existsSync(essentialPath)) {
          LOGGER.warn(`Essential file ${essential} not found in target folder!`);
          
          // Try to copy it directly
          const srcEssential = path.join(AUTH_FOLDER, essential);
          if (fs.existsSync(srcEssential)) {
            fs.copyFileSync(srcEssential, essentialPath);
            LOGGER.info(`Re-copied essential file ${essential}`);
          } else {
            LOGGER.error(`Essential file ${essential} not found in source!`);
          }
        }
      }
      
      LOGGER.info('Auth files copied to main folder successfully');
      return true;
    }
    return false;
  } catch (error) {
    LOGGER.error('Error copying auth files:', error);
    return false;
  }
}

// Send credentials backup to the bot's own number
async function sendCredsBackup(sock) {
  try {
    // Get the bot's own JID
    const ownJid = sock.user.id;
    LOGGER.info(`Preparing to send credentials backup to ${ownJid.replace(/@.+/, '@...')}`);
    
    // Path to creds.json file
    const credsPath = path.join(AUTH_FOLDER, 'creds.json');
    
    // Verify creds file exists and has content
    if (!fs.existsSync(credsPath)) {
      LOGGER.error('Cannot send credentials backup: creds.json not found');
      return false;
    }
    
    const credsSize = fs.statSync(credsPath).size;
    if (credsSize === 0) {
      LOGGER.error('Cannot send credentials backup: creds.json is empty');
      return false;
    }
    
    // Read the file as a buffer
    const credsBuffer = fs.readFileSync(credsPath);
    
    // Send the credentials file
    await sock.sendMessage(ownJid, {
      document: credsBuffer,
      fileName: 'creds.json',
      mimetype: 'application/json',
      caption: '🔐 *WhatsApp Credentials Backup*\n\nThis file is needed for Heroku deployment. Keep it safe and do not share it with anyone.'
    });
    
    LOGGER.info('Credentials backup sent successfully');
    
    // Also backup the session files that are crucial for reconnection
    const sessionFiles = fs.readdirSync(AUTH_FOLDER).filter(file => file.startsWith('session-'));
    if (sessionFiles.length > 0) {
      // Create a temporary zip file with all session files
      const AdmZip = require('adm-zip');
      const zip = new AdmZip();
      
      for (const file of sessionFiles) {
        const filePath = path.join(AUTH_FOLDER, file);
        zip.addLocalFile(filePath);
      }
      
      // Generate zip buffer
      const zipBuffer = zip.toBuffer();
      
      // Send the session backup
      await sock.sendMessage(ownJid, {
        document: zipBuffer,
        fileName: 'session_backup.zip',
        mimetype: 'application/zip',
        caption: '📁 *WhatsApp Session Backup*\n\nAdditional session files for complete restoration.'
      });
      
      LOGGER.info('Session backup sent successfully');
    }
    
    return true;
  } catch (error) {
    LOGGER.error('Error sending credentials backup:', error);
    return false;
  }
}


// Set up message handler with enhanced reliability
function setupMessageHandler() {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    
    LOGGER.info(`Received message event of type: ${type} with ${messages.length} messages`);
    
    for (const message of messages) {
      try {
        // Check if message is valid
        if (!message.message) {
          LOGGER.info('Received message without content, skipping');
          continue;
        }
        
        // Skip non-command messages from self to avoid unnecessary processing
        if (message.key.fromMe) {
          const messageText = message.message?.conversation || 
                             message.message?.extendedTextMessage?.text || 
                             message.message?.imageMessage?.caption || '';
          
          if (!messageText.startsWith('!')) {
            LOGGER.info('Skipping non-command message from self');
            continue;
          }
          // Only process our own commands
          LOGGER.info('Processing command from self');
        }
        
        // Extract JID and message content with safer extraction
        const remoteJid = message.key.remoteJid;
        if (!remoteJid) {
          LOGGER.warn('Message missing remoteJid, skipping');
          continue;
        }
        
        // Track message receipt for analytics
        LOGGER.debug(`Message received from ${remoteJid.replace(/@.+/, '@...')} with ID: ${message.key.id}`);
        
        // Send read receipt to improve user experience
        await sock.readMessages([message.key]);
        
        // Safely extract message text
        const messageText = message.message?.conversation || 
                           message.message?.extendedTextMessage?.text || 
                           message.message?.imageMessage?.caption ||
                           '';
                        
        // Log incoming message with safe JID formatting
        const formattedJid = remoteJid.replace(/@.+/, '@...');
        LOGGER.info(`New message from ${formattedJid}: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`);
        
        // Handle commands
        if (messageText.startsWith('!') ) {
          const command = messageText.slice(1).trim().split(' ')[0].toLowerCase();
          const args = messageText.slice(1).trim().split(' ').slice(1);
          
          LOGGER.info(`Processing command: ${command} with args: ${args.join(' ')}`);
          
          // First try to process command through command modules
          try {
            // Check if command exists in loaded modules
            if (Object.keys(cachedCommands).length > 0) {
              const commandHandled = await processModuleCommand(sock, message, command, args);
              
              // If the command was handled by modules, continue to next message
              if (commandHandled) {
                LOGGER.info(`Command ${command} was handled by command modules`);
                continue;
              }
            }
            
            // If command modules didn't handle it, use built-in commands
            LOGGER.info(`Command ${command} not found in modules, using built-in commands`);
            
            // Basic command handler for built-in commands
            switch(command) {
              case 'ping':
                // Show typing indicator and send response
                await showTypingIndicator(sock, remoteJid, 1000);
                await safeSendText(sock, remoteJid, 'Pong! 🏓 Bot is working properly.');
                LOGGER.info('Responded to ping command');
                break;
                
              case 'help':
                // Show typing indicator for a longer help message
                await showTypingIndicator(sock, remoteJid, 2000);
                
                // Get command count from modules
                const totalModuleCommands = Object.keys(cachedCommands).length;
                const moduleCommandsInfo = totalModuleCommands > 0 
                  ? `\n\n📚 *${totalModuleCommands} Additional Commands*\nType !help <category> to see more commands.` 
                  : '';
                
                // Send help message
                await safeSendMessage(sock, remoteJid, { 
                  text: `📋 *BLACKSKY-MD Commands*\n\n` +
                        `!ping - Check if bot is online\n` +
                        `!info - Show bot information\n` +
                        `!help - Show this help message\n` +
                        `!test - Test the bot's response\n` +
                        `!backup - Create credentials backup for Heroku deployment${moduleCommandsInfo}`
                });
                
                LOGGER.info('Responded to help command');
                break;
                
              case 'info':
                // Show typing indicator for info message (takes a bit to calculate)
                await showTypingIndicator(sock, remoteJid, 1500);
                
                // Calculate uptime for display
                const uptime = process.uptime();
                const uptimeStr = Math.floor(uptime / 3600) + 'h ' + 
                                  Math.floor((uptime % 3600) / 60) + 'm ' + 
                                  Math.floor(uptime % 60) + 's';
                
                // Get module stats
                const moduleCount = Object.keys(commandModules).length;
                const commandCount = Object.keys(cachedCommands).length;
                
                // Send info message
                await safeSendMessage(sock, remoteJid, { 
                  text: `🤖 *Bot Information*\n\n` +
                        `• *Name:* BLACKSKY-MD\n` +
                        `• *Status:* Online\n` +
                        `• *Uptime:* ${uptimeStr}\n` +
                        `• *Version:* ${VERSION}\n` +
                        `• *Connection:* Safari\n` +
                        `• *Environment:* ${IS_CLOUD_ENV ? 'Cloud' : 'Local'}\n` +
                        `• *Connected:* ${new Date(Date.now()).toLocaleString()}\n` +
                        `• *User ID:* ${sock.user.id.split('@')[0]}\n` +
                        `• *Heroku Ready:* ✅\n` +
                        `• *Modules Loaded:* ${moduleCount}\n` +
                        `• *Commands Available:* ${commandCount + 5}`
                });
                
                LOGGER.info('Responded to info command');
                break;
                
              case 'test':
                // Show typing indicator
                await showTypingIndicator(sock, remoteJid, 800);
                
                // Send test message
                await safeSendText(sock, remoteJid, '✅ Test successful! The bot is working correctly.');
                LOGGER.info('Responded to test command');
                break;
                
              case 'modules':
                // Show typing indicator
                await showTypingIndicator(sock, remoteJid, 1000);
                
                // Generate list of loaded modules
                const modules = Object.keys(commandModules);
                if (modules.length > 0) {
                  const moduleList = modules.map(m => `• ${m}`).join('\n');
                  await safeSendText(sock, remoteJid, `📚 *Loaded Modules (${modules.length})*\n\n${moduleList}`);
                } else {
                  await safeSendText(sock, remoteJid, '❌ No command modules loaded.');
                }
                LOGGER.info('Responded to modules command');
                break;
                
              case 'backup':
                LOGGER.info('Manual backup requested by user');
                
                // Show typing indicator while processing request
                await showTypingIndicator(sock, remoteJid, 1000);
                
                // Initial backup message with status
                await safeSendText(sock, remoteJid, '🔄 Creating a credentials backup for Heroku deployment...');
                
                // Check if user is requesting backup to their own number
                const isOwn = remoteJid === sock.user.id;
                
                if (isOwn) {
                  // Show typing indicator for processing backup
                  await showTypingIndicator(sock, remoteJid, 2000);
                  
                  // Send backup directly
                  const backupSuccess = await sendCredsBackup(sock);
                  if (backupSuccess) {
                    await safeSendText(sock, remoteJid, '✅ Credentials backup complete! You can use these files for Heroku deployment.');
                  } else {
                    await safeSendText(sock, remoteJid, '❌ Error creating credentials backup. Please try again later or check logs.');
                  }
                } else {
                  // Send to user's number and owner number
                  try {
                    // Notify the owner about the request
                    await showTypingIndicator(sock, sock.user.id, 1000);
                    await safeSendText(sock, sock.user.id, `🔔 User ${remoteJid.replace(/@.+/, '')} requested a credentials backup.`);
                    
                    // Process backup request
                    const backupSuccess = await sendCredsBackup(sock);
                    
                    // Notify the user
                    await safeSendText(sock, remoteJid, '✅ Credentials backup sent to bot owner. Only the bot owner can receive the actual credential files for security reasons.');
                  } catch (backupErr) {
                    LOGGER.error('Error in manual backup process:', backupErr);
                    await safeSendText(sock, remoteJid, '❌ Error creating credentials backup. Please try again later.');
                  }
                }
                break;
                
              default:
                // Check for command lists from modules
                if (command === 'cmds' || command === 'commands') {
                  // Show list of all available commands from modules
                  await showTypingIndicator(sock, remoteJid, 1000);
                  
                  const commandsList = Object.keys(cachedCommands).sort().join(', ');
                  await safeSendText(sock, remoteJid, `📋 *Available Commands*\n\n${commandsList || 'No commands loaded.'}`);
                  LOGGER.info('Responded to commands list request');
                } else {
                  // Show typing indicator for unknown command
                  await showTypingIndicator(sock, remoteJid, 500);
                  
                  // Send unknown command message
                  await safeSendText(sock, remoteJid, `⚠️ Unknown command: ${command}\nType !help to see available commands.`);
                  LOGGER.info(`Responded to unknown command: ${command}`);
                }
                break;
            }
          } catch (cmdError) {
            LOGGER.error(`Error processing command ${command}:`, cmdError);
            
            // Send error message to user
            try {
              await safeSendText(sock, remoteJid, `❌ Error processing command: ${cmdError.message}`);
            } catch (notifyErr) {
              LOGGER.error('Error sending error notification:', notifyErr);
            }
          }
        }
      } catch (err) {
        LOGGER.error(`Error processing message: ${err.message}`);
        // Try to notify the user about the error if possible
        try {
          if (message.key.remoteJid) {
            await sock.sendMessage(message.key.remoteJid, { 
              text: '❌ Sorry, there was an error processing your message. Please try again.' 
            });
          }
        } catch (notifyErr) {
          LOGGER.error(`Error sending error notification: ${notifyErr.message}`);
        }
      }
    }
  });
  
  // Also register for group events
  sock.ev.on('groups.update', async (updates) => {
    LOGGER.info(`Received group update: ${JSON.stringify(updates)}`);
  });
  
  sock.ev.on('group-participants.update', async (update) => {
    LOGGER.info(`Group participants update in ${update.id}: ${update.action} for ${update.participants.length} participants`);
  });
}

// Command module storage
const commandModules = {};
const cachedCommands = {};

// Load all command modules from the src/commands directory
async function loadCommandModules() {
  try {
    const commandsPath = path.join(process.cwd(), 'src', 'commands');
    
    // Check if directory exists
    if (!fs.existsSync(commandsPath)) {
      LOGGER.warn(`Commands directory not found: ${commandsPath}`);
      return false;
    }
    
    // Function to recursively get all command files
    async function getAllCommandFiles(dir) {
      const entries = await fsPromises.readdir(dir, { withFileTypes: true });
      const files = await Promise.all(entries.map(async entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return getAllCommandFiles(fullPath);
        } else if (entry.name.endsWith('.js') && entry.name !== 'index.js') {
          return fullPath;
        }
        return [];
      }));
      return files.flat();
    }
    
    // Get all command files
    const commandFiles = await getAllCommandFiles(commandsPath);
    LOGGER.info(`Found ${commandFiles.length} command files to load`);
    
    // Load each command file
    for (const filePath of commandFiles) {
      try {
        // Clear cache to ensure fresh module
        delete require.cache[require.resolve(filePath)];
        
        // Load the module
        const module = require(filePath);
        
        // Skip invalid modules
        if (!module || typeof module !== 'object') {
          LOGGER.warn(`Invalid module format in ${filePath}`);
          continue;
        }
        
        // Determine module name based on file path
        const relativePath = path.relative(commandsPath, filePath);
        const moduleName = relativePath.replace(/\.js$/, '');
        
        // Check if module has .commands property or is direct command map
        const commands = module.commands || module;
        
        // Skip modules without commands
        if (!commands || typeof commands !== 'object') {
          LOGGER.warn(`No commands found in ${filePath}`);
          continue;
        }
        
        // Store commands in our registry
        commandModules[moduleName] = module;
        
        // Cache flattened command list for quick lookup
        Object.keys(commands).forEach(cmdName => {
          const handler = commands[cmdName];
          
          // Only add valid handlers
          if (typeof handler === 'function') {
            // Store with both normal and prefixed versions to handle different command styles
            cachedCommands[cmdName.toLowerCase()] = {
              handler,
              module: moduleName,
              name: cmdName 
            };
          }
        });
        
        // Initialize module if it has init function
        if (typeof module.init === 'function') {
          try {
            await module.init();
            LOGGER.info(`Initialized module: ${moduleName}`);
          } catch (initError) {
            LOGGER.error(`Error initializing module ${moduleName}:`, initError);
          }
        }
        
        LOGGER.info(`Loaded module ${moduleName} with ${Object.keys(commands).length} commands`);
      } catch (moduleError) {
        LOGGER.error(`Error loading module ${filePath}:`, moduleError);
      }
    }
    
    const totalCommands = Object.keys(cachedCommands).length;
    if (totalCommands > 0) {
      LOGGER.info(`Successfully loaded ${totalCommands} commands from ${Object.keys(commandModules).length} modules`);
      return true;
    } else {
      LOGGER.warn('No commands were loaded!');
      return false;
    }
    } catch (error) {
      LOGGER.error('Error loading command modules:', error);
      return false;
    }
  }

  // Safely send a message with proper JID validation
  async function safeSendMessage(sock, jid, content) {
    try {
      if (!jid || typeof jid !== 'string') {
        LOGGER.error('Invalid JID provided to safeSendMessage:', jid);
        return null;
      }
      
      return await sock.sendMessage(jid, content);
    } catch (error) {
      LOGGER.error(`Error in safeSendMessage to ${jid?.replace?.(/@.+/, '@...')}:`, error.message);
      return null;
    }
  }

  // Safely send text with proper JID validation
  async function safeSendText(sock, jid, text) {
    return safeSendMessage(sock, jid, { text });
  }

  // Process command from command modules
  async function processModuleCommand(sock, message, command, args) {
    try {
      const commandData = cachedCommands[command.toLowerCase()];
      if (!commandData) {
        // Command not found in modules
        return false;
      }
      
      const { handler, module: moduleName, name: cmdName } = commandData;
      LOGGER.info(`Executing command ${cmdName} from module ${moduleName}`);
      
      // Execute the command handler
      await handler(sock, message, args);
      return true;
    } catch (error) {
      LOGGER.error(`Error executing command ${command}:`, error);
      
      // Try to send error message
      try {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `❌ Error executing command: ${error.message}`);
      } catch (notifyError) {
        LOGGER.error('Error sending error notification:', notifyError);
      }
      
      return true; // Mark as handled to prevent fallback
    }
  }

  // Start connection
  async function startConnection() {
    try {
      // Update connection state
      connectionState = 'connecting';
      LOGGER.info(`Starting WhatsApp connection (Attempt ${connectionRetries + 1}/${MAX_RETRIES})...`);
      
      // Get auth state
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
      
      // Get Baileys version
      const { version } = await fetchLatestBaileysVersion();
      LOGGER.info(`Using Baileys version: ${version.join('.')}`);
      
      // Update socket creation with optimized Safari settings
      sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true, // Fallback QR display
        browser: [generateDeviceId(), ...SAFARI_FINGERPRINT.browser],
        userAgent: SAFARI_FINGERPRINT.userAgent,
        connectTimeoutMs: 60000,
        qrTimeout: QR_TIMEOUT,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: false,
        customUploadHosts: ['media-sin1-1.cdn.whatsapp.net'], // Use Singapore server
        syncFullHistory: false,
        markOnlineOnConnect: false,
        logger: LOGGER,
        // Cloud environment optimizations
        retryRequestDelayMs: IS_CLOUD_ENV ? 5000 : 2000,
        fireAndRetry: IS_CLOUD_ENV,
        maxRetries: IS_CLOUD_ENV ? 5 : 3,
        throwErrorOnTosBlock: true, // Detect ToS violations early
        agent: undefined, // Let system handle proxy
        fetchAgent: undefined, // Let system handle fetch
        msgRetryCounterCache: {
          setKey: () => { }, // No-op to avoid Redis requirements
          getKey: () => undefined,
        }
      });
      
      // Handle connection updates
      sock.ev.on('connection.update', handleConnectionUpdate);
      
      // Save credentials when updated
      sock.ev.on('creds.update', saveCreds);
      setupMessageHandler();
      // Load command modules
      LOGGER.info('Loading command modules...');
      await loadCommandModules();
      
    } catch (err) {
      LOGGER.error('Error in connection:', err);
      connectionState = 'error';
      
      if (connectionRetries < MAX_RETRIES) {
        connectionRetries++;
        const delay = Math.min(Math.pow(2, connectionRetries) * 1000, 10000);
        LOGGER.info(`Retrying after error in ${delay/1000}s (Attempt ${connectionRetries}/${MAX_RETRIES})`);
        setTimeout(startConnection, delay);
      } else {
        LOGGER.error('Max retries reached after errors');
        process.exit(1); // Force restart in cloud environment
      }
    }
  }

  // Initialize and start
  initializeConnection().then(() => {
    startConnection();
  }).catch(err => {
    LOGGER.error('Failed to initialize:', err);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    LOGGER.info('Shutting down...');
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (cleanupTimer) clearInterval(cleanupTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (sock) {
      sock.end();
    }
    server.close(() => {
      LOGGER.info('Server closed');
      process.exit(0);
    });
  });

  // Export connection state for monitoring
  module.exports = {
    getConnectionState: () => ({
      state: connectionState,
      retries: connectionRetries,
      lastError: lastDisconnectCode,
      qrGenerated,
      hasQR: !!lastQRCode,
      uptime: lastConnectTime ? Math.floor((Date.now() - lastConnectTime) / 1000) : 0
    })
  };