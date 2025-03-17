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
const { sessionRestorer } = require('./heroku-session-restore');

// Import reaction GIFs fallback system (will be created if it doesn't exist)
let reactionGifsFallback;
try {
  reactionGifsFallback = require('./reaction-gifs-fallback');
} catch (error) {
  console.log('Reaction GIFs fallback system not available, will operate without it');
}

// Global variables
let sock = null;
let qrGenerated = false;
let isConnected = false;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 5000; // milliseconds

// Initialize Express app and WebSocket server
let wss;
let app;
let server;

/**
 * Initialize the Express web server and WebSocket server
 */
async function initServer(port = process.env.PORT || 5000) {
  app = express();
  server = http.createServer(app);
  wss = new WebSocket.Server({ server });
  
  // Create public directory if it doesn't exist
  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    
    // Create basic HTML, CSS, and JS files for the QR web interface
    fs.writeFileSync(path.join(publicDir, 'qr.html'), `
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp QR Code</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="style.css">
      </head>
      <body>
        <div class="container">
          <h1>BLACKSKY-MD WhatsApp Bot</h1>
          <div id="qrcode">
            <p>Waiting for QR code...</p>
          </div>
          <div id="status">Status: Initializing...</div>
          <div class="instructions">
            <h2>How to scan:</h2>
            <ol>
              <li>Open WhatsApp on your phone</li>
              <li>Tap Menu (or Settings) > Linked Devices</li>
              <li>Tap "Link a Device"</li>
              <li>Point your phone camera at the QR code</li>
            </ol>
          </div>
        </div>
        <script src="script.js"></script>
      </body>
      </html>
    `);
    
    fs.writeFileSync(path.join(publicDir, 'style.css'), `
      body {
        font-family: Arial, sans-serif;
        background-color: #f0f0f0;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background-color: white;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        border-radius: 5px;
        margin-top: 20px;
      }
      h1 {
        text-align: center;
        color: #128C7E;
      }
      #qrcode {
        text-align: center;
        padding: 20px;
        background-color: white;
        border-radius: 5px;
        margin-bottom: 20px;
      }
      #qrcode img {
        max-width: 100%;
        height: auto;
      }
      #status {
        text-align: center;
        padding: 10px;
        margin-bottom: 20px;
        background-color: #f9f9f9;
        border-radius: 5px;
        font-weight: bold;
      }
      .instructions {
        padding: 15px;
        background-color: #f5f5f5;
        border-radius: 5px;
      }
      .instructions h2 {
        color: #128C7E;
        margin-top: 0;
      }
      .instructions ol {
        margin-left: 20px;
      }
      .instructions li {
        margin-bottom: 10px;
      }
      @media (max-width: 600px) {
        .container {
          width: 100%;
          margin-top: 0;
          border-radius: 0;
        }
      }
    `);
    
    fs.writeFileSync(path.join(publicDir, 'script.js'), `
      const socket = new WebSocket(
        window.location.protocol === 'https:' 
          ? 'wss://' + window.location.host + '/ws' 
          : 'ws://' + window.location.host + '/ws'
      );
      
      socket.onopen = function() {
        console.log('WebSocket connection established');
        document.getElementById('status').innerText = 'Status: Connected to server, waiting for QR code...';
      };
      
      socket.onclose = function() {
        console.log('WebSocket connection closed');
        document.getElementById('status').innerText = 'Status: Disconnected from server. Please refresh.';
      };
      
      socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        if (data.type === 'qr') {
          document.getElementById('qrcode').innerHTML = '<img src="' + data.qr + '" alt="QR Code">';
          document.getElementById('status').innerText = 'Status: QR Code generated. Scan with WhatsApp!';
        } else if (data.type === 'status') {
          document.getElementById('status').innerText = 'Status: ' + data.message;
          
          if (data.connected) {
            document.getElementById('qrcode').innerHTML = '<p>Connected successfully! You can close this page.</p>';
          }
        }
      };
      
      socket.onerror = function(error) {
        console.error('WebSocket error:', error);
        document.getElementById('status').innerText = 'Status: Connection error. Please refresh.';
      };
      
      // Ping the server every 30 seconds to keep the connection alive
      setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    `);
  }
  
  // Static files
  app.use(express.static(path.join(__dirname, '../public')));
  
  // Routes
  app.get('/', (req, res) => {
    res.redirect('/qr');
  });
  
  app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/qr.html'));
  });
  
  app.get('/status', (req, res) => {
    res.json({
      connected: isConnected,
      qrGenerated: qrGenerated,
      uptime: process.uptime(),
      reconnectAttempts: connectionAttempts
    });
  });
  
  // WebSocket connection
  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    // Send current status to new client
    ws.send(JSON.stringify({
      type: 'status',
      message: isConnected ? 'Connected to WhatsApp' : 'Waiting for connection or QR code',
      connected: isConnected
    }));
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
  });
  
  // Start the server
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

/**
 * Load command modules from the commands directory
 * @param {Object} socket - WhatsApp connection socket
 * @returns {Promise<number>} - Number of commands loaded
 */
async function loadCommandModules(socket) {
  try {
    // If simplified-message-handler.js exists, use it first
    const simplifiedHandlerPath = path.join(__dirname, 'simplified-message-handler.js');
    if (fs.existsSync(simplifiedHandlerPath)) {
      try {
        console.log('Loading simplified message handler...');
        const simplifiedHandler = require('./simplified-message-handler');
        await simplifiedHandler.init(socket);
        console.log('Simplified message handler initialized successfully');
        return 1; // Consider this as one module for counting
      } catch (error) {
        console.error('Error loading simplified message handler:', error);
      }
    }
    
    // Check if termux-command-wrapper.js exists as a fallback
    const termuxWrapperPath = path.join(__dirname, 'termux-command-wrapper.js');
    if (fs.existsSync(termuxWrapperPath)) {
      try {
        console.log('Loading Termux command wrapper...');
        const termuxWrapper = require('./termux-command-wrapper');
        await termuxWrapper.initializeAllModules(socket);
        console.log('Termux command wrapper initialized successfully');
        return 1; // Consider this as one module for counting
      } catch (error) {
        console.error('Error loading Termux command wrapper:', error);
      }
    }
    
    // If neither of the above exist, try to load command modules directly
    const commandsDirectory = path.join(__dirname, '../commands');
    if (!fs.existsSync(commandsDirectory)) {
      console.log('Commands directory not found, creating...');
      fs.mkdirSync(commandsDirectory, { recursive: true });
    }
    
    // Create a map to store commands
    const commands = new Map();
    
    // Basic command handler for direct loading
    const processMessage = async (m) => {
      if (!m.message) return;
      
      const messageType = Object.keys(m.message)[0];
      if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
        const messageText = messageType === 'conversation' 
          ? m.message.conversation 
          : m.message.extendedTextMessage.text;
        
        const prefix = process.env.PREFIX || '!';
        if (!messageText.startsWith(prefix)) return;
        
        const [cmd, ...args] = messageText.slice(prefix.length).trim().split(' ');
        
        if (commands.has(cmd)) {
          try {
            const handler = commands.get(cmd);
            await handler(socket, m, args);
          } catch (error) {
            console.error(`Error executing command '${cmd}':`, error);
          }
        }
      }
    };
    
    // Set up direct command loading if needed in the future
    // For now, return 0 as we're primarily using the handlers above
    return 0;
  } catch (error) {
    console.error('Error loading command modules:', error);
    return 0;
  }
}

/**
 * Set up message handler for WhatsApp
 * @param {Object} socket - WhatsApp connection socket
 */
async function setupMessageHandler(socket) {
  sock = socket;
  
  // Load command modules
  const commandsLoaded = await loadCommandModules(socket);
  console.log(`Loaded ${commandsLoaded} command modules/handlers`);
  
  socket.ev.on('messages.upsert', async (m) => {
    if (m.type === 'notify') {
      try {
        console.log('New message received');
        
        // Use the simplified message handler if available
        try {
          const simplifiedHandler = require('./simplified-message-handler');
          if (simplifiedHandler && simplifiedHandler.isInitialized()) {
            await simplifiedHandler.processMessage(m.messages[0]);
            return; // Successfully processed, exit early
          }
        } catch (handlerError) {
          console.log('Simplified message handler not available:', handlerError.message);
        }
        
        // Fallback to termux wrapper if available
        try {
          const termuxWrapper = require('./termux-command-wrapper');
          if (termuxWrapper) {
            const prefix = process.env.PREFIX || '!';
            await termuxWrapper.processMessage(socket, m.messages[0], prefix);
            return; // Successfully processed, exit early
          }
        } catch (wrapperError) {
          console.log('Termux command wrapper not available:', wrapperError.message);
        }
        
        // Basic fallback message handling
        console.log('Using basic message handling (no modules found)');
      } catch (error) {
        console.error('Error processing message:', error);
      }
    }
  });
  
  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      qrGenerated = true;
      console.log('QR code generated');
      
      // Convert QR to data URL
      try {
        const qrImage = await qrcode.toDataURL(qr);
        
        // Broadcast QR code to all connected clients
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'qr',
              qr: qrImage
            }));
          }
        });
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    }
    
    if (connection === 'open') {
      isConnected = true;
      connectionAttempts = 0;
      console.log('Connected to WhatsApp');
      
      // Extract and save credentials for future restoration
      if (process.env.HEROKU_APP_NAME) {
        try {
          await sessionRestorer.saveSession(sock.authState);
          console.log('Session credentials saved for Heroku restoration');
        } catch (error) {
          console.error('Failed to save session credentials:', error);
        }
      }
      
      // Broadcast connection status to all clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'status',
            message: 'Connected to WhatsApp',
            connected: true
          }));
        }
      });
    }
    
    if (connection === 'close') {
      isConnected = false;
      
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log('Connection closed. Status code:', statusCode);
      console.log('Should reconnect:', shouldReconnect);
      
      // Broadcast disconnection status to all clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'status',
            message: 'Disconnected from WhatsApp. ' + (shouldReconnect ? 'Reconnecting...' : 'Logged out.'),
            connected: false
          }));
        }
      });
      
      if (shouldReconnect && connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
        connectionAttempts++;
        console.log(`Reconnecting... Attempt ${connectionAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
        setTimeout(startConnection, RECONNECT_INTERVAL);
      } else if (connectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log('Max reconnection attempts reached. Please restart the server.');
      }
    }
  });
}

/**
 * Start the WhatsApp connection
 */
async function startConnection() {
  console.log('Starting WhatsApp connection...');
  
  // Create necessary directories
  const AUTH_FOLDER = './auth_info_baileys';
  if (!fs.existsSync(AUTH_FOLDER)) {
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
  }
  
  // Restore session from Heroku environment if available
  let authState;
  if (process.env.HEROKU_APP_NAME) {
    try {
      authState = await sessionRestorer.restoreSession();
      if (authState) {
        console.log('Session restored from Heroku environment');
      } else {
        console.log('No session to restore, starting fresh');
        authState = await useMultiFileAuthState(AUTH_FOLDER);
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      authState = await useMultiFileAuthState(AUTH_FOLDER);
    }
  } else {
    authState = await useMultiFileAuthState(AUTH_FOLDER);
  }
  
  // Initialize WhatsApp connection
  const socket = makeWASocket({
    printQRInTerminal: true,
    auth: authState.state,
    logger: pino({ level: 'silent' }),
    browser: ['BLACKSKY-MD', 'Chrome', '103.0.5060.114'],
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
  });
  
  // Save the auth state
  socket.authState = authState;
  
  // Set up event handlers
  await setupMessageHandler(socket);
  
  // Save auth state on updates
  socket.ev.on('creds.update', authState.saveCreds);
}

/**
 * Start the QR web server and WhatsApp connection
 */
async function startServer() {
  try {
    // Initialize web server
    await initServer();
    
    // Initialize reaction GIFs fallback system if available
    if (reactionGifsFallback) {
      try {
        console.log('Initializing reaction GIFs fallback system...');
        await reactionGifsFallback.initializeFallbackSystem();
        console.log('Reaction GIFs fallback system initialized successfully');
      } catch (error) {
        console.error('Error initializing reaction GIFs fallback system:', error);
      }
    } else {
      console.log('Reaction GIFs fallback system not available, skipping initialization');
    }
    
    // Start WhatsApp connection
    await startConnection();
    
    console.log('Server started successfully');
  } catch (error) {
    console.error('Error starting server:', error);
  }
}

// Start the server
startServer();

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  if (server) {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});