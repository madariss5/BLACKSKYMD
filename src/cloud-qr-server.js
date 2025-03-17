/**
 * Cloud-Optimized WhatsApp QR Web Server
 * Enhanced for Heroku deployment
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

// Set up logger with more detailed error reporting
const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: true,
      ignore: 'pid,hostname'
    }
  }
});

// Configuration with environment variable support
const PORT = process.env.PORT || 5000;
const AUTH_FOLDER = process.env.AUTH_FOLDER || path.join(__dirname, '../auth_info_baileys');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  logger.error('Application error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: IS_PRODUCTION ? 'An error occurred' : err.message
  });
});

// Create required directories
[AUTH_FOLDER, path.join(__dirname, '../views'), path.join(__dirname, '../public')].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  }
});

// View settings
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Create the EJS template for QR display
const qrTemplatePath = path.join(app.get('views'), 'qr.ejs');
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


// Serve static files if public directory exists
const publicDir = path.join(__dirname, '../public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}


// Store connection state
let connectionState = {
  sock: null,
  qr: null,
  isConnected: false,
  lastDisconnectReason: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: IS_PRODUCTION ? 20 : 10 // More retries in production
};

// Routes
app.get('/', (req, res) => {
  res.render('qr');
});

app.get('/status', (req, res) => {
  res.json({
    connected: connectionState.isConnected,
    lastDisconnect: connectionState.lastDisconnectReason,
    reconnectAttempts: connectionState.reconnectAttempts
  });
});

// WebSocket handling
wss.on('connection', handleWebSocketConnection);

/**
 * Start the WhatsApp connection
 */
async function startConnection() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

    const sock = makeWASocket({
      logger,
      printQRInTerminal: !IS_PRODUCTION,
      auth: state,
      browser: ['BLACKSKY-MD', 'Chrome', '4.0.0'],
      defaultQueryTimeoutMs: 60000
    });

    connectionState.sock = sock;

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', handleConnectionUpdate);
    sock.ev.on('messages.upsert', handleMessages);

    logger.info('WhatsApp connection initialized');
    return sock;
  } catch (error) {
    logger.error('Failed to start WhatsApp connection:', error);
    throw error;
  }
}

/**
 * Start the server with enhanced error handling
 */
async function startServer() {
  try {
    // Start HTTP server with explicit host binding
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running at http://0.0.0.0:${PORT}`);
    });

    // Start WhatsApp connection
    await startConnection();

    // Error handling for uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception:', err);
      if (!IS_PRODUCTION) {
        process.exit(1);
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      if (!IS_PRODUCTION) {
        process.exit(1);
      }
    });

  } catch (err) {
    logger.error('Failed to start server:', err);
    throw err;
  }
}

// Helper functions
function handleWebSocketConnection(ws) {
  // Send current connection status
  ws.send(JSON.stringify({
    type: 'connection',
    connected: connectionState.isConnected,
    reason: connectionState.lastDisconnectReason
  }));

  // Send QR if available
  if (connectionState.qr && !connectionState.isConnected) {
    sendQRToClient(ws, connectionState.qr);
  }
}

function handleConnectionUpdate(update) {
  const { connection, lastDisconnect, qr } = update;

  if (qr) {
    connectionState.qr = qr;
    broadcastQR(qr);
    broadcastToClients({
      type: 'status',
      message: 'Scan this QR code with WhatsApp'
    });
  }

  if (connection === 'close') {
    handleDisconnection(lastDisconnect);
  } else if (connection === 'open') {
    handleSuccessfulConnection();
  }
}

function handleMessages(m) {
  if (m.type === 'notify') {
    const msg = m.messages[0];
    if (!msg) return;
    if (msg.key && msg.key.remoteJid) {
      connectionState.sock.readMessages([msg.key]);
    }
    if (msg.message && !msg.key.fromMe) {
      const messageText = msg.message.conversation || (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) || '';
      if (messageText.toLowerCase() === '!ping') {
        connectionState.sock.sendMessage(msg.key.remoteJid, { text: '🏓 Pong!' });
      }
    }
  }
}

function broadcastQR(qr) {
  qrcode.toDataURL(qr, (err, url) => {
    if (!err) {
      broadcastToClients({
        type: 'qr',
        qr: `<img src="${url}" width="256" height="256" />`
      });
    }
  });
}

function broadcastToClients(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

function sendQRToClient(ws, qr) {
  qrcode.toDataURL(qr, (err, url) => {
    if (!err) {
      ws.send(JSON.stringify({
        type: 'qr',
        qr: `<img src="${url}" width="256" height="256" />`
      }));
    }
  });
}

function handleDisconnection(lastDisconnect) {
  connectionState.isConnected = false;

  const statusCode = lastDisconnect?.error?.output?.statusCode;
  const reason = lastDisconnect?.error?.message || 'Unknown reason';
  connectionState.lastDisconnectReason = reason;

  logger.warn(`Connection closed: ${reason} (Code: ${statusCode})`);

  broadcastToClients({
    type: 'connection',
    connected: false,
    reason: reason
  });

  // Clear existing QR code when disconnected
  connectionState.qr = null;

  // Handle different disconnect scenarios
  if (statusCode === DisconnectReason.loggedOut) {
    logger.info('User logged out - Initiating new connection for QR code');
    // Clear connection state
    connectionState.sock = null;
    connectionState.reconnectAttempts = 0;

    // Notify clients to wait for new QR
    broadcastToClients({
      type: 'status',
      message: 'Logged out. Generating new QR code...'
    });

    // Start new connection after a short delay
    setTimeout(async () => {
      try {
        await startConnection();
      } catch (err) {
        logger.error('Failed to start new connection after logout:', err);
        broadcastToClients({
          type: 'status',
          message: 'Error generating new QR code. Please refresh the page.'
        });
      }
    }, 2000);
  } else if (connectionState.reconnectAttempts < connectionState.maxReconnectAttempts) {
    // Handle normal reconnection attempts
    connectionState.reconnectAttempts++;
    broadcastToClients({
      type: 'status',
      message: `Reconnecting (Attempt ${connectionState.reconnectAttempts}/${connectionState.maxReconnectAttempts})...`
    });
    logger.info(`Attempting to reconnect (${connectionState.reconnectAttempts}/${connectionState.maxReconnectAttempts})...`);
    setTimeout(startConnection, 5000);
  } else {
    logger.error('Maximum reconnection attempts reached');
    broadcastToClients({
      type: 'status',
      message: 'Maximum reconnection attempts reached. Please refresh the page to try again.'
    });
  }
}

function handleSuccessfulConnection() {
  connectionState.isConnected = true;
  connectionState.reconnectAttempts = 0;
  connectionState.lastDisconnectReason = null;

  logger.info('Connection opened successfully');

  broadcastToClients({
    type: 'connection',
    connected: true
  });

  broadcastToClients({
    type: 'status',
    message: 'Connected to WhatsApp'
  });

}

// Load command modules (moved here to ensure socket is available)
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
  
  logger.info('Commands directory ready');
  return 1;
}


// Start the server
startServer().catch(err => {
  logger.error('Fatal error starting server:', err);
  process.exit(1);
});

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

//Save session credentials to persist between restarts (modified for Heroku compatibility)

async function saveSessionToEnv(creds) {
  if (!creds) return false;

  try {
    const credsJSON = JSON.stringify(creds);
    logger.info('Session credentials saved'); //Heroku will handle saving to the filesystem
    return true;
  } catch (error) {
    logger.error('Failed to save session credentials:', error);
    return false;
  }
}