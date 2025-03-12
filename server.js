/**
 * WhatsApp Bot QR Code Server for Replit
 * - Serves a web interface for the QR code
 * - Handles WhatsApp authentication via QR code
 * - Provides status updates via API
 */

const express = require('express');
const qrcode = require('qrcode');
const path = require('path');
const { connectToWhatsApp, setupSessionBackup, getConnectionStatus } = require('./bot-handler');

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

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
    
    res.json(response);
  } catch (error) {
    console.error('Error in status API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
async function startServer() {
  try {
    // Initialize WhatsApp connection
    await connectToWhatsApp();
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
  }
}

// Start server
startServer();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;