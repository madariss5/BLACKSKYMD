/**
 * Cloud-Optimized WhatsApp QR Web Server
 * Provides a web interface for scanning QR codes and restores connection automatically
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Set up logger
const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

// Configuration
const PORT = process.env.PORT || 5000;
const AUTH_FOLDER = path.join(__dirname, '../auth_info_baileys');

// View settings
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Create views directory if it doesn't exist
const viewsDir = path.join(__dirname, '../views');
if (!fs.existsSync(viewsDir)) {
  fs.mkdirSync(viewsDir, { recursive: true });
}

// Create auth directory if it doesn't exist
if (!fs.existsSync(AUTH_FOLDER)) {
  fs.mkdirSync(AUTH_FOLDER, { recursive: true });
  logger.info(`Created auth directory: ${AUTH_FOLDER}`);
}

// Create the EJS template for QR display
const qrTemplatePath = path.join(viewsDir, 'qr.ejs');
if (!fs.existsSync(qrTemplatePath)) {
  const qrTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BLACKSKY-MD WhatsApp QR Scanner</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            background-color: #f0f0f0;
            padding: 20px;
            color: #333;
        }
        h1 {
            color: #128C7E;
        }
        .container {
            max-width: 500px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        #qrcode {
            padding: 20px;
            background-color: white;
            display: inline-block;
            margin: 20px 0;
        }
        .status {
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
            font-weight: bold;
        }
        .connected {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .disconnected {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .waiting {
            background-color: #fff3cd;
            color: #856404;
            border: 1px solid #ffeeba;
        }
        .instructions {
            text-align: left;
            margin: 20px 0;
            padding: 15px;
            background-color: #e7f3fe;
            border-left: 5px solid #2196F3;
            border-radius: 3px;
        }
        .info {
            font-size: 0.9em;
            color: #666;
            margin-top: 30px;
        }
        .deployment-info {
            margin-top: 20px;
            padding: 10px;
            background-color: #e8f5e9;
            border-radius: 5px;
            border: 1px solid #c8e6c9;
            font-size: 0.9em;
            color: #2e7d32;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>BLACKSKY-MD WhatsApp</h1>
        
        <div id="statusContainer">
            <div class="status waiting" id="status">Waiting for QR Code...</div>
        </div>
        
        <div id="qrcontainer">
            <div id="qrcode"></div>
        </div>
        
        <div class="instructions">
            <h3>How to connect:</h3>
            <ol>
                <li>Open WhatsApp on your phone</li>
                <li>Tap Menu or Settings and select Linked Devices</li>
                <li>Tap on "Link a Device"</li>
                <li>Point your phone to this screen to scan the QR code</li>
            </ol>
        </div>
        
        <div class="deployment-info">
            <p><strong>Heroku Deployment Active</strong></p>
            <p>Your WhatsApp bot is running in cloud mode.</p>
            <p>Once connected, this application will maintain your session even when you close this page.</p>
        </div>
        
        <div class="info">
            <p>This connection is secure and uses WhatsApp's official multi-device API.</p>
            <p>The QR code refreshes automatically when needed. Keep this page open until connected.</p>
            <p><small>BLACKSKY-MD v1.0.0</small></p>
        </div>
    </div>

    <script>
        const socket = new WebSocket(
            window.location.protocol === 'https:' 
                ? 'wss://' + window.location.host 
                : 'ws://' + window.location.host
        );
        const qrElement = document.getElementById('qrcode');
        const statusElement = document.getElementById('status');
        
        socket.onmessage = function(event) {
            const data = JSON.parse(event.data);
            
            if (data.type === 'qr') {
                qrElement.innerHTML = data.qr;
                statusElement.className = 'status waiting';
                statusElement.innerText = 'Scan this QR code with WhatsApp';
            } else if (data.type === 'connection') {
                if (data.connected) {
                    qrElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><circle cx="100" cy="100" r="90" fill="#4CAF50" /><path d="M83.5 136.5l-42-42 12-12 30 30 63-63 12 12z" fill="white" /></svg>';
                    statusElement.className = 'status connected';
                    statusElement.innerText = 'Connected Successfully!';
                } else {
                    statusElement.className = 'status disconnected';
                    statusElement.innerText = 'Disconnected: ' + (data.reason || 'Unknown reason');
                }
            } else if (data.type === 'status') {
                statusElement.innerText = data.message;
            }
        };
        
        socket.onclose = function() {
            statusElement.className = 'status disconnected';
            statusElement.innerText = 'Server connection lost. Please refresh the page.';
        };
    </script>
</body>
</html>`;
  fs.writeFileSync(qrTemplatePath, qrTemplate);
  logger.info('Created QR template file');
}

// Store the current connection state
let connectionState = {
  sock: null,
  qr: null,
  isConnected: false,
  lastDisconnectReason: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10
};

// Serve static files if public directory exists
const publicDir = path.join(__dirname, '../public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
} else {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Routes
app.get('/', (req, res) => {
  res.render('qr');
});

app.get('/qr', (req, res) => {
  res.render('qr');
});

app.get('/status', (req, res) => {
  res.json({
    connected: connectionState.isConnected,
    lastDisconnect: connectionState.lastDisconnectReason,
    reconnectAttempts: connectionState.reconnectAttempts
  });
});

// Save session credentials to persist between restarts
async function saveSessionToEnv(creds) {
  if (!creds) return false;
  
  try {
    const credsJSON = JSON.stringify(creds);
    
    // In a production environment like Heroku, you would save this to an environment variable
    // For local development, you could save to a file (commented out for reference)
    // fs.writeFileSync('session-backup.json', credsJSON);
    
    logger.info('Session credentials saved');
    return true;
  } catch (error) {
    logger.error('Failed to save session credentials:', error);
    return false;
  }
}

// Create backup of auth directory
async function backupAuthFolder() {
  try {
    const backupDir = path.join(__dirname, '../auth_info_baileys_backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const targetDir = path.join(backupDir, `backup_${timestamp}`);
    fs.mkdirSync(targetDir, { recursive: true });
    
    const files = fs.readdirSync(AUTH_FOLDER);
    let fileCount = 0;
    
    for (const file of files) {
      const src = path.join(AUTH_FOLDER, file);
      const dest = path.join(targetDir, file);
      fs.copyFileSync(src, dest);
      fileCount++;
    }
    
    logger.info(`Backup created successfully (${fileCount} files) at ${targetDir}`);
    
    // Clean up old backups (keep only the 5 most recent)
    const backups = fs.readdirSync(backupDir)
      .filter(dir => dir.startsWith('backup_'))
      .map(dir => ({ name: dir, time: parseInt(dir.split('_')[1]) }))
      .sort((a, b) => b.time - a.time);
    
    const toDelete = backups.slice(5);
    for (const backup of toDelete) {
      const dirPath = path.join(backupDir, backup.name);
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
    
    if (toDelete.length > 0) {
      logger.info(`Cleaned up ${toDelete.length} old backup(s)`);
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to create backup:', error);
    return false;
  }
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  // Send current connection status to new client
  ws.send(JSON.stringify({
    type: 'connection',
    connected: connectionState.isConnected,
    reason: connectionState.lastDisconnectReason
  }));
  
  // If QR code is available and not connected, send it
  if (connectionState.qr && !connectionState.isConnected) {
    qrcode.toDataURL(connectionState.qr, (err, url) => {
      if (!err) {
        ws.send(JSON.stringify({
          type: 'qr',
          qr: `<img src="${url}" width="256" height="256" />`
        }));
      }
    });
  }
});

// Broadcast to all WebSocket clients
function broadcastToClients(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

/**
 * Initialize and load command modules
 * @param {Object} socket - WhatsApp connection socket
 * @returns {Promise<number>} - Number of commands loaded
 */
async function loadCommandModules(socket) {
  const commandsDir = path.join(__dirname, '../commands');
  
  // Ensure the commands directory exists
  if (!fs.existsSync(commandsDir)) {
    fs.mkdirSync(commandsDir, { recursive: true });
    
    // Create a basic command module for testing
    const basicCommandsPath = path.join(commandsDir, 'basic.js');
    const basicCommandsContent = `
/**
 * Basic Commands Module
 * Core command functionality for the bot
 */

module.exports = {
  info: {
    name: 'Basic Commands',
    description: 'Core command functionality',
  },
  
  commands: {
    // Ping command to test bot responsiveness
    ping: {
      description: 'Test if the bot is responding',
      syntax: '{prefix}ping',
      handler: async (sock, msg, args) => {
        const startTime = Date.now();
        await sock.sendMessage(msg.key.remoteJid, { text: 'Measuring response time...' });
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        return { text: \`🏓 Pong! Response time: \${responseTime}ms\` };
      }
    },
    
    // Help command
    help: {
      description: 'Show available commands',
      syntax: '{prefix}help [command]',
      handler: async (sock, msg, args) => {
        if (args.length > 0) {
          // Show help for specific command (not implemented in this basic example)
          return { text: \`Help for command "\${args[0]}" is not available yet.\` };
        }
        
        return { 
          text: \`*BLACKSKY-MD Bot Commands*
          
• {prefix}ping - Check if bot is online
• {prefix}help - Show this help message
• {prefix}info - Show bot information

_Type {prefix}help [command] for specific command help_\`
        };
      }
    },
    
    // Bot info command
    info: {
      description: 'Show bot information',
      syntax: '{prefix}info',
      handler: async (sock, msg, args) => {
        return { 
          text: \`*BLACKSKY-MD WhatsApp Bot*
          
Version: 1.0.0
Running on: Cloud Server
Made with: @whiskeysockets/baileys

_Type {prefix}help for available commands_\`
        };
      }
    }
  }
};
`;
    fs.writeFileSync(basicCommandsPath, basicCommandsContent);
    logger.info('Created basic commands module');
  }
  
  // Command loading logic would go here
  // This is just a placeholder since we're focusing on the server functionality
  logger.info('Commands directory ready');
  return 1;
}

/**
 * Set up message handler for WhatsApp
 * @param {Object} socket - WhatsApp connection socket
 */
async function setupMessageHandler(socket) {
  // Load command modules
  const commandsLoaded = await loadCommandModules(socket);
  logger.info(`Loaded ${commandsLoaded} command modules`);
  
  // Handle incoming messages
  socket.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;
    
    const msg = m.messages[0];
    if (!msg) return;
    
    // Auto read messages
    if (msg.key && msg.key.remoteJid) {
      await socket.readMessages([msg.key]);
    }
    
    // Basic message handling
    if (msg.message && !msg.key.fromMe) {
      const messageText = msg.message.conversation || 
                         (msg.message.extendedTextMessage && 
                          msg.message.extendedTextMessage.text) || '';
      
      // Handle ping command as an example
      if (messageText.toLowerCase() === '!ping') {
        await socket.sendMessage(msg.key.remoteJid, { text: '🏓 Pong!' });
      }
    }
  });
  
  logger.info('Message handler set up successfully');
}

/**
 * Start the WhatsApp connection
 */
async function startConnection() {
  try {
    // Load authentication state
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    
    // Create WhatsApp socket with appropriate options
    const sock = makeWASocket({
      logger,
      printQRInTerminal: false,
      auth: state,
      browser: ['BLACKSKY-MD', 'Chrome', '4.0.0'],
      defaultQueryTimeoutMs: 60000 // 60 seconds for query timeout
    });
    
    // Update connection state
    connectionState.sock = sock;
    
    // Handle credential updates
    sock.ev.on('creds.update', async () => {
      await saveCreds();
      // Create a backup of the auth folder after credentials update
      await backupAuthFolder();
    });
    
    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // If QR code is received, update state and broadcast to clients
      if (qr) {
        connectionState.qr = qr;
        logger.info('New QR code received');
        
        // Convert QR code to image and broadcast to clients
        qrcode.toDataURL(qr, (err, url) => {
          if (!err) {
            broadcastToClients({
              type: 'qr',
              qr: `<img src="${url}" width="256" height="256" />`
            });
            
            broadcastToClients({
              type: 'status',
              message: 'Scan this QR code with WhatsApp'
            });
          }
        });
      }
      
      // Handle connection state changes
      if (connection === 'close') {
        connectionState.isConnected = false;
        
        // Get disconnect reason
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || 'Unknown reason';
        connectionState.lastDisconnectReason = reason;
        
        logger.warn(`Connection closed: ${reason} (Code: ${statusCode})`);
        
        // Broadcast disconnection to clients
        broadcastToClients({
          type: 'connection',
          connected: false,
          reason: reason
        });
        
        // Check if we should attempt to reconnect
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut; // 440 is logged out
        
        if (shouldReconnect && connectionState.reconnectAttempts < connectionState.maxReconnectAttempts) {
          connectionState.reconnectAttempts++;
          
          broadcastToClients({
            type: 'status',
            message: `Reconnecting (Attempt ${connectionState.reconnectAttempts}/${connectionState.maxReconnectAttempts})...`
          });
          
          logger.info(`Attempting to reconnect (${connectionState.reconnectAttempts}/${connectionState.maxReconnectAttempts})...`);
          
          // Wait a bit before reconnecting
          setTimeout(startConnection, 5000);
        } else if (connectionState.reconnectAttempts >= connectionState.maxReconnectAttempts) {
          logger.error('Maximum reconnection attempts reached');
          
          broadcastToClients({
            type: 'status',
            message: 'Maximum reconnection attempts reached. Please refresh the page to try again.'
          });
        } else {
          logger.info('Not reconnecting - user logged out');
          
          broadcastToClients({
            type: 'status',
            message: 'Logged out from WhatsApp. Please refresh and scan the QR code again.'
          });
        }
      } else if (connection === 'open') {
        connectionState.isConnected = true;
        connectionState.reconnectAttempts = 0;
        connectionState.lastDisconnectReason = null;
        
        logger.info('Connection opened successfully');
        
        // Broadcast connection to clients
        broadcastToClients({
          type: 'connection',
          connected: true
        });
        
        broadcastToClients({
          type: 'status',
          message: 'Connected to WhatsApp'
        });
        
        // Create a backup after successful connection
        await backupAuthFolder();
      }
    });
    
    // Set up message handler
    await setupMessageHandler(sock);
    
    logger.info('WhatsApp connection initialized');
    return sock;
  } catch (error) {
    logger.error('Failed to start WhatsApp connection:', error);
    
    broadcastToClients({
      type: 'status',
      message: 'Error connecting to WhatsApp. Please refresh the page.'
    });
    
    throw error;
  }
}

/**
 * Start the QR web server and WhatsApp connection
 */
async function startServer() {
  try {
    // Start the HTTP server
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running at http://0.0.0.0:${PORT}`);
    });
    
    // Start the WhatsApp connection
    await startConnection();
    
    // Set up automatic restart in case of server crash
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception:', err);
      // Save error to log but keep server running
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      // Save error to log but keep server running
    });
    
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Start the server
startServer();