/**
 * WhatsApp Pairing Code Generator for Replit
 * Specialized for cloud environments
 * 
 * This script directly generates a pairing code for WhatsApp,
 * optimized to work in Replit and other cloud environments
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const express = require('express');
const qrcode = require('qrcode');

// Configuration
const PORT = process.env.PORT || 5050; // Using port 5050 to avoid conflicts
const AUTH_FOLDER = './auth_info_pairing';
const PHONE_NUMBER = process.env.PAIRING_NUMBER || '4915561048015'; // Phone number for pairing code

// Initialize Express app
const app = express();
app.use(express.static('public'));

// Initialize http server
const server = require('http').createServer(app);

// Setup logger
const logger = pino({ 
  level: 'warn',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

// Status tracking
let lastQRCode = null;
let lastError = null;
let pairingCode = null;
let connectionStatus = 'disconnected';
let startTime = Date.now();

// Advanced browser fingerprint rotation
const BROWSER_FINGERPRINTS = [
  // Windows fingerprints often work better in cloud environments
  {
    name: 'Chrome-Win',
    data: ['Chrome-Win10', 'Chrome', '110.0.0.0'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
  },
  {
    name: 'Firefox-Win',
    data: ['Firefox-Win10', 'Firefox', '110.0'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:110.0) Gecko/20100101 Firefox/110.0'
  },
  {
    name: 'Edge-Win',
    data: ['Edge-Win10', 'Edge', '110.0.0.0'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/110.0.0.0'
  },
  {
    name: 'Safari-Mac',
    data: ['Safari-MacOS', 'Safari', '16.3'],
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Safari/605.1.15'
  },
  {
    name: 'Chrome-Android',
    data: ['Chrome-Android13', 'Chrome', '110.0.0.0'],
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36'
  }
];

// Clear authentication files for a fresh start
async function clearAuthFiles() {
  try {
    if (fs.existsSync(AUTH_FOLDER)) {
      console.log('Clearing previous auth files...');
      const files = fs.readdirSync(AUTH_FOLDER);
      for (const file of files) {
        fs.unlinkSync(path.join(AUTH_FOLDER, file));
      }
    } else {
      fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    }
    console.log('Auth files cleared successfully');
    return true;
  } catch (error) {
    console.error('Error clearing auth files:', error);
    return false;
  }
}

// Format phone number for WhatsApp pairing
function formatPhoneNumber(phone) {
  // Remove any non-numeric characters
  let formattedNumber = phone.replace(/\D/g, '');
  
  // Ensure it doesn't start with '+'
  if (formattedNumber.startsWith('+')) {
    formattedNumber = formattedNumber.substring(1);
  }
  
  console.log(`Phone number formatted for pairing: ${formattedNumber}`);
  return formattedNumber;
}

// Connect to WhatsApp and request pairing code
async function connectAndRequestPairingCode(retryCount = 0, browserIndex = 0) {
  try {
    // Ensure auth directory exists
    if (!fs.existsSync(AUTH_FOLDER)) {
      fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    }
    
    // Clear session if error encountered previously
    if (retryCount > 0) {
      await clearAuthFiles();
    }
    
    console.log(`Starting WhatsApp connection (Attempt ${retryCount + 1})...`);
    connectionStatus = 'connecting';
    
    // Get auth state
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    
    // Select browser fingerprint with rotation
    const currentBrowser = BROWSER_FINGERPRINTS[browserIndex % BROWSER_FINGERPRINTS.length];
    console.log(`Using browser fingerprint: ${currentBrowser.name}`);
    
    // Advanced sockOptions for better cloud compatibility
    const sockOptions = {
      auth: state,
      printQRInTerminal: true,
      browser: currentBrowser.data,
      logger: logger,
      markOnlineOnConnect: false,  // Less aggressive presence
      connectTimeoutMs: 60000,     // Generous timeouts for cloud
      defaultQueryTimeoutMs: 60000,
      emitOwnEvents: false,        // Less bandwidth
      syncFullHistory: false,      // Don't try to sync history
      userAgent: currentBrowser.userAgent,
      version: [2, 2323, 4],       // Specific version known to work
      patchMessageBeforeSending: true,
      retryRequestDelayMs: 500,    // Fast retry
      fireInitQueries: true,
      shouldIgnoreJid: () => false // Don't ignore any JIDs
    };
    
    // Initialize WhatsApp connection
    const sock = makeWASocket(sockOptions);
    
    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // Handle QR code updates
      if (qr) {
        console.log('QR code received, waiting to request pairing code...');
        // Convert QR to data URL for web display
        lastQRCode = await qrcode.toDataURL(qr);
      }
      
      // Handle connection status changes
      if (connection === 'open') {
        console.log('Connection established successfully!');
        connectionStatus = 'connected';
        
        // Save connection status to file for other scripts to detect
        fs.writeFileSync('pairing_connection_status.json', JSON.stringify({
          status: 'connected',
          time: new Date().toISOString(),
          phone: PHONE_NUMBER
        }));
        
        // Run the auth transfer script to copy credentials to other auth folders
        console.log('Running auth transfer script...');
        require('child_process').execSync('node transfer-auth.js', { stdio: 'inherit' });
        
      } else if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
        
        console.log(`Connection closed: ${errorMessage} (Status code: ${statusCode})`);
        connectionStatus = 'disconnected';
        lastError = `${errorMessage} (Status code: ${statusCode})`;
        
        // Retry with a different browser fingerprint if 405 error
        if (statusCode === 405) {
          console.log(`Error 405 detected, switching browser fingerprint...`);
          browserIndex = (browserIndex + 1) % BROWSER_FINGERPRINTS.length;
          
          // Retry connection after delay
          setTimeout(() => {
            connectAndRequestPairingCode(retryCount + 1, browserIndex);
          }, 5000);
        } else if (retryCount < 5) {
          // General reconnection logic for other errors
          setTimeout(() => {
            connectAndRequestPairingCode(retryCount + 1, browserIndex);
          }, 10000);
        }
      }
      
      // Request pairing code once we have a stable connection attempt
      if (connection === 'connecting' && !pairingCode) {
        const formattedPhone = formatPhoneNumber(PHONE_NUMBER);
        
        // Wait briefly before requesting pairing code
        setTimeout(async () => {
          try {
            if (sock && formattedPhone) {
              console.log(`Requesting pairing code for ${formattedPhone}...`);
              const code = await sock.requestPairingCode(formattedPhone);
              pairingCode = code;
              console.log(`\n💻 Pairing Code: ${code}\n`);
              
              // Format code for display
              lastQRCode = generatePairingDisplay(code, formattedPhone);
            }
          } catch (error) {
            console.error('Failed to request pairing code:', error);
            lastError = `Pairing code request failed: ${error.message}`;
            lastQRCode = generateErrorDisplay(error.message);
          }
        }, 3000);
      }
    });
    
    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);
    
  } catch (error) {
    console.error('Connection error:', error);
    lastError = error.message;
    
    // Retry with exponential backoff
    if (retryCount < 5) {
      const delay = Math.min(5000 * Math.pow(2, retryCount), 30000);
      console.log(`Retrying in ${delay/1000} seconds...`);
      setTimeout(() => {
        connectAndRequestPairingCode(retryCount + 1, (browserIndex + 1) % BROWSER_FINGERPRINTS.length);
      }, delay);
    }
  }
}

// Generate HTML display for pairing code
function generatePairingDisplay(code, phone) {
  const html = `
  <div style="text-align:center; padding: 20px; font-family: monospace; background: #000; color: #0f0; border-radius: 10px; margin: 20px 0; box-shadow: 0 0 20px rgba(0,255,0,0.3);">
    <h2>📱 WhatsApp Pairing Code</h2>
    <div style="font-size: 38px; letter-spacing: 8px; padding: 25px; font-weight: bold; background: #111; border-radius: 8px;">${code}</div>
    <p>Enter this code in your WhatsApp app to connect your device</p>
    <p>Phone: ${phone}</p>
    <p style="font-size: 12px; margin-top: 15px;">Code will expire in 60 seconds</p>
  </div>`;
  
  return `data:text/html,${encodeURIComponent(html)}`;
}

// Generate error display 
function generateErrorDisplay(message) {
  const html = `
  <div style="text-align:center; padding: 20px; font-family: monospace; background: #300; color: #f77; border-radius: 10px; margin: 20px 0;">
    <h2>❌ Pairing Code Error</h2>
    <p>${message}</p>
    <p>Please check your phone number format and try again</p>
    <button onclick="window.location.reload()" style="background: #900; color: white; border: none; padding: 10px 20px; margin-top: 15px; border-radius: 5px; cursor: pointer;">Try Again</button>
  </div>`;
  
  return `data:text/html,${encodeURIComponent(html)}`;
}

// API routes
app.get('/status', (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  res.json({
    status: connectionStatus,
    phone: PHONE_NUMBER,
    uptime: uptime,
    pairingCode: pairingCode,
    error: lastError
  });
});

// Express routes
app.get('/', (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  
  if (pairingCode) {
    // If we have a pairing code, show it directly
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Pairing Code</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f0f0f0; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .code { font-size: 40px; text-align: center; letter-spacing: 8px; padding: 20px; background: #f8f8f8; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .status { padding: 10px; background: #eaffea; border-radius: 5px; margin-top: 20px; }
          h1 { color: #075e54; }
          .info { color: #555; margin-bottom: 5px; }
          button { background: #075e54; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; }
          .error { background: #ffebee; color: #c62828; padding: 10px; border-radius: 5px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>WhatsApp Pairing Code</h1>
          <p class="info">Enter this code in your WhatsApp mobile app:</p>
          <div class="code">${pairingCode}</div>
          <p>1. Open WhatsApp on your phone</p>
          <p>2. Go to Settings > Linked Devices</p>
          <p>3. Tap "Link a Device"</p>
          <p>4. When prompted, enter the code shown above</p>
          <div class="status">
            <p><strong>Status:</strong> ${connectionStatus}</p>
            <p><strong>Phone:</strong> ${PHONE_NUMBER}</p>
            <p><strong>Uptime:</strong> ${Math.floor(uptime / 60)} minutes, ${uptime % 60} seconds</p>
          </div>
          ${lastError ? `<div class="error">Error: ${lastError}</div>` : ''}
          <p style="margin-top: 20px;">
            <button onclick="window.location.reload()">Refresh</button>
          </p>
        </div>
        <script>
          // Auto refresh every 10 seconds
          setTimeout(() => window.location.reload(), 10000);
        </script>
      </body>
      </html>
    `);
  } else if (lastQRCode) {
    // Show generated QR code while we wait for the pairing code
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Connection</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f0f0f0; text-align: center; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          img { max-width: 100%; height: auto; margin: 20px 0; }
          .status { padding: 10px; background: #f8f8f8; border-radius: 5px; margin-top: 20px; }
          h1 { color: #075e54; }
          .loader { border: 5px solid #f3f3f3; border-top: 5px solid #075e54; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 20px auto; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          .error { background: #ffebee; color: #c62828; padding: 10px; border-radius: 5px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Connecting to WhatsApp...</h1>
          <p>Requesting pairing code for ${PHONE_NUMBER}</p>
          <div class="loader"></div>
          <img src="${lastQRCode}" alt="QR Code" />
          <div class="status">
            <p><strong>Status:</strong> ${connectionStatus}</p>
            <p><strong>Waiting for pairing code generation...</strong></p>
          </div>
          ${lastError ? `<div class="error">Error: ${lastError}</div>` : ''}
        </div>
        <script>
          // Auto refresh every 5 seconds
          setTimeout(() => window.location.reload(), 5000);
        </script>
      </body>
      </html>
    `);
  } else {
    // Loading screen
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Connection</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f0f0f0; text-align: center; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .loader { border: 5px solid #f3f3f3; border-top: 5px solid #075e54; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 20px auto; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          h1 { color: #075e54; }
          .status { padding: 10px; background: #f8f8f8; border-radius: 5px; margin-top: 20px; }
          .error { background: #ffebee; color: #c62828; padding: 10px; border-radius: 5px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Connecting to WhatsApp...</h1>
          <p>Establishing connection to generate pairing code</p>
          <div class="loader"></div>
          <div class="status">
            <p><strong>Status:</strong> ${connectionStatus}</p>
            <p><strong>Phone:</strong> ${PHONE_NUMBER}</p>
          </div>
          ${lastError ? `<div class="error">Error: ${lastError}</div>` : ''}
        </div>
        <script>
          // Auto refresh every 3 seconds
          setTimeout(() => window.location.reload(), 3000);
        </script>
      </body>
      </html>
    `);
  }
});

// Route to restart the connection
app.get('/restart', async (req, res) => {
  console.log('Restarting connection...');
  pairingCode = null;
  lastQRCode = null;
  lastError = null;
  connectionStatus = 'disconnected';
  await clearAuthFiles();
  connectAndRequestPairingCode();
  res.redirect('/');
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to view the pairing code`);
  
  // Start WhatsApp connection
  console.log('Starting WhatsApp connection...');
  connectAndRequestPairingCode();
});