/**
 * WhatsApp Bot for Heroku Deployment
 * Optimized for 24/7 connection reliability in Heroku cloud environment
 * Version: 1.0.0
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const express = require('express');
const pino = require('pino');
const qrcode = require('qrcode');
const http = require('http');

// Configuration
const PORT = process.env.PORT || 8000;
const AUTH_FOLDER = './auth_info_heroku';
const MAX_RETRIES = 10;
const RECONNECT_INTERVAL = 5000;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const ADMIN_NUMBER = process.env.ADMIN_NUMBER || '4915561048015';
const ENABLE_COMMANDS = process.env.ENABLE_COMMANDS !== 'false';

// Setup Express server
const app = express();
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Create server
const server = http.createServer(app);

// Logger configuration
const logger = pino({
  level: LOG_LEVEL,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'hostname,pid'
    }
  }
});

// Connection state
let sock = null;
let connectionState = 'disconnected';
let qrCode = null;
let lastDisconnectReason = null;
let connectionRetryCount = 0;
let lastConnected = null;
let startTime = Date.now();
let messageCount = 0;
let autoReconnectHandler = null;

// Ensure directories exist
if (!fs.existsSync(AUTH_FOLDER)) {
  fs.mkdirSync(AUTH_FOLDER, { recursive: true });
  logger.info(`Created auth folder: ${AUTH_FOLDER}`);
}

if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
  logger.info('Created public folder for web assets');
}

// Initialize stats tracking
const stats = {
  messagesReceived: 0,
  messagesSent: 0,
  commandsProcessed: 0,
  errors: [],
  reconnects: 0,
  lastQrTimestamp: null
};

/**
 * Format uptime duration into readable string
 */
function formatUptime() {
  const totalSeconds = Math.floor((Date.now() - startTime) / 1000);
  
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  let result = '';
  if (days > 0) result += `${days}d `;
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0) result += `${minutes}m `;
  result += `${seconds}s`;
  
  return result;
}

/**
 * Get a random device ID
 */
function getDeviceId() {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return `WhatsApp-Heroku-${Date.now()}-${result}`;
}

/**
 * Connect to WhatsApp with retry logic
 */
async function connectToWhatsApp() {
  // Clear any existing reconnect timers
  if (autoReconnectHandler) {
    clearTimeout(autoReconnectHandler);
    autoReconnectHandler = null;
  }
  
  // Set status to connecting
  connectionState = 'connecting';
  
  try {
    logger.info(`Starting WhatsApp connection (Attempt ${connectionRetryCount + 1}/${MAX_RETRIES})`);
    
    // Load auth state
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    
    // Create a WhatsApp socket
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: [getDeviceId(), 'Safari', '17.0'],
      logger,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      qrTimeout: 40000
    });
    
    // Listen for connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // Handle QR code
      if (qr) {
        qrCode = qr;
        stats.lastQrTimestamp = Date.now();
        logger.info('New QR code generated');
        
        // Generate QR for web display
        try {
          const qrImage = await qrcode.toDataURL(qr, { 
            errorCorrectionLevel: 'H',
            margin: 1,
            scale: 8,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });
          
          // Save QR code to public directory
          fs.writeFileSync('public/qr.png', qrImage.split(',')[1], 'base64');
          logger.info('QR code saved to public directory');
        } catch (err) {
          logger.error('Error generating QR image:', err);
        }
      }
      
      // Handle successful connection
      if (connection === 'open') {
        connectionState = 'connected';
        lastConnected = new Date();
        qrCode = null;
        connectionRetryCount = 0;
        
        logger.info('Successfully connected to WhatsApp!');
        
        // Send welcome message to admin
        const adminJid = `${ADMIN_NUMBER}@s.whatsapp.net`;
        try {
          await sock.sendMessage(adminJid, {
            text: `🤖 *WhatsApp Bot Connected*\n\n` +
                  `*Heroku Deployment*\n` +
                  `*Time:* ${new Date().toISOString()}\n` +
                  `*Version:* 1.0.0\n\n` +
                  `Send !help for available commands`
          });
          logger.info(`Welcome message sent to admin: ${ADMIN_NUMBER}`);
        } catch (err) {
          logger.warn(`Couldn't send welcome message to admin: ${err.message}`);
        }
      }
      
      // Handle connection close
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || 'Unknown';
        
        connectionState = 'disconnected';
        lastDisconnectReason = `Disconnected: ${reason} (Code: ${statusCode})`;
        logger.info(lastDisconnectReason);
        
        // If logged out, clear auth data
        if (statusCode === DisconnectReason.loggedOut) {
          logger.warn('Logged out from WhatsApp, clearing auth data...');
          
          // Backup auth data first
          const timestamp = Date.now();
          const backupDir = `${AUTH_FOLDER}_backup_${timestamp}`;
          
          if (fs.existsSync(AUTH_FOLDER)) {
            try {
              fs.cpSync(AUTH_FOLDER, backupDir, { recursive: true });
              logger.info(`Auth data backed up to ${backupDir}`);
              
              // Now clear the auth folder
              fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
              fs.mkdirSync(AUTH_FOLDER, { recursive: true });
              logger.info('Auth data cleared successfully');
            } catch (err) {
              logger.error('Error backing up auth data:', err);
            }
          }
        }
        
        // Reconnect logic
        stats.reconnects++;
        
        if (connectionRetryCount < MAX_RETRIES) {
          connectionRetryCount++;
          
          const retryDelay = Math.min(RECONNECT_INTERVAL * Math.pow(1.5, connectionRetryCount), 60000);
          logger.info(`Reconnecting in ${retryDelay / 1000} seconds...`);
          
          autoReconnectHandler = setTimeout(connectToWhatsApp, retryDelay);
        } else {
          logger.error('Maximum retry attempts reached. Please restart the application.');
        }
      }
    });
    
    // Listen for credential updates
    sock.ev.on('creds.update', saveCreds);
    
    // Handle incoming messages
    sock.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;
      
      for (const msg of m.messages) {
        if (!msg.key.fromMe) {
          stats.messagesReceived++;
          
          // Process message if commands are enabled
          if (ENABLE_COMMANDS) {
            await handleIncomingMessage(sock, msg);
          }
        }
      }
    });
    
    // Return socket
    return sock;
  } catch (err) {
    logger.error('Connection error:', err);
    connectionState = 'error';
    lastDisconnectReason = err.message;
    
    stats.errors.push({
      timestamp: new Date().toISOString(),
      error: err.message,
      type: 'CONNECTION'
    });
    
    // Reconnect logic
    if (connectionRetryCount < MAX_RETRIES) {
      connectionRetryCount++;
      
      const retryDelay = Math.min(RECONNECT_INTERVAL * Math.pow(1.5, connectionRetryCount), 60000);
      logger.info(`Reconnecting in ${retryDelay / 1000} seconds...`);
      
      autoReconnectHandler = setTimeout(connectToWhatsApp, retryDelay);
    } else {
      logger.error('Maximum retry attempts reached. Please restart the application.');
    }
    
    return null;
  }
}

/**
 * Handle incoming messages
 */
async function handleIncomingMessage(sock, msg) {
  try {
    // Check if message has content
    if (!msg.message) return;
    
    // Get message content
    const msgType = Object.keys(msg.message)[0];
    const body = msgType === 'conversation' ? 
      msg.message.conversation : 
      (msgType === 'extendedTextMessage' && msg.message.extendedTextMessage.text) ? 
        msg.message.extendedTextMessage.text : '';
    
    // Skip processing if no text content
    if (!body) return;
    
    // Get sender information
    const sender = msg.key.remoteJid;
    const isGroup = sender.endsWith('@g.us');
    
    // Process commands (starting with !)
    if (body.startsWith('!')) {
      const args = body.slice(1).trim().split(/\s+/);
      const command = args.shift().toLowerCase();
      
      logger.info(`Command received: ${command} from ${sender}`);
      stats.commandsProcessed++;
      
      // Process commands
      switch (command) {
        case 'help':
          await sock.sendMessage(sender, {
            text: `*Available Commands*\n\n` +
                  `!help - Show this help message\n` +
                  `!ping - Check bot responsiveness\n` +
                  `!status - Show bot status\n` +
                  `!uptime - Show bot uptime\n`
          });
          stats.messagesSent++;
          break;
          
        case 'ping':
          await sock.sendMessage(sender, { text: 'Pong! 🏓' });
          stats.messagesSent++;
          break;
          
        case 'status':
          await sock.sendMessage(sender, {
            text: `*Bot Status*\n\n` +
                  `*Connection:* ${connectionState}\n` +
                  `*Uptime:* ${formatUptime()}\n` +
                  `*Messages Received:* ${stats.messagesReceived}\n` +
                  `*Messages Sent:* ${stats.messagesSent}\n` +
                  `*Commands Processed:* ${stats.commandsProcessed}\n` +
                  `*Reconnects:* ${stats.reconnects}\n` +
                  `*Last Connected:* ${lastConnected ? lastConnected.toISOString() : 'Never'}\n`
          });
          stats.messagesSent++;
          break;
          
        case 'uptime':
          await sock.sendMessage(sender, { 
            text: `🤖 Bot has been running for ${formatUptime()}` 
          });
          stats.messagesSent++;
          break;
          
        default:
          // If the sender is the admin, provide feedback on unknown commands
          if (sender === `${ADMIN_NUMBER}@s.whatsapp.net`) {
            await sock.sendMessage(sender, { 
              text: `Unknown command: ${command}. Type !help for available commands.` 
            });
            stats.messagesSent++;
          }
          break;
      }
    }
  } catch (err) {
    logger.error('Error handling message:', err);
    stats.errors.push({
      timestamp: new Date().toISOString(),
      error: err.message,
      type: 'MESSAGE_HANDLING'
    });
  }
}

// Set up Express routes
app.get('/', (req, res) => {
  res.render('index', {
    status: connectionState,
    qrAvailable: stats.lastQrTimestamp && (Date.now() - stats.lastQrTimestamp < 60000),
    uptime: formatUptime(),
    stats: stats,
    lastError: lastDisconnectReason,
    lastConnected: lastConnected ? lastConnected.toLocaleString() : 'Never'
  });
});

app.get('/status', (req, res) => {
  res.json({
    status: connectionState,
    uptime: formatUptime(),
    qrAvailable: stats.lastQrTimestamp && (Date.now() - stats.lastQrTimestamp < 60000),
    lastError: lastDisconnectReason,
    stats: {
      messagesReceived: stats.messagesReceived,
      messagesSent: stats.messagesSent,
      commandsProcessed: stats.commandsProcessed,
      reconnects: stats.reconnects,
      errors: stats.errors.length
    },
    lastConnected: lastConnected
  });
});

// Start server
server.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  
  // Start WhatsApp connection
  connectToWhatsApp().catch(err => {
    logger.error('Failed to start WhatsApp connection:', err);
  });
});

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal, shutting down gracefully');
  if (sock) {
    logger.info('Closing WhatsApp connection...');
    sock.end(new Error('Server shutting down'));
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal, shutting down gracefully');
  if (sock) {
    logger.info('Closing WhatsApp connection...');
    sock.end(new Error('Server shutting down'));
  }
  process.exit(0);
});

// Create views directory and template file if they don't exist
if (!fs.existsSync('views')) {
  fs.mkdirSync('views', { recursive: true });
  logger.info('Created views folder for EJS templates');
}

// Create index.ejs template file if it doesn't exist
const indexEjsPath = path.join('views', 'index.ejs');
if (!fs.existsSync(indexEjsPath)) {
  const indexContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Bot Status</title>
    <meta http-equiv="refresh" content="30">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
        }
        .header h1 {
            margin: 0;
            color: #075E54;
        }
        .status-box {
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-weight: bold;
            text-align: center;
        }
        .connected {
            background-color: #e2f7e2;
            border-left: 5px solid #25D366;
            color: #1a8d45;
        }
        .connecting {
            background-color: #fff9e2;
            border-left: 5px solid #FFC107;
            color: #9e7400;
        }
        .disconnected, .error {
            background-color: #ffe2e2;
            border-left: 5px solid #FF5252;
            color: #c41f1f;
        }
        .qr-container {
            text-align: center;
            margin: 20px 0;
            padding: 20px;
            border: 2px dashed #ccc;
            border-radius: 8px;
        }
        .qr-container img {
            max-width: 100%;
            height: auto;
        }
        .stat-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat-card {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .stat-card .label {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 5px;
        }
        .stat-card .value {
            font-size: 1.4em;
            font-weight: bold;
            color: #075E54;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 0.8em;
            color: #888;
        }
        .refresh-note {
            text-align: center;
            margin: 20px 0;
            font-size: 0.9em;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>WhatsApp Bot Status</h1>
            <p>Heroku Deployment</p>
        </div>
        
        <div class="status-box <%= status %>">
            <% if (status === 'connected') { %>
                ✅ Connected to WhatsApp
            <% } else if (status === 'connecting') { %>
                🔄 Connecting to WhatsApp...
            <% } else if (status === 'disconnected') { %>
                ❌ Disconnected from WhatsApp
            <% } else if (status === 'error') { %>
                ⚠️ Error: <%= lastError %>
            <% } %>
        </div>
        
        <% if (qrAvailable) { %>
            <div class="qr-container">
                <h3>Scan QR Code</h3>
                <p>This QR code will expire in 60 seconds</p>
                <img src="/qr.png?t=<%= Date.now() %>" alt="WhatsApp QR Code">
            </div>
        <% } %>
        
        <div class="stat-grid">
            <div class="stat-card">
                <div class="label">Uptime</div>
                <div class="value"><%= uptime %></div>
            </div>
            
            <div class="stat-card">
                <div class="label">Messages Received</div>
                <div class="value"><%= stats.messagesReceived %></div>
            </div>
            
            <div class="stat-card">
                <div class="label">Messages Sent</div>
                <div class="value"><%= stats.messagesSent %></div>
            </div>
            
            <div class="stat-card">
                <div class="label">Commands Processed</div>
                <div class="value"><%= stats.commandsProcessed %></div>
            </div>
            
            <div class="stat-card">
                <div class="label">Reconnections</div>
                <div class="value"><%= stats.reconnects %></div>
            </div>
            
            <div class="stat-card">
                <div class="label">Last Connected</div>
                <div class="value" style="font-size: 1em;"><%= lastConnected %></div>
            </div>
        </div>
        
        <% if (lastError) { %>
            <div style="margin-top: 20px; padding: 15px; background-color: #fff9f9; border-radius: 8px;">
                <strong>Last Error:</strong> <%= lastError %>
            </div>
        <% } %>
        
        <div class="refresh-note">
            This page refreshes automatically every 30 seconds
        </div>
        
        <div class="footer">
            WhatsApp Bot Dashboard • Heroku Deployment • Version 1.0.0
        </div>
    </div>
</body>
</html>`;

  fs.writeFileSync(indexEjsPath, indexContent);
  logger.info('Created index.ejs template file');
}

module.exports = { app, server };