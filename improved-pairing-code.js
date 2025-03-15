/**
 * Improved Pairing Code Generator for WhatsApp Bot
 * Designed to reliably generate pairing codes in cloud environments
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const express = require('express');

// Constants
const AUTH_DIR = './auth_info_pairing';
const port = 5005;
let qrCode = '';
let pairingCode = '';
let connectionStatus = 'disconnected';
let lastError = '';
let reconnectTimer = null;

// Initialize express server for web interface
const app = express();
app.use(express.static('public'));
app.use(express.json());

// HTML templating helper
function generateHTML() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp Pairing Code</title>
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
      color: #25D366;
      text-align: center;
      margin-bottom: 30px;
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
      background-color: #25D366;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      width: 100%;
    }
    .btn:hover {
      background-color: #128C7E;
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
      color: #25D366;
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
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 BLACKSKY-MD WhatsApp Connection</h1>
    
    <div class="options">
      <button class="btn" onclick="showPairingCode()">Pairing Code</button>
      <button class="btn" onclick="showQRCode()">QR Code</button>
    </div>
    
    <div id="pairing-section">
      <div class="form-group">
        <label for="phoneNumber">Phone Number (with country code, no + symbol)</label>
        <input type="text" id="phoneNumber" placeholder="e.g., 19876543210" value="${process.env.PAIRING_NUMBER || ''}">
      </div>
      <button class="btn" onclick="requestPairingCode()">Get Pairing Code</button>
      
      <div id="pairing-code-display" style="display: ${pairingCode ? 'block' : 'none'}">
        <div class="pairing-code">${pairingCode}</div>
        <p>Enter this code in your WhatsApp app to connect</p>
      </div>
    </div>
    
    <div id="qr-section" style="display: none">
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
    <p>BLACKSKY-MD WhatsApp Bot | &copy; 2025</p>
  </div>

  <script>
    function showPairingCode() {
      document.getElementById('pairing-section').style.display = 'block';
      document.getElementById('qr-section').style.display = 'none';
    }
    
    function showQRCode() {
      document.getElementById('pairing-section').style.display = 'none';
      document.getElementById('qr-section').style.display = 'block';
    }
    
    function requestPairingCode() {
      const phoneNumber = document.getElementById('phoneNumber').value.trim();
      if (!phoneNumber) {
        alert('Please enter a valid phone number');
        return;
      }
      
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
          // Refresh page after 2 seconds to show the code
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          alert('Error: ' + data.error);
        }
      })
      .catch(error => {
        alert('Error requesting pairing code: ' + error);
      });
    }
    
    function resetConnection() {
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
          if (data.connected) {
            document.querySelector('.status strong').textContent = 'CONNECTED';
            document.querySelector('.status').style.backgroundColor = 'rgba(37, 211, 102, 0.1)';
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

// Ensure necessary directories exist
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Express routes
app.get('/', (req, res) => {
  res.send(generateHTML());
});

app.post('/request-pairing-code', async (req, res) => {
  const { phoneNumber } = req.body;
  
  if (!phoneNumber) {
    return res.json({ success: false, error: 'Phone number is required' });
  }
  
  try {
    // Store the phone number in environment variable for reuse
    process.env.PAIRING_NUMBER = phoneNumber;
    
    // Initiate a new connection to request the pairing code
    await clearAuthState();
    startConnection();
    
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/reset-connection', async (req, res) => {
  try {
    await clearAuthState();
    startConnection();
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

// Clear authentication state
async function clearAuthState() {
  if (fs.existsSync(AUTH_DIR)) {
    fs.readdirSync(AUTH_DIR).forEach(file => {
      fs.unlinkSync(path.join(AUTH_DIR, file));
    });
  }
  console.log('Auth state cleared successfully');
}

// Start WhatsApp connection
async function startConnection() {
  try {
    connectionStatus = 'connecting';
    lastError = '';
    
    // Use a random device identifier to avoid connection conflicts
    const deviceId = `BLACKSKY-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Use different browser fingerprints in a round-robin manner
    const browserFingerprints = [
      ["BLACKSKY-MD", "Chrome", "110.0.0.0"],
      ["BLACKSKY-MD", "Safari", "17.0"],
      ["BLACKSKY-MD", "Firefox", "115.0"],
      ["BLACKSKY-MD", "Edge", "120.0.0.0"]
    ];
    
    // Get auth state
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    
    // Connection configuration
    const socketConfig = {
      auth: state,
      printQRInTerminal: true,
      browser: browserFingerprints[Math.floor(Math.random() * browserFingerprints.length)],
      markOnlineOnConnect: true,
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      logger: pino({ level: 'warn' }),
      defaultQueryTimeoutMs: 60000,
      patchMessageBeforeSending: true,
      generateHighQualityLinkPreview: false,
      // Improved browser fingerprint
      browserDescription: ["BlackSky MD", "Chrome", "105.0.0.0"], 
      // Optimize for long-lived connections
      keepAliveIntervalMs: 10000,
      // Disable unnecessary history syncing
      shouldSyncHistoryMessage: () => false,
      // Additional parameters to improve compatibility  
      linkPreviewImageThumbnailWidth: 192,
      transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 }
    };
    
    // Create socket connection
    const sock = makeWASocket(socketConfig);
    
    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // Handle QR code
      if (qr) {
        console.log('QR code received');
        try {
          qrCode = await qrcode.toDataURL(qr);
        } catch (error) {
          console.error('Failed to generate QR code:', error);
        }
      }
      
      // Handle connection status changes
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
        
        console.log(`Connection closed: ${errorMessage} (Status code: ${statusCode})`);
        connectionStatus = 'disconnected';
        lastError = `${errorMessage} (Status code: ${statusCode})`;
        
        // Don't auto-reconnect on critical errors
        if (statusCode !== DisconnectReason.loggedOut) {
          console.log('Will not automatically reconnect due to error');
        }
      } else if (connection === 'open') {
        console.log('Connected to WhatsApp');
        connectionStatus = 'connected';
        lastError = '';
      }
    });
    
    // Handle pairing code
    const phoneNumber = process.env.PAIRING_NUMBER;
    if (phoneNumber) {
      console.log(`Phone number formatted for pairing: ${phoneNumber}`);
      
      try {
        // Wait for connection to initialize
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
    connectionStatus = 'disconnected';
    lastError = error.message;
  }
}

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`WhatsApp Pairing Code Server running on port ${port}`);
  startConnection();
});