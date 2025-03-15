/**
 * Alternative Browser Configuration for WhatsApp Connection
 * This script tries to connect with different browser fingerprints
 * to bypass WhatsApp's connection restrictions
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { exec } = require('child_process');
const express = require('express');
const app = express();
const port = 5001;

// Browser configurations to try
const browserConfigs = [
  { name: 'Chrome Latest', config: ['Chrome', '119.0.0'] },
  { name: 'Firefox Latest', config: ['Firefox', '91.1.0'] },
  { name: 'Safari Latest', config: ['Safari', '605.1.15'] },
  { name: 'Edge Latest', config: ['Edge', '119.0.0'] },
  { name: 'Opera Latest', config: ['Opera', '91.0.4516.20'] }
];

// Index of current browser config
let currentConfigIndex = 0;
let lastQR = '';
let connectTimeoutId = null;
let connectionStatus = 'Idle';
let currentBrowserName = '';

// Setup express server
app.use(express.static(path.join(__dirname, 'public')));

// Root route - serves QR code and status page
app.get('/', (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>WhatsApp Connection Tool</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 20px;
        background-color: #f0f0f0;
        color: #333;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .container {
        max-width: 500px;
        width: 100%;
        background: white;
        border-radius: 10px;
        padding: 20px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        margin-bottom: 20px;
      }
      h1 {
        color: #075e54;
        margin-top: 0;
      }
      .status {
        margin: 20px 0;
        padding: 15px;
        border-radius: 5px;
        background-color: #f5f5f5;
        border-left: 5px solid #075e54;
      }
      .qr-container {
        display: flex;
        justify-content: center;
        margin: 20px 0;
      }
      .button-container {
        display: flex;
        gap: 10px;
        margin-top: 15px;
      }
      button {
        background-color: #075e54;
        border: none;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
      }
      button:hover {
        background-color: #128c7e;
      }
      button:disabled {
        background-color: #cccccc;
        cursor: not-allowed;
      }
      .instructions {
        margin-top: 20px;
        font-size: 14px;
        line-height: 1.6;
        color: #666;
      }
      .browser-badge {
        display: inline-block;
        background-color: #128c7e;
        color: white;
        padding: 3px 7px;
        border-radius: 3px;
        font-size: 12px;
        margin-top: 10px;
      }
      #reload-btn {
        margin-top: 20px;
        background-color: #1d82cb;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>WhatsApp Alternative Browser Connection</h1>
      <p>This tool tries different browser fingerprints to connect to WhatsApp.</p>
      <div class="browser-badge">Current: ${currentBrowserName || 'None'}</div>
      
      <div class="status" id="status">
        Status: ${connectionStatus}
      </div>
      
      <div class="qr-container" id="qr-code">
        ${lastQR ? `<img src="${lastQR}" width="256" height="256" alt="QR Code">` : 'Waiting for QR code...'}
      </div>
      
      <div class="button-container">
        <button id="next-browser">Try Next Browser</button>
        <button id="clear-auth">Clear Auth Data</button>
      </div>
      
      <button id="reload-btn">Reload Page</button>
      
      <div class="instructions">
        <p><strong>Instructions:</strong></p>
        <ol>
          <li>Wait for the QR code to appear</li>
          <li>Open WhatsApp on your phone</li>
          <li>Tap Menu or Settings and select Linked Devices</li>
          <li>Tap on "Link a Device" and scan the QR code</li>
          <li>If connection fails, click "Try Next Browser" to use a different browser configuration</li>
        </ol>
      </div>
    </div>
    
    <script>
      // Periodically update status and QR
      setInterval(() => {
        fetch('/status')
          .then(res => res.json())
          .then(data => {
            document.getElementById('status').textContent = 'Status: ' + data.status;
            document.querySelector('.browser-badge').textContent = 'Current: ' + data.browser;
            
            if (data.qr && data.qr !== 'none') {
              document.getElementById('qr-code').innerHTML = \`<img src="\${data.qr}" width="256" height="256" alt="QR Code">\`;
            }
          })
          .catch(err => console.error('Error fetching status:', err));
      }, 2000);
      
      // Button event listeners
      document.getElementById('next-browser').addEventListener('click', () => {
        fetch('/next-browser', { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            alert('Switching to ' + data.browser);
            setTimeout(() => window.location.reload(), 1000);
          });
      });
      
      document.getElementById('clear-auth').addEventListener('click', () => {
        fetch('/clear-auth', { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            alert(data.message);
            setTimeout(() => window.location.reload(), 1000);
          });
      });
      
      document.getElementById('reload-btn').addEventListener('click', () => {
        window.location.reload();
      });
    </script>
  </body>
  </html>
  `;
  
  res.send(html);
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    status: connectionStatus,
    browser: currentBrowserName,
    qr: lastQR || 'none'
  });
});

// Try next browser config
app.post('/next-browser', (req, res) => {
  currentConfigIndex = (currentConfigIndex + 1) % browserConfigs.length;
  const nextConfig = browserConfigs[currentConfigIndex];
  currentBrowserName = nextConfig.name;
  
  // Restart connection with new browser config
  if (connectTimeoutId) {
    clearTimeout(connectTimeoutId);
  }
  
  connectionStatus = 'Switching browser configuration...';
  console.log(`Switching to browser configuration: ${nextConfig.name}`);
  
  res.json({ success: true, browser: nextConfig.name });
  
  // Start connection after a short delay
  setTimeout(() => {
    startConnection();
  }, 1000);
});

// Clear auth data
app.post('/clear-auth', async (req, res) => {
  connectionStatus = 'Clearing authentication data...';
  
  try {
    if (fs.existsSync('./auth_info_baileys')) {
      fs.rmSync('./auth_info_baileys', { recursive: true, force: true });
      fs.mkdirSync('./auth_info_baileys', { recursive: true });
    }
    
    console.log('Authentication data cleared successfully');
    connectionStatus = 'Authentication data cleared';
    res.json({ success: true, message: 'Authentication data cleared successfully' });
  } catch (error) {
    console.error('Error clearing auth data:', error);
    connectionStatus = 'Error clearing authentication data';
    res.json({ success: false, message: 'Error clearing authentication data' });
  }
});

// Function to start the server
function startServer() {
  app.listen(port, () => {
    console.log(`[Server] Alternative browser connection tool running at http://localhost:${port}`);
    console.log(`[Server] Try different browser configurations to bypass connection restrictions`);
  });
}

// Function to get a random device name to avoid detection
function getRandomDeviceName() {
  const prefixes = ['BLACKSKY', 'WHATSAPP', 'DEVICE', 'MOBILE', 'WEB'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return `${prefix}-${Date.now()}`;
}

// Function to start connection with current browser config
async function startConnection() {
  try {
    // Get the current browser configuration
    const currentConfig = browserConfigs[currentConfigIndex];
    currentBrowserName = currentConfig.name;
    
    console.log(`[Connection] Starting WhatsApp connection with ${currentConfig.name}...`);
    connectionStatus = `Starting connection with ${currentConfig.name}...`;
    
    // Generate a random device name
    const deviceName = getRandomDeviceName();
    
    // Prepare auth state
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
    
    // Create socket with current browser config
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: [deviceName, ...currentConfig.config],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
      defaultQueryTimeoutMs: 60000,
      syncFullHistory: false
    });
    
    // QR code handler
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        // Generate QR code
        connectionStatus = `Please scan QR code with ${currentConfig.name}`;
        console.log(`[Connection] QR Code ready for scanning (${currentConfig.name})`);
        
        // Display QR in terminal
        qrcode.generate(qr, { small: true });
        
        // Save QR for web display
        try {
          const qrDataUrl = await new Promise((resolve) => {
            qrcode.toDataURL(qr, (err, url) => {
              if (err) {
                console.error('[QR Error]', err);
                resolve(null);
              } else {
                resolve(url);
              }
            });
          });
          
          if (qrDataUrl) {
            lastQR = qrDataUrl;
          }
        } catch (qrError) {
          console.error('[QR Generation Error]', qrError);
        }
      } else if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
          : true;
        
        const statusCode = lastDisconnect?.error?.output?.statusCode || 'unknown';
        const message = lastDisconnect?.error?.message || 'Unknown error';
        
        console.log(`[Connection] Connection closed due to ${message} (Status code: ${statusCode})`);
        connectionStatus = `Connection closed: ${message}. ${shouldReconnect ? 'Reconnecting...' : 'Not reconnecting.'}`;
        
        if (shouldReconnect) {
          // Try again with the same browser after a delay
          connectTimeoutId = setTimeout(() => {
            console.log(`[Connection] Reconnecting with ${currentConfig.name}...`);
            startConnection();
          }, 5000);
        } else {
          connectionStatus = 'Connection failed, try a different browser';
          console.log('[Connection] Not reconnecting - non-recoverable error');
        }
      } else if (connection === 'open') {
        console.log(`[Connection] Connected to WhatsApp with ${currentConfig.name}!`);
        connectionStatus = `Connected successfully with ${currentConfig.name}! You can close this window now.`;
        
        // Clear the QR code
        lastQR = '';
      }
    });
    
    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);
    
  } catch (error) {
    console.error('[Connection] Error starting connection:', error);
    connectionStatus = `Error: ${error.message}`;
    
    // Try again after a delay
    connectTimeoutId = setTimeout(() => {
      console.log('[Connection] Retrying connection...');
      startConnection();
    }, 5000);
  }
}

// Start the server and connection
startServer();
startConnection();

// Handle termination
process.on('SIGINT', () => {
  console.log('Exiting application...');
  process.exit(0);
});