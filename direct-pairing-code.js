/**
 * Direct Pairing Code Generator for WhatsApp Bot
 * Specialized for cloud environments like Replit
 * 
 * This script generates a pairing code directly without trying 
 * to maintain a persistent connection
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const express = require('express');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');

// Configuration
const PORT = 3200;
const AUTH_FOLDER = './auth_info_direct';
const DEFAULT_PHONE = process.env.PAIRING_NUMBER || '4915561048015';
const BROWSER_OPTIONS = [
  ["DirectConnect", "Chrome", "110.0.0.0"],
  ["DirectConnect", "Firefox", "115.0"],
  ["DirectConnect", "Safari", "17.0"],
  ["DirectConnect", "Edge", "120.0.0.0"],
  ["DirectConnect", "Opera", "100.0.0.0"]
];

// Clear auth folder
if (fs.existsSync(AUTH_FOLDER)) {
  fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
}
fs.mkdirSync(AUTH_FOLDER, { recursive: true });

// State variables
let pairingCode = null;
let qrCode = null;
let status = 'disconnected';
let lastError = '';
let sock = null;

// Express app
const app = express();
app.use(express.static('public'));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.send(generateHTML());
});

app.post('/generate-code', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.json({ success: false, error: 'Phone number required' });
    }
    
    // Clear old status
    pairingCode = null;
    qrCode = null;
    status = 'generating';
    lastError = '';
    
    // Start in background
    generatePairingCode(phoneNumber);
    
    res.json({ success: true, message: 'Generating pairing code...' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/status', (req, res) => {
  res.json({
    status,
    pairingCode,
    qrCode,
    lastError
  });
});

async function generatePairingCode(phoneNumber) {
  try {
    // Format phone number (remove + if present)
    const formattedPhone = phoneNumber.startsWith('+') 
      ? phoneNumber.substring(1) 
      : phoneNumber;
    
    console.log(`Phone number formatted for pairing: ${formattedPhone}`);
    
    // Get random browser fingerprint
    const browser = BROWSER_OPTIONS[Math.floor(Math.random() * BROWSER_OPTIONS.length)];
    console.log(`Using browser fingerprint: ${browser[1]}`);
    
    // Initialize auth state
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    
    // Create connection
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser,
      logger: pino({ level: 'warn' }),
      connectTimeoutMs: 60000
    });
    
    // Listen for connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // Handle QR code
      if (qr) {
        status = 'qr_received';
        console.log('QR code received');
        qrCode = await qrcode.toDataURL(qr);
        qrcodeTerminal.generate(qr, { small: true });
      }
      
      // Handle connection status
      if (connection === 'open') {
        status = 'connected';
        console.log('Connected to WhatsApp');
        
        // Connection will close on its own - it's temporary for pairing
      }
      
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || 'Unknown reason';
        
        console.log(`Connection closed: ${reason} (${statusCode})`);
        
        // Don't try to reconnect - we just want the pairing code
        if (statusCode !== DisconnectReason.loggedOut && !pairingCode) {
          status = 'disconnected';
          lastError = `Connection closed: ${reason} (${statusCode})`;
        }
      }
    });
    
    // Save credentials
    sock.ev.on('creds.update', saveCreds);
    
    // Request pairing code after a delay to ensure socket is ready
    setTimeout(async () => {
      try {
        console.log(`Requesting pairing code for ${formattedPhone}...`);
        const code = await sock.requestPairingCode(formattedPhone);
        pairingCode = code;
        status = 'pairing_code_generated';
        console.log(`\n💻 Pairing Code: ${code}\n`);
      } catch (error) {
        console.error('Error requesting pairing code:', error);
        status = 'error';
        lastError = `Pairing code error: ${error.message}`;
        
        // Try again with a different browser fingerprint
        if (error.message && error.message.includes('Connection Closed')) {
          console.log('Connection closed before getting code. Will retry with a different browser...');
          setTimeout(() => {
            generatePairingCode(phoneNumber);
          }, 2000);
        }
      }
    }, 3000);
    
  } catch (error) {
    console.error('Error in pairing code generation:', error);
    status = 'error';
    lastError = error.message;
  }
}

function generateHTML() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Direct WhatsApp Pairing Code Generator</title>
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
      max-width: 600px;
      width: 100%;
      padding: 20px;
      background-color: #1e1e1e;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      margin-bottom: 20px;
    }
    h1, h2 {
      color: #4caf50;
      text-align: center;
    }
    h1 {
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
      background-color: #4caf50;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      width: 100%;
      transition: background-color 0.3s;
    }
    .btn:hover {
      background-color: #45a049;
    }
    .btn:disabled {
      background-color: #555;
      cursor: not-allowed;
    }
    .pairing-code {
      text-align: center;
      font-size: 32px;
      letter-spacing: 5px;
      font-weight: bold;
      padding: 20px;
      background-color: #2d2d2d;
      border-radius: 8px;
      margin: 20px 0;
      color: #4caf50;
    }
    .qr-container {
      text-align: center;
      margin: 20px 0;
      background-color: #ffffff;
      padding: 20px;
      border-radius: 10px;
      max-width: 300px;
      margin: 20px auto;
    }
    .status {
      padding: 10px;
      text-align: center;
      border-radius: 5px;
      margin-bottom: 20px;
      font-weight: bold;
    }
    .status.generating {
      background-color: rgba(255, 152, 0, 0.2);
      color: #ff9800;
    }
    .status.connected {
      background-color: rgba(76, 175, 80, 0.2);
      color: #4caf50;
    }
    .status.error {
      background-color: rgba(244, 67, 54, 0.2);
      color: #f44336;
    }
    .error-message {
      color: #f44336;
      padding: 10px;
      background-color: rgba(244, 67, 54, 0.1);
      border-radius: 5px;
      margin: 10px 0;
    }
    .loading {
      text-align: center;
      margin: 20px 0;
    }
    .loading-dots {
      display: inline-block;
    }
    .loading-dots::after {
      display: inline-block;
      animation: ellipsis 1.25s infinite;
      content: ".";
      width: 1em;
      text-align: left;
    }
    @keyframes ellipsis {
      0% {
        content: ".";
      }
      33% {
        content: "..";
      }
      66% {
        content: "...";
      }
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      color: #888;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>WhatsApp Pairing Code Generator</h1>
    
    <div class="form-group">
      <label for="phoneNumber">Phone Number (with country code, no + symbol)</label>
      <input type="text" id="phoneNumber" placeholder="e.g., 19876543210" value="${DEFAULT_PHONE}">
    </div>
    <button id="generateBtn" class="btn" onclick="generateCode()">Generate Pairing Code</button>
    
    <div id="statusContainer" class="status" style="display: none;"></div>
    
    <div id="loadingContainer" class="loading" style="display: none;">
      <p>Generating pairing code<span class="loading-dots"></span></p>
    </div>
    
    <div id="pairingCodeContainer" style="display: none;">
      <h2>Your Pairing Code:</h2>
      <div id="pairingCode" class="pairing-code"></div>
      <p>Enter this code in WhatsApp mobile app: Settings > Linked Devices > Link Device</p>
    </div>
    
    <div id="qrContainer" class="qr-container" style="display: none;">
      <img id="qrCodeImg" src="" alt="QR Code" width="250px">
      <p>Scan this QR code with your WhatsApp mobile app</p>
    </div>
    
    <div id="errorContainer" class="error-message" style="display: none;"></div>
  </div>
  
  <div class="footer">
    <p>Direct WhatsApp Pairing Code Generator | &copy; 2025</p>
  </div>

  <script>
    let statusCheckInterval;
    
    async function generateCode() {
      const phoneNumber = document.getElementById('phoneNumber').value.trim();
      if (!phoneNumber) {
        alert('Please enter a valid phone number');
        return;
      }
      
      // Disable button and show loading
      document.getElementById('generateBtn').disabled = true;
      document.getElementById('loadingContainer').style.display = 'block';
      document.getElementById('statusContainer').style.display = 'block';
      document.getElementById('statusContainer').className = 'status generating';
      document.getElementById('statusContainer').textContent = 'Initializing connection...';
      document.getElementById('pairingCodeContainer').style.display = 'none';
      document.getElementById('qrContainer').style.display = 'none';
      document.getElementById('errorContainer').style.display = 'none';
      
      try {
        // Request pairing code generation
        const response = await fetch('/generate-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ phoneNumber })
        });
        
        const data = await response.json();
        
        if (data.success) {
          // Start checking status
          clearInterval(statusCheckInterval);
          statusCheckInterval = setInterval(checkStatus, 2000);
        } else {
          showError(data.error || 'Failed to generate pairing code');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
    
    async function checkStatus() {
      try {
        const response = await fetch('/status');
        const data = await response.json();
        
        updateStatusUI(data);
        
        // If we have a pairing code or an error, stop checking
        if (data.status === 'pairing_code_generated' || data.status === 'error') {
          clearInterval(statusCheckInterval);
        }
      } catch (error) {
        showError('Error checking status: ' + error.message);
        clearInterval(statusCheckInterval);
      }
    }
    
    function updateStatusUI(data) {
      const statusContainer = document.getElementById('statusContainer');
      const loadingContainer = document.getElementById('loadingContainer');
      const pairingCodeContainer = document.getElementById('pairingCodeContainer');
      const qrContainer = document.getElementById('qrContainer');
      const errorContainer = document.getElementById('errorContainer');
      const generateBtn = document.getElementById('generateBtn');
      
      // Update status message
      statusContainer.style.display = 'block';
      switch (data.status) {
        case 'generating':
          statusContainer.className = 'status generating';
          statusContainer.textContent = 'Connecting to WhatsApp...';
          break;
        case 'connected':
          statusContainer.className = 'status connected';
          statusContainer.textContent = 'Connected! Requesting pairing code...';
          break;
        case 'qr_received':
          statusContainer.className = 'status generating';
          statusContainer.textContent = 'QR Code received. Use a pairing code instead.';
          // Show QR code as a backup option
          if (data.qrCode) {
            document.getElementById('qrCodeImg').src = data.qrCode;
            qrContainer.style.display = 'block';
          }
          break;
        case 'pairing_code_generated':
          statusContainer.className = 'status connected';
          statusContainer.textContent = 'Pairing code generated successfully!';
          loadingContainer.style.display = 'none';
          
          // Display pairing code
          if (data.pairingCode) {
            document.getElementById('pairingCode').textContent = data.pairingCode;
            pairingCodeContainer.style.display = 'block';
          }
          break;
        case 'error':
          statusContainer.className = 'status error';
          statusContainer.textContent = 'Error generating pairing code';
          loadingContainer.style.display = 'none';
          
          if (data.lastError) {
            errorContainer.textContent = data.lastError;
            errorContainer.style.display = 'block';
          }
          break;
        default:
          statusContainer.className = 'status generating';
          statusContainer.textContent = 'Processing...';
      }
      
      // Re-enable button if we're done (either success or error)
      if (data.status === 'pairing_code_generated' || data.status === 'error') {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate New Code';
      }
    }
    
    function showError(message) {
      document.getElementById('errorContainer').textContent = message;
      document.getElementById('errorContainer').style.display = 'block';
      document.getElementById('loadingContainer').style.display = 'none';
      document.getElementById('statusContainer').className = 'status error';
      document.getElementById('statusContainer').textContent = 'Error occurred';
      document.getElementById('generateBtn').disabled = false;
    }
  </script>
</body>
</html>
  `;
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔════════════════════════════════════════════╗`);
  console.log(`║      DIRECT PAIRING CODE GENERATOR         ║`);
  console.log(`╚════════════════════════════════════════════╝`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser\n`);
  
  // Generate initial code
  generatePairingCode(DEFAULT_PHONE);
});