/**
 * WhatsApp Bot QR Code Server for Replit
 * - Serves a web interface for the QR code
 * - Handles WhatsApp authentication via QR code
 * - Provides status updates via API
 * - Auto-reconnects and regenerates QR code on disconnection
 * - Improved conflict handling to prevent error 440
 */

const express = require('express');
const qrcode = require('qrcode');
const path = require('path');
const { connectToWhatsApp, setupSessionBackup, getConnectionStatus, resetConnection } = require('./bot-handler');
const fs = require('fs');

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Track connection state
let connectionInstance = null;
let reconnectionTimer = null;
let connectionLock = false; // Add a lock to prevent concurrent connections
const LOCK_FILE = path.join(__dirname, '.connection_lock');

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse JSON requests
app.use(express.json());

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Status API endpoint
app.get('/api/status', async (req, res) => {
  try {
    // Get current connection status
    const status = getConnectionStatus();
    
    // Format status data for API response
    const response = {
      status: status.state,
      uptime: status.uptime,
      qrCode: null,
      lockStatus: connectionLock ? 'locked' : 'unlocked'
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
    if (status.state === 'disconnected' && !reconnectionTimer && !connectionLock) {
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

// Function to acquire connection lock
function acquireConnectionLock() {
  if (connectionLock) {
    console.log('Connection already locked, cannot acquire lock');
    return false;
  }
  
  try {
    // Create lock file
    fs.writeFileSync(LOCK_FILE, Date.now().toString());
    connectionLock = true;
    console.log('Connection lock acquired');
    return true;
  } catch (error) {
    console.error('Error acquiring connection lock:', error);
    return false;
  }
}

// Function to release connection lock
function releaseConnectionLock() {
  if (!connectionLock) {
    return;
  }
  
  try {
    // Remove lock file if it exists
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
    connectionLock = false;
    console.log('Connection lock released');
  } catch (error) {
    console.error('Error releasing connection lock:', error);
  }
}

// Check if another process has the lock
function checkLockStatus() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const lockTime = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'));
      const now = Date.now();
      
      // If lock is older than 3 minutes, consider it stale
      if (now - lockTime > 3 * 60 * 1000) {
        console.log('Found stale lock, removing it');
        fs.unlinkSync(LOCK_FILE);
        return false;
      }
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error checking lock status:', error);
    return false;
  }
}

// Handle reconnection with lock
async function handleReconnection() {
  // If already locked or another process has the lock, skip reconnection
  if (connectionLock || checkLockStatus()) {
    console.log('Connection is locked, skipping reconnection');
    return;
  }
  
  // Acquire lock
  if (!acquireConnectionLock()) {
    console.log('Failed to acquire connection lock, skipping reconnection');
    return;
  }
  
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
  } finally {
    // Release lock after 10 seconds to allow completion of connection
    setTimeout(() => {
      releaseConnectionLock();
    }, 10000);
  }
}

// Schedule a reconnection
function scheduleReconnection(delay = 5000) {
  if (reconnectionTimer) {
    clearTimeout(reconnectionTimer);
  }
  
  // Only schedule if not locked
  if (!connectionLock && !checkLockStatus()) {
    console.log(`Scheduling reconnection in ${delay/1000} seconds...`);
    reconnectionTimer = setTimeout(async () => {
      await handleReconnection();
      reconnectionTimer = null;
    }, delay);
  } else {
    console.log('Connection is locked, not scheduling reconnection');
  }
}

// Start server
async function startServer() {
  try {
    // Check for existing lock first
    if (checkLockStatus()) {
      console.log('Another process has the connection lock, starting in passive mode');
      // Start express server only
      startExpressOnly();
      return;
    }
    
    // Acquire lock
    if (!acquireConnectionLock()) {
      console.log('Failed to acquire connection lock, starting in passive mode');
      startExpressOnly();
      return;
    }
    
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
    
    // Release lock after 30 seconds to allow other processes if this one fails
    setTimeout(() => {
      releaseConnectionLock();
    }, 30000);
  } catch (error) {
    console.error('Error starting server:', error);
    // Release lock
    releaseConnectionLock();
    
    // If initial connection fails, schedule a retry
    scheduleReconnection();
  }
}

// Start express server only (no WhatsApp connection)
function startExpressOnly() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (passive mode)`);
    console.log(`Open http://localhost:${PORT} in your browser`);
  });
}

// Start server
startServer();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  if (reconnectionTimer) {
    clearTimeout(reconnectionTimer);
  }
  releaseConnectionLock();
  process.exit(0);
});

// Check for unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  releaseConnectionLock();
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  releaseConnectionLock();
});

module.exports = app;