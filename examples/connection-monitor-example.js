/**
 * Example of using the ConnectionMonitor utility
 * This shows how to integrate connection monitoring with your WhatsApp bot
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const ConnectionMonitor = require('../src/utils/connectionMonitor');

async function startBot() {
  // Initialize connection monitor with custom options
  const monitor = new ConnectionMonitor({
    checkIntervalMs: 20000, // Check connection every 20 seconds
    maxReconnectAttempts: 10, // More reconnect attempts
    logFilePath: './connection-health.json'
  });
  
  console.log("Starting WhatsApp bot with connection monitoring...");
  
  // Initialize WhatsApp connection
  await connectToWhatsApp(monitor);
  
  // Set up API endpoint to check health (if using Express)
  // This is just example code
  /*
  const express = require('express');
  const app = express();
  const port = 5000;
  
  app.get('/connection/health', (req, res) => {
    const healthStatus = monitor.getHealthStatus();
    res.json(healthStatus);
  });
  
  app.get('/connection/logs', (req, res) => {
    const logs = monitor.getLogs();
    res.json(logs);
  });
  
  app.listen(port, () => {
    console.log(`Health check API running at http://localhost:${port}/connection/health`);
  });
  */
}

async function connectToWhatsApp(monitor) {
  // Load auth state
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
  
  // Create socket
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: ['BLACKSKY', 'Chrome', '110.0.0'],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000
  });
  
  // Start connection monitoring
  monitor.startMonitoring(sock);
  
  // Set up connection state handling
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update || {};
    
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom) 
        ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
        : true;
      
      console.log(`Connection closed due to ${lastDisconnect?.error?.message || 'unknown error'}`);
      
      if (shouldReconnect) {
        // Let the monitor handle reconnection based on health analysis
        console.log("Monitor will handle reconnection based on health analysis");
      } else {
        console.log("Not reconnecting - user logged out");
        monitor.stopMonitoring();
      }
    } else if (connection === 'open') {
      console.log("Connection opened");
    }
    
    if (qr) {
      console.log("QR generated, please scan");
    }
  });
  
  // Save creds on update
  sock.ev.on('creds.update', saveCreds);
  
  // Periodically log health status
  setInterval(() => {
    const health = monitor.getHealthStatus();
    console.log(`Connection health: ${health.status} (${health.healthScore}/100)`);
    
    if (health.healthScore < 50) {
      console.log("Warning: Connection health is poor");
    }
  }, 60000);
  
  return sock;
}

// Start the bot
startBot().catch(err => {
  console.error("Error starting bot:", err);
});