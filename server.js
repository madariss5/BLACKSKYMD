/**
 * WhatsApp Bot QR Code Server for Replit
 * - Serves a web interface for the QR code
 * - Handles WhatsApp authentication via QR code
 * - Provides status updates via API
 * - Auto-reconnects and regenerates QR code on disconnection
 */

const express = require('express');
const qrcode = require('qrcode');
const path = require('path');
const { connectToWhatsApp, setupSessionBackup, getConnectionStatus } = require('./bot-handler');

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Track connection state
let connectionInstance = null;
let reconnectionTimer = null;

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse JSON requests
app.use(express.json());

// Status API endpoint
app.get('/api/status', async (req, res) => {
  try {
    // Get current connection status
    const status = getConnectionStatus();
    
    // Format status data for API response
    const response = {
      status: status.state,
      uptime: status.uptime,
      qrCode: null
    };
    
    // If QR code is available, convert to data URL
    if (status.state === 'qr_ready' && status.qrCode) {
      try {
        response.qrCode = await qrcode.toDataURL(status.qrCode);
      } catch (err) {
        console.error('Error generating QR code data URL:', err);
      }
    }
    
    // Check if we need to start reconnection
    if (status.state === 'disconnected' && !reconnectionTimer) {
      scheduleReconnection();
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error in status API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to manually trigger reconnection
app.post('/api/reconnect', async (req, res) => {
  try {
    console.log('Manual reconnection requested');
    await handleReconnection();
    res.json({ success: true, message: 'Reconnection initiated' });
  } catch (error) {
    console.error('Error in reconnect API:', error);
    res.status(500).json({ error: 'Reconnection failed' });
  }
});

// Handle reconnection
async function handleReconnection() {
  try {
    console.log('Attempting to reconnect to WhatsApp...');
    
    // Clear any existing timer
    if (reconnectionTimer) {
      clearTimeout(reconnectionTimer);
      reconnectionTimer = null;
    }
    
    // Initialize new WhatsApp connection
    connectionInstance = await connectToWhatsApp();
    console.log('WhatsApp reconnection initialized');
  } catch (error) {
    console.error('Error during reconnection:', error);
    // Schedule another attempt
    scheduleReconnection(10000); // Try again in 10 seconds
  }
}

// Schedule a reconnection
function scheduleReconnection(delay = 5000) {
  if (reconnectionTimer) {
    clearTimeout(reconnectionTimer);
  }
  
  console.log(`Scheduling reconnection in ${delay/1000} seconds...`);
  reconnectionTimer = setTimeout(async () => {
    await handleReconnection();
    reconnectionTimer = null;
  }, delay);
}

// Start server
async function startServer() {
  try {
    // Initialize WhatsApp connection
    connectionInstance = await connectToWhatsApp();
    console.log('WhatsApp connection initialized');
    
    // Set up session backup
    setupSessionBackup();
    
    // Start Express server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Open http://localhost:${PORT} in your browser`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    // If initial connection fails, schedule a retry
    scheduleReconnection();
  }
}

// Start server
startServer();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  if (reconnectionTimer) {
    clearTimeout(reconnectionTimer);
  }
  process.exit(0);
});

module.exports = app;