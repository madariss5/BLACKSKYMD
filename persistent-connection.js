/**
 * Persistent WhatsApp Connection Handler for Replit
 * Designed to maintain a 24/7 connection with minimal disconnections
 * Uses local auth session import approach to avoid 405 errors
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { unlinkSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync } = require('fs');
const express = require('express');

// Settings
const AUTH_FOLDER = './auth_info_persistent';
const BACKUP_AUTH_FOLDER = './auth_backup';
const AUTH_BACKUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
const RECONNECT_INTERVAL = 5000; // 5 seconds
const MAX_ATTEMPTS = 20;
const PORT = 5900;

// Browser fingerprints to try (in order of reliability)
const BROWSER_FINGERPRINTS = [
  ['WhatsApp-Persistent', 'Safari', '17.0'],
  ['WhatsApp-Persistent', 'Chrome', '110.0.0'],
  ['WhatsApp-Persistent', 'Firefox', '115.0'],
  ['WhatsApp-Persistent', 'Edge', '105.0.0.0'],
  ['WhatsApp-Persistent', 'Opera', '90.0.0.0']
];

// Minimal logger to reduce console spam
const logger = pino({ 
  level: 'warn',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: true
    }
  }
});

// Status tracking
let connectionStatus = 'disconnected';
let lastConnected = null;
let uptime = 0;
let uptimeStart = null;
let reconnectCount = 0;
let currentBrowserIndex = 0;
let sock = null;
let lastError = null;
let messageCounter = 0;

// Create express app for dashboard
const app = express();

/**
 * Ensure necessary directories exist
 */
function ensureDirectories() {
  if (!existsSync(AUTH_FOLDER)) {
    mkdirSync(AUTH_FOLDER, { recursive: true });
    console.log(`Created auth folder: ${AUTH_FOLDER}`);
  }
  
  if (!existsSync(BACKUP_AUTH_FOLDER)) {
    mkdirSync(BACKUP_AUTH_FOLDER, { recursive: true });
    console.log(`Created backup folder: ${BACKUP_AUTH_FOLDER}`);
  }
}

/**
 * Check if valid auth session exists
 */
function hasValidSession() {
  try {
    if (!existsSync(AUTH_FOLDER)) return false;
    
    const files = readdirSync(AUTH_FOLDER);
    if (files.length === 0) return false;
    
    // Check for creds.json which is essential
    return files.includes('creds.json');
  } catch (err) {
    console.error('Error checking session:', err);
    return false;
  }
}

/**
 * Backup the current auth session
 */
function backupSession() {
  try {
    if (!hasValidSession()) {
      console.log('No valid session to backup');
      return false;
    }
    
    const timestamp = Date.now();
    const backupDir = path.join(BACKUP_AUTH_FOLDER, `backup_${timestamp}`);
    
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }
    
    // Copy all files from auth folder to backup folder
    const files = readdirSync(AUTH_FOLDER);
    for (const file of files) {
      const srcPath = path.join(AUTH_FOLDER, file);
      const destPath = path.join(backupDir, file);
      copyFileSync(srcPath, destPath);
    }
    
    // Keep only the last 5 backups
    const backups = readdirSync(BACKUP_AUTH_FOLDER).sort();
    while (backups.length > 5) {
      const oldestBackup = backups.shift();
      const oldestBackupPath = path.join(BACKUP_AUTH_FOLDER, oldestBackup);
      
      const oldFiles = readdirSync(oldestBackupPath);
      for (const file of oldFiles) {
        unlinkSync(path.join(oldestBackupPath, file));
      }
      
      fs.rmdirSync(oldestBackupPath);
    }
    
    console.log(`Session backed up to ${backupDir}`);
    return true;
  } catch (err) {
    console.error('Error backing up session:', err);
    return false;
  }
}

/**
 * Restore the most recent backup session
 */
function restoreLatestBackup() {
  try {
    const backups = readdirSync(BACKUP_AUTH_FOLDER).sort();
    if (backups.length === 0) {
      console.log('No backups found to restore');
      return false;
    }
    
    const latestBackup = backups[backups.length - 1];
    const backupDir = path.join(BACKUP_AUTH_FOLDER, latestBackup);
    
    // Clear current auth folder
    if (existsSync(AUTH_FOLDER)) {
      const files = readdirSync(AUTH_FOLDER);
      for (const file of files) {
        unlinkSync(path.join(AUTH_FOLDER, file));
      }
    } else {
      mkdirSync(AUTH_FOLDER, { recursive: true });
    }
    
    // Copy all files from backup folder to auth folder
    const files = readdirSync(backupDir);
    for (const file of files) {
      const srcPath = path.join(backupDir, file);
      const destPath = path.join(AUTH_FOLDER, file);
      copyFileSync(srcPath, destPath);
    }
    
    console.log(`Restored session from ${backupDir}`);
    return true;
  } catch (err) {
    console.error('Error restoring session:', err);
    return false;
  }
}

/**
 * Check if valid credentials have been imported
 * This is crucial for avoiding the 405 error
 */
function checkImportedCredentials() {
  try {
    const credPath = path.join(AUTH_FOLDER, 'creds.json');
    
    if (!existsSync(credPath)) {
      console.log('No credentials file found. You need to import one from a local device.');
      return false;
    }
    
    // Verify the creds.json file has required fields
    const creds = JSON.parse(readFileSync(credPath, 'utf8'));
    
    if (!creds.me || !creds.me.id || !creds.me.name) {
      console.log('Credentials file is invalid or incomplete');
      return false;
    }
    
    console.log(`Found valid credentials for: ${creds.me.name} (${creds.me.id})`);
    return true;
  } catch (err) {
    console.error('Error checking credentials:', err);
    return false;
  }
}

/**
 * Connect to WhatsApp
 */
async function connectToWhatsApp(attemptCount = 0) {
  try {
    // If we've tried too many times, try restoring a backup
    if (attemptCount >= MAX_ATTEMPTS && attemptCount % MAX_ATTEMPTS === 0) {
      console.log('Too many failed attempts, trying to restore from backup...');
      if (restoreLatestBackup()) {
        attemptCount = 0;
      }
    }
    
    connectionStatus = 'connecting';
    console.log(`Connection attempt ${attemptCount + 1}/${MAX_ATTEMPTS}...`);
    
    // Select browser fingerprint to use
    const browserFingerprint = BROWSER_FINGERPRINTS[currentBrowserIndex % BROWSER_FINGERPRINTS.length];
    console.log(`Using browser fingerprint: ${browserFingerprint[1]}`);
    
    // Create WhatsApp socket
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version } = await fetchLatestBaileysVersion();
    
    sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: state,
      browser: browserFingerprint,
      connectTimeoutMs: 30000,
      keepAliveIntervalMs: 10000,
      retryRequestDelayMs: 2000,
      markOnlineOnConnect: true
    });
    
    // Handle connection events
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (connection === 'open') {
        connectionStatus = 'connected';
        lastConnected = new Date();
        uptimeStart = Date.now();
        reconnectCount = 0;
        console.log('✅ Connected to WhatsApp!');
        
        // Backup session upon successful connection
        backupSession();
        
        // Start periodic backup
        setTimeout(() => backupSession(), AUTH_BACKUP_INTERVAL);
        
        // Send status message
        setTimeout(() => {
          sendStatusMessage(sock);
        }, 5000);
        
        return;
      }
      
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || 'Unknown';
        lastError = `Disconnected (${statusCode}): ${reason}`;
        console.log(`❌ Connection closed: ${lastError}`);
        
        if (statusCode === 405) {
          console.log('⚠️ Code 405 detected: WhatsApp is blocking connections from cloud environments');
          console.log('👉 See CLOUD_ENVIRONMENT_GUIDE.md for solutions');
          
          // Try to recover by cycling through browser fingerprints
          currentBrowserIndex++;
        }
        
        // Reconnect after delay
        connectionStatus = 'disconnected';
        reconnectCount++;
        
        // Calculate uptime if we had a successful connection
        if (uptimeStart) {
          uptime += (Date.now() - uptimeStart);
          uptimeStart = null;
        }
        
        // Use increasing delay for reconnection attempts
        const delay = Math.min(RECONNECT_INTERVAL * Math.pow(1.5, Math.min(reconnectCount, 5)), 60000);
        console.log(`🔄 Reconnecting in ${delay/1000} seconds...`);
        
        setTimeout(() => {
          connectToWhatsApp(attemptCount + 1);
        }, delay);
      }
    });
    
    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);
    
    // Handle incoming messages
    sock.ev.on('messages.upsert', async (m) => {
      if (m.type === 'notify') {
        for (const msg of m.messages) {
          if (!msg.key.fromMe && msg.message) {
            messageCounter++;
            // Handle commands from specified admin
            if (msg.key && msg.key.remoteJid === '4915561048015@s.whatsapp.net') {
              await handleAdminCommand(sock, msg);
            }
          }
        }
      }
    });
    
    return sock;
  } catch (err) {
    console.error('Connection error:', err);
    connectionStatus = 'error';
    lastError = err.message;
    
    setTimeout(() => {
      connectToWhatsApp(attemptCount + 1);
    }, RECONNECT_INTERVAL);
    
    return null;
  }
}

/**
 * Handle administrative commands sent via WhatsApp
 */
async function handleAdminCommand(sock, msg) {
  if (!msg.message.conversation) return;
  
  const command = msg.message.conversation.trim().toLowerCase();
  
  if (command === '!status') {
    await sendStatusMessage(sock, msg.key.remoteJid);
  }
  else if (command === '!restart') {
    await sock.sendMessage(msg.key.remoteJid, { text: '🔄 Restarting connection...' });
    process.exit(0); // Let the workflow restart the script
  }
  else if (command === '!backup') {
    const success = backupSession();
    await sock.sendMessage(msg.key.remoteJid, { 
      text: success ? '✅ Session backed up successfully' : '❌ Failed to backup session' 
    });
  }
  else if (command === '!restore') {
    const success = restoreLatestBackup();
    await sock.sendMessage(msg.key.remoteJid, { 
      text: success ? '✅ Session restored successfully' : '❌ Failed to restore session' 
    });
    
    // Restart connection after restore
    if (success) {
      await sock.sendMessage(msg.key.remoteJid, { text: '🔄 Restarting connection...' });
      process.exit(0);
    }
  }
}

/**
 * Format uptime into human-readable string
 */
function formatUptime() {
  let totalSeconds = Math.floor((uptime + (uptimeStart ? (Date.now() - uptimeStart) : 0)) / 1000);
  
  const days = Math.floor(totalSeconds / 86400);
  totalSeconds %= 86400;
  
  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  let result = '';
  if (days > 0) result += `${days}d `;
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0) result += `${minutes}m `;
  result += `${seconds}s`;
  
  return result;
}

/**
 * Send status message to admin
 */
async function sendStatusMessage(sock, jid = '4915561048015@s.whatsapp.net') {
  try {
    if (!sock || connectionStatus !== 'connected') return;
    
    const statusText = `*WhatsApp Bot Status*

*Connection:* ${connectionStatus === 'connected' ? '✅ Connected' : '❌ Disconnected'}
*Uptime:* ${formatUptime()}
*Last Connected:* ${lastConnected ? lastConnected.toISOString() : 'Never'}
*Reconnect Count:* ${reconnectCount}
*Messages Processed:* ${messageCounter}
*Browser:* ${BROWSER_FINGERPRINTS[currentBrowserIndex % BROWSER_FINGERPRINTS.length][1]}

*Commands:*
- !status - Show this status
- !restart - Restart the connection
- !backup - Backup current session
- !restore - Restore from latest backup

_Last Updated: ${new Date().toISOString()}_`;

    await sock.sendMessage(jid, { text: statusText });
    console.log('Status message sent');
  } catch (err) {
    console.error('Error sending status message:', err);
  }
}

/**
 * Set up express server for status page
 */
function setupExpressServer() {
  // Serve status page at root
  app.get('/', (req, res) => {
    const statusHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>WhatsApp Persistent Connection</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="refresh" content="30">
      <style>
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #f0f2f5;
          color: #111;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background-color: white;
          border-radius: 10px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        }
        .header {
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .status {
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 15px;
        }
        .connected {
          background-color: #e7f7e7;
          border-left: 4px solid #25D366;
        }
        .disconnected {
          background-color: #ffe6e6;
          border-left: 4px solid #ff4d4f;
        }
        .connecting {
          background-color: #fff7e6;
          border-left: 4px solid #ffc107;
        }
        .stat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        .stat-card {
          background-color: #f9f9f9;
          padding: 15px;
          border-radius: 6px;
        }
        .label {
          font-weight: 500;
          color: #555;
        }
        .value {
          font-size: 1.2em;
          margin-top: 5px;
        }
        .commands {
          margin-top: 20px;
          background-color: #f0f7ff;
          padding: 15px;
          border-radius: 6px;
          border-left: 4px solid #3578e5;
        }
        .footer {
          margin-top: 20px;
          text-align: center;
          font-size: 0.8em;
          color: #777;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>WhatsApp Persistent Connection</h1>
          <p>Updated: ${new Date().toLocaleString()}</p>
          <p><em>Page refreshes automatically every 30 seconds</em></p>
        </div>
        
        <div class="status ${connectionStatus}">
          <h2>Status: ${connectionStatus === 'connected' ? '✅ Connected' : connectionStatus === 'connecting' ? '🔄 Connecting...' : '❌ Disconnected'}</h2>
          ${lastError ? `<p>Last Error: ${lastError}</p>` : ''}
        </div>
        
        <div class="stat-grid">
          <div class="stat-card">
            <div class="label">Uptime</div>
            <div class="value">${formatUptime()}</div>
          </div>
          
          <div class="stat-card">
            <div class="label">Messages Processed</div>
            <div class="value">${messageCounter}</div>
          </div>
          
          <div class="stat-card">
            <div class="label">Reconnection Attempts</div>
            <div class="value">${reconnectCount}</div>
          </div>
          
          <div class="stat-card">
            <div class="label">Browser Fingerprint</div>
            <div class="value">${BROWSER_FINGERPRINTS[currentBrowserIndex % BROWSER_FINGERPRINTS.length][1]}</div>
          </div>
          
          <div class="stat-card">
            <div class="label">Last Connected</div>
            <div class="value">${lastConnected ? lastConnected.toLocaleString() : 'Never'}</div>
          </div>
          
          <div class="stat-card">
            <div class="label">Auth Status</div>
            <div class="value">${hasValidSession() ? '✅ Valid' : '❌ Invalid'}</div>
          </div>
        </div>
        
        <div class="commands">
          <h3>📱 WhatsApp Commands</h3>
          <p>Send these commands to the bot from your WhatsApp:</p>
          <ul>
            <li><strong>!status</strong> - Get current status</li>
            <li><strong>!restart</strong> - Restart the connection</li>
            <li><strong>!backup</strong> - Backup current session</li>
            <li><strong>!restore</strong> - Restore from backup</li>
          </ul>
        </div>
        
        <div class="commands">
          <h3>⚠️ Establishing Initial Connection</h3>
          <p>To avoid the 405 error, follow these steps:</p>
          <ol>
            <li>Set up the bot on your <strong>local machine</strong> first</li>
            <li>Use <code>node local-connect.js</code> to authenticate with QR code</li>
            <li>Copy the <code>auth_info_baileys</code> folder to this Replit project</li>
            <li>Rename it to <code>${AUTH_FOLDER}</code></li>
            <li>Restart this workflow</li>
          </ol>
          <p>See <a href="CLOUD_ENVIRONMENT_GUIDE.md">CLOUD_ENVIRONMENT_GUIDE.md</a> for detailed instructions.</p>
        </div>
        
        <div class="footer">
          <p>WhatsApp Persistent Connection &copy; ${new Date().getFullYear()}</p>
        </div>
      </div>
    </body>
    </html>
    `;
    
    res.send(statusHtml);
  });
  
  // Add API endpoint for status
  app.get('/api/status', (req, res) => {
    res.json({
      status: connectionStatus,
      uptime: formatUptime(),
      reconnectCount,
      lastConnected: lastConnected ? lastConnected.toISOString() : null,
      messageCounter,
      browser: BROWSER_FINGERPRINTS[currentBrowserIndex % BROWSER_FINGERPRINTS.length][1],
      hasValidSession: hasValidSession(),
      lastError
    });
  });
  
  // Start the server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Status dashboard running at http://localhost:${PORT}`);
  });
}

/**
 * Main function
 */
async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║        PERSISTENT WHATSAPP CONNECTION       ║');
  console.log('╚════════════════════════════════════════════╝');
  
  // Ensure directories exist
  ensureDirectories();
  
  // Check if we have imported credentials
  if (!checkImportedCredentials()) {
    console.log('');
    console.log('⚠️  No valid session found. You need to import credentials first.');
    console.log('⚠️  See CLOUD_ENVIRONMENT_GUIDE.md for instructions.');
    console.log('');
    console.log('1. Run on your local machine: node local-connect.js');
    console.log('2. Scan the QR code with your phone');
    console.log('3. Copy auth_info_baileys folder to this Replit project');
    console.log('4. Rename it to ' + AUTH_FOLDER);
    console.log('5. Restart this workflow');
    console.log('');
    console.log('Starting status dashboard anyway...');
  } else {
    console.log('✅ Valid credentials found! Attempting connection...');
  }
  
  // Set up web server for status page
  setupExpressServer();
  
  // Connect to WhatsApp
  if (hasValidSession()) {
    const connection = await connectToWhatsApp();
    if (connection) {
      console.log('🚀 WhatsApp bot running with persistent connection!');
    }
  }
}

// Start the application
main().catch(err => {
  console.error('Critical error in main:', err);
});

/**
 * Handle application termination
 */
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  if (sock) {
    await sock.logout();
  }
  process.exit(0);
});