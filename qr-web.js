/**
 * WhatsApp Web QR Code Server
 * Serves a web interface for scanning the QR code
 */

const express = require('express');
const http = require('http');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const fs = require('fs');

// Constants
const PORT = process.env.PORT || 5000;
const AUTH_FOLDER = './auth_info';

// Initialize Express
const app = express();
const server = http.createServer(app);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Global vars to store connection state
let qrCodeDataURL = '';
let connectionStatus = 'disconnected'; // disconnected, connecting, connected
let sock = null;

// Clean auth folder if needed
if (fs.existsSync(AUTH_FOLDER)) {
  fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
}
fs.mkdirSync(AUTH_FOLDER, { recursive: true });

// API endpoints
app.get('/api/status', (req, res) => {
  res.json({
    status: connectionStatus,
    qrCode: qrCodeDataURL,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/qrcode', (req, res) => {
  if (qrCodeDataURL) {
    res.type('image/png').send(Buffer.from(qrCodeDataURL.split(',')[1], 'base64'));
  } else {
    res.status(404).send('QR code not available yet');
  }
});

// Start WhatsApp connection
async function startWhatsAppConnection() {
  console.log('Starting WhatsApp connection...');
  connectionStatus = 'connecting';
  
  try {
    // Initialize auth state
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    
    // Create WhatsApp connection
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      browser: ['WhatsApp Web', 'Firefox', '121.0'],
      patchMessageBeforeSending: msg => msg
    });
    
    // Handle connection events
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        // QR code received - generate data URL
        console.log('QR Code received, converting to data URL...');
        qrCodeDataURL = await qrcode.toDataURL(qr);
        connectionStatus = 'qr_ready';
        console.log('QR Code ready to scan');
      }
      
      if (connection === 'open') {
        console.log('Connection opened!');
        connectionStatus = 'connected';
        qrCodeDataURL = ''; // Clear QR code when connected
      }
      
      if (connection === 'close') {
        // Connection closed
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
        
        console.log(`Connection closed: ${lastDisconnect?.error?.message || 'Unknown reason'}`);
        connectionStatus = 'disconnected';
        
        if (shouldReconnect) {
          console.log('Attempting to reconnect...');
          setTimeout(startWhatsAppConnection, 5000);
        } else {
          console.log('Authentication failed or session expired');
        }
      }
    });
    
    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);
    
  } catch (err) {
    console.error('Error starting WhatsApp:', err);
    connectionStatus = 'error';
    setTimeout(startWhatsAppConnection, 10000);
  }
}

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  
  // Start WhatsApp connection
  startWhatsAppConnection();
});

// Handle app termination
process.on('SIGINT', () => {
  console.log('\nExiting WhatsApp Web QR Server...');
  if (sock) {
    sock.end();
  }
  process.exit(0);
});