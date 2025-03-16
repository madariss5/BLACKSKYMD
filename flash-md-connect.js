/**
 * FLASH-MD WhatsApp Connection Script
 * Advanced hybrid connection with both QR and pairing code support
 * Created for Replit environment
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const express = require('express');
const qrcodeTerminal = require('qrcode-terminal');

// ============== CONFIGURATION ==============
const AUTH_DIR = './auth_info_flash';
const PORT = 5500;
const BOT_NAME = 'FLASH-MD';
const DEFAULT_PHONE = '4915561048015'; // Default phone number for pairing
// ==========================================

// State variables
let qrCode = '';
let pairingCode = '';
let connectionStatus = 'disconnected';
let lastError = '';
let reconnectAttempt = 0;
let reconnectTimer = null;
let sock = null;

// Create express app
const app = express();
app.use(express.static('public'));
app.use(express.json());

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// ============== SERVER ROUTES ==============
app.get('/', (req, res) => {
  res.send(generateHTML());
});

app.post('/request-pairing-code', async (req, res) => {
  const { phoneNumber } = req.body;
  
  if (!phoneNumber) {
    return res.json({ success: false, error: 'Phone number is required' });
  }
  
  try {
    // Store the phone number for reuse
    process.env.PAIRING_NUMBER = phoneNumber;
    
    // Clear auth and start a new connection
    await clearAuthState();
    await connectToWhatsApp();
    
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/reset-connection', async (req, res) => {
  try {
    await clearAuthState();
    await connectToWhatsApp();
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/status', (req, res) => {
  res.json({ 
    connected: connectionStatus === 'connected',
    status: connectionStatus,
    error: lastError
  });
});

// ============== HELPER FUNCTIONS ==============

// Clear authentication state
async function clearAuthState() {
  if (fs.existsSync(AUTH_DIR)) {
    fs.readdirSync(AUTH_DIR).forEach(file => {
      fs.unlinkSync(path.join(AUTH_DIR, file));
    });
  }
  console.log('Auth state cleared successfully');
}

// Calculate exponential backoff
function getRetryDelay(attempt) {
  return Math.min(Math.pow(2, attempt) * 1000, 60000); // Max 1 minute
}

// Connect to WhatsApp
async function connectToWhatsApp() {
  try {
    // Reset state
    connectionStatus = 'connecting';
    lastError = '';
    qrCode = '';
    pairingCode = '';
    
    // Random device ID to avoid conflicts
    const deviceId = `${BOT_NAME}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Browser fingerprints to try
    const browserFingerprints = [
      [BOT_NAME, "Chrome", "110.0.0.0"],
      [BOT_NAME, "Firefox", "115.0"],
      [BOT_NAME, "Safari", "17.0"],
      [BOT_NAME, "Edge", "120.0.0.0"],
      [BOT_NAME, "Opera", "100.0.0.0"]
    ];
    
    // Get a random fingerprint
    const selectedBrowser = browserFingerprints[Math.floor(Math.random() * browserFingerprints.length)];
    console.log(`Using browser fingerprint: ${selectedBrowser[1]}`);
    
    // Get authentication state
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    
    // Socket configuration
    const socketConfig = {
      auth: state,
      printQRInTerminal: true,
      browser: selectedBrowser,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      logger: pino({ level: 'warn' }),
      defaultQueryTimeoutMs: 60000,
      patchMessageBeforeSending: true,
      generateHighQualityLinkPreview: false,
      // Additional parameters for improved compatibility
      browserDescription: [BOT_NAME, "Chrome", "105.0.0.0"],
      keepAliveIntervalMs: 10000,
      shouldSyncHistoryMessage: () => false,
      linkPreviewImageThumbnailWidth: 192,
      transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 }
    };
    
    // Create socket connection
    sock = makeWASocket(socketConfig);
    
    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // Handle QR code
      if (qr) {
        console.log('QR code received, displaying...');
        try {
          // Generate QR code for web
          qrCode = await qrcode.toDataURL(qr);
          
          // Also display in terminal
          qrcodeTerminal.generate(qr, { small: true });
        } catch (error) {
          console.error('Failed to generate QR code:', error);
        }
      }
      
      // Handle connection status changes
      if (connection === 'close') {
        // Get status code and error message
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
        
        console.log(`Connection closed: ${errorMessage} (Status code: ${statusCode})`);
        connectionStatus = 'disconnected';
        lastError = `${errorMessage} (Status code: ${statusCode})`;
        
        // If it's a normal loggedOut disconnect, don't auto-reconnect
        if (statusCode === DisconnectReason.loggedOut) {
          console.log('Logged out, not reconnecting');
        }
        // If it's a connection error (405), try again with a new browser fingerprint
        else if (statusCode === 405) {
          console.log('Connection blocked (405 error), trying again with a new browser fingerprint');
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(async () => {
            await clearAuthState();
            await connectToWhatsApp();
          }, 5000);
        }
        // Otherwise attempt reconnection with exponential backoff
        else {
          const delay = getRetryDelay(reconnectAttempt++);
          console.log(`Reconnecting in ${delay / 1000}s (Attempt ${reconnectAttempt}/10)`);
          
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(async () => {
            await connectToWhatsApp();
          }, delay);
        }
      } 
      else if (connection === 'open') {
        console.log('Connected to WhatsApp!');
        connectionStatus = 'connected';
        lastError = '';
        reconnectAttempt = 0;
        
        // Send notification to user
        try {
          const ownerJid = process.env.OWNER_NUMBER;
          if (ownerJid) {
            await sock.sendMessage(ownerJid, {
              text: `🚀 *${BOT_NAME}* is now connected and ready!\\n\\n📊 *Connection Stats*\\n- Time: ${new Date().toLocaleString()}\\n- Status: Connected\\n- Browser: ${selectedBrowser[1]}\\n\\n_This is an automated message._`
            });
            console.log('Sent connection notification to owner');
          }
        } catch (err) {
          console.log('Could not send owner notification:', err.message);
        }
      }
    });
    
    // Handle pairing code
    const phoneNumber = process.env.PAIRING_NUMBER || DEFAULT_PHONE;
    if (phoneNumber) {
      console.log(`Phone number formatted for pairing: ${phoneNumber}`);
      
      try {
        // Wait for connection to initialize before requesting code
        setTimeout(async () => {
          try {
            console.log(`Requesting pairing code for ${phoneNumber}...`);
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n💻 Pairing Code: ${code}\n`);
            pairingCode = code;
          } catch (error) {
            console.error('Error requesting pairing code:', error);
            lastError = `Pairing code request failed: ${error.message}`;
          }
        }, 3000);
      } catch (error) {
        console.error('Failed to initialize pairing code request:', error);
        lastError = `Pairing code initialization failed: ${error.message}`;
      }
    } else {
      console.log('No phone number provided. Please enter a phone number to get a pairing code.');
    }
    
    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);
    
  } catch (error) {
    console.error('Connection error:', error);
    connectionStatus = 'error';
    lastError = error.message;
    
    // Try reconnecting after a delay
    const delay = getRetryDelay(reconnectAttempt++);
    console.log(`Error connecting. Trying again in ${delay / 1000}s...`);
    
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(async () => {
      await connectToWhatsApp();
    }, delay);
  }
}

// Generate HTML template
function generateHTML() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FLASH-MD WhatsApp Connection</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #121212;
      color: #e0e0e0;
      margin: 0;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      max-width: 800px;
      width: 100%;
      padding: 20px;
      background-color: #1e1e1e;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      margin-bottom: 20px;
    }
    h1 {
      color: #ffbb00;
      text-align: center;
      margin-bottom: 30px;
      text-shadow: 0 0 10px rgba(255, 187, 0, 0.5);
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    input {
      width: 100%;
      padding: 12px;
      border: 1px solid #444;
      border-radius: 5px;
      background-color: #2d2d2d;
      color: #e0e0e0;
      font-size: 16px;
    }
    .btn {
      background-color: #ffbb00;
      color: #121212;
      border: none;
      padding: 12px 24px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      width: 100%;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .btn:hover {
      background-color: #ffd700;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(255, 187, 0, 0.3);
    }
    .pairing-code {
      text-align: center;
      font-size: 32px;
      letter-spacing: 8px;
      font-weight: bold;
      padding: 20px;
      background-color: #2d2d2d;
      border-radius: 8px;
      margin: 20px 0;
      color: #ffbb00;
    }
    .status {
      padding: 10px;
      text-align: center;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .qr-container {
      text-align: center;
      margin: 20px 0;
      background-color: #ffffff;
      padding: 20px;
      border-radius: 10px;
      max-width: 300px;
      margin: 0 auto;
    }
    .options {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    .options button {
      flex: 1;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      color: #888;
      font-size: 14px;
    }
    .error {
      color: #ff5252;
      padding: 10px;
      background-color: rgba(255, 82, 82, 0.1);
      border-radius: 5px;
      margin: 10px 0;
    }
    .tabs {
      display: flex;
      margin-bottom: 20px;
    }
    .tab {
      padding: 10px 20px;
      cursor: pointer;
      background-color: #2d2d2d;
      border: none;
      color: #e0e0e0;
      flex: 1;
      text-align: center;
      border-bottom: 3px solid transparent;
      transition: all 0.3s ease;
    }
    .tab.active {
      border-bottom: 3px solid #ffbb00;
      color: #ffbb00;
    }
    .tab-content {
      display: none;
      padding: 20px 0;
    }
    .tab-content.active {
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚡ FLASH-MD WhatsApp Connection</h1>
    
    <div class="tabs">
      <button id="tab-pairing" class="tab active" onclick="switchTab('pairing')">Pairing Code</button>
      <button id="tab-qr" class="tab" onclick="switchTab('qr')">QR Code</button>
    </div>
    
    <div id="pairing-content" class="tab-content active">
      <div class="form-group">
        <label for="phoneNumber">Phone Number (with country code, no + symbol)</label>
        <input type="text" id="phoneNumber" placeholder="e.g., 19876543210" value="${process.env.PAIRING_NUMBER || DEFAULT_PHONE}">
      </div>
      <button class="btn" onclick="requestPairingCode()">Get Pairing Code</button>
      
      <div id="pairing-code-display" style="display: ${pairingCode ? 'block' : 'none'}">
        <div class="pairing-code">${pairingCode}</div>
        <p>Enter this code in your WhatsApp app to connect</p>
      </div>
    </div>
    
    <div id="qr-content" class="tab-content">
      <div class="qr-container">
        ${qrCode ? `<img src="${qrCode}" alt="QR Code" width="250px">` : '<p>QR Code not available</p>'}
      </div>
      <p>Scan this QR code with your WhatsApp app to connect</p>
    </div>
    
    <div class="status">
      <p>Status: <strong>${connectionStatus.toUpperCase()}</strong></p>
      ${lastError ? `<div class="error">Last Error: ${lastError}</div>` : ''}
    </div>
    
    <button class="btn" onclick="resetConnection()">Reset Connection</button>
  </div>
  
  <div class="footer">
    <p>FLASH-MD WhatsApp Bot | &copy; 2025</p>
  </div>

  <script>
    function switchTab(tabId) {
      // Remove active class from all tabs and content
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      
      // Add active class to selected tab and content
      document.getElementById('tab-' + tabId).classList.add('active');
      document.getElementById(tabId + '-content').classList.add('active');
    }
    
    function requestPairingCode() {
      const phoneNumber = document.getElementById('phoneNumber').value.trim();
      if (!phoneNumber) {
        alert('Please enter a valid phone number');
        return;
      }
      
      document.querySelector('.btn').disabled = true;
      document.querySelector('.btn').textContent = 'Generating...';
      
      fetch('/request-pairing-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phoneNumber })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Refresh page after 3 seconds to show the code
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        } else {
          alert('Error: ' + data.error);
          document.querySelector('.btn').disabled = false;
          document.querySelector('.btn').textContent = 'Get Pairing Code';
        }
      })
      .catch(error => {
        alert('Error requesting pairing code: ' + error);
        document.querySelector('.btn').disabled = false;
        document.querySelector('.btn').textContent = 'Get Pairing Code';
      });
    }
    
    function resetConnection() {
      if (!confirm('Are you sure you want to reset the connection? This will clear all authentication data.')) {
        return;
      }
      
      fetch('/reset-connection', {
        method: 'POST'
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          window.location.reload();
        } else {
          alert('Error resetting connection: ' + data.error);
        }
      })
      .catch(error => {
        alert('Error: ' + error);
      });
    }
    
    // Auto-refresh status every 10 seconds
    setInterval(() => {
      fetch('/status')
        .then(response => response.json())
        .then(data => {
          document.querySelector('.status strong').textContent = data.status.toUpperCase();
          if (data.connected) {
            document.querySelector('.status').style.backgroundColor = 'rgba(255, 187, 0, 0.1)';
          }
          if (data.error) {
            // Check if error div exists, if not create it
            let errorDiv = document.querySelector('.error');
            if (!errorDiv) {
              errorDiv = document.createElement('div');
              errorDiv.className = 'error';
              document.querySelector('.status').appendChild(errorDiv);
            }
            errorDiv.textContent = 'Last Error: ' + data.error;
          }
        })
        .catch(error => {
          console.error('Error fetching status:', error);
        });
    }, 10000);
  </script>
</body>
</html>
  `;
}

// ============== START SERVER ==============
// Start the server and WhatsApp connection
async function main() {
  try {
    // Start the server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n╔════════════════════════════════════════════╗`);
      console.log(`║           FLASH-MD WHATSAPP BOT            ║`);
      console.log(`╚════════════════════════════════════════════╝`);
      console.log(`Server running on port ${PORT}`);
      console.log(`Open http://localhost:${PORT} in your browser\n`);
    });
    
    // Connect to WhatsApp
    await connectToWhatsApp();
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

// Run main function
main();