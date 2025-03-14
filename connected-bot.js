/**
 * Unified WhatsApp Bot with Web QR Interface
 * Combines the QR web display and bot functionality in a single process
 */

require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

// Import message handlers
const { messageHandler, init: initMessageHandler } = require('./src/handlers/messageHandler');

// Import JID helper functions
const { safeSendMessage, safeSendText } = require('./src/utils/jidHelper');

// Configure options based on environment variables
const AUTH_DIR = process.env.AUTH_DIR || 'auth_info_qr';
const SESSION_DIR = path.join(__dirname, AUTH_DIR);
const BACKUP_DIR = path.join(__dirname, 'sessions');
const QR_PORT = 5000;  // For the QR web interface
const API_PORT = 5001; // For bot API endpoints

// Set up pino logger properly
const logger = pino({
    level: 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    }
});

// Initialize express app for QR display
const qrApp = express();
qrApp.use(express.static('public'));

// Initialize express app for API
const apiApp = express();
apiApp.use(express.json());

// Global variables
let sock = null;
let startTime = Date.now();
let lastQR = null;
let connectionState = {
    state: 'disconnected',  // disconnected, connecting, qr_ready, connected
    message: 'Waiting for QR code scan',
    qrCode: null,
    uptime: 0,
    connected: false,
    disconnectReason: null
};

let qrCount = 0;
let backupInterval = null;

// Add retry configuration
const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 2000,
  maxDelay: 60000
};

// Create public directory if it doesn't exist
if (!fs.existsSync('public')) {
    fs.mkdirSync('public', { recursive: true });
}

// Create HTML file for QR code display
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp QR Code</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #f0f0f0;
            padding: 20px;
            box-sizing: border-box;
        }
        .container {
            background-color: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 600px;
            width: 100%;
        }
        h1 {
            color: #128C7E; /* WhatsApp green */
        }
        .qr-container {
            margin: 20px 0;
            padding: 15px;
            border: 2px dashed #ddd;
            border-radius: 8px;
            background-color: white;
            display: inline-block;
        }
        .status {
            margin: 20px 0;
            padding: 10px;
            border-radius: 5px;
            font-weight: bold;
        }
        .connected {
            background-color: #DFF2BF;
            color: #4F8A10;
        }
        .disconnected {
            background-color: #FEEFB3;
            color: #9F6000;
        }
        .error {
            background-color: #FFD2D2;
            color: #D8000C;
        }
        .instructions {
            text-align: left;
            margin: 20px 0;
            background-color: #e9f7fe;
            padding: 15px;
            border-radius: 5px;
            color: #3a87ad;
        }
        img {
            max-width: 100%;
            height: auto;
        }
        .timer {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>BLACKSKY-MD WhatsApp QR Code</h1>
        <div class="instructions">
            <h3>Anleitung:</h3>
            <ol>
                <li>Öffne WhatsApp auf deinem Smartphone</li>
                <li>Tippe auf Einstellungen oder Menü und wähle "Verknüpfte Geräte"</li>
                <li>Tippe auf "Gerät verknüpfen"</li>
                <li>Scanne den QR-Code mit deinem Smartphone</li>
            </ol>
        </div>
        <div class="qr-container">
            <img id="qrcode" src="/qrcode.png" alt="QR Code">
            <div class="timer">Der QR-Code aktualisiert sich automatisch alle 20 Sekunden</div>
        </div>
        <div id="status" class="status disconnected">
            Status: Warte auf Scan des QR-Codes...
        </div>
    </div>

    <script>
        // Auto-refresh the QR code image every 5 seconds
        setInterval(() => {
            const img = document.getElementById('qrcode');
            const timestamp = new Date().getTime();
            img.src = '/qrcode.png?t=' + timestamp;
            
            // Also check connection status
            fetch('/status')
                .then(response => response.json())
                .then(data => {
                    const statusElement = document.getElementById('status');
                    statusElement.textContent = 'Status: ' + data.message;
                    
                    // Remove old classes
                    statusElement.classList.remove('connected', 'disconnected', 'error');
                    
                    // Add appropriate class
                    if (data.state === 'connected') {
                        statusElement.classList.add('connected');
                    } else if (data.state === 'error') {
                        statusElement.classList.add('error');
                    } else {
                        statusElement.classList.add('disconnected');
                    }
                })
                .catch(err => console.error('Error fetching status:', err));
        }, 5000);
    </script>
</body>
</html>
`;

// Write HTML to public directory
fs.writeFileSync('public/index.html', htmlContent);

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt) {
    const delay = Math.min(
        RETRY_CONFIG.maxDelay,
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt)
    );
    return delay + (Math.random() * 1000); // Add jitter
}

/**
 * Clear authentication data
 * @param {boolean} force Whether to force clearing auth data even on temporary disconnections
 */
async function clearAuthData(force = false) {
    try {
        // Check if we should clear auth data
        // Only clear if force=true or on specific disconnect reason
        const shouldClear = force || connectionState.disconnectReason === DisconnectReason.loggedOut;
        
        if (shouldClear) {
            if (fs.existsSync(SESSION_DIR)) {
                fs.rmSync(SESSION_DIR, { recursive: true, force: true });
                fs.mkdirSync(SESSION_DIR, { recursive: true });
            }
            logger.info('Authentication data cleared');
        } else {
            logger.info('Auth data preserved for reconnection attempt');
        }
    } catch (error) {
        logger.error('Error clearing auth data:', error);
    }
}

/**
 * Initialize WhatsApp connection with retry logic
 */
async function connectToWhatsApp(retryCount = 0) {
    try {
        connectionState.state = 'connecting';
        connectionState.message = 'Verbinde mit WhatsApp...';
        logger.info('🟢 Starting WhatsApp authentication...');

        // Ensure session directory exists
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
            logger.info('Created session directory');
        }

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        logger.info('Auth state loaded');

        // Create WhatsApp socket connection with proper logger
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: logger.child({ level: 'silent' }),
            browser: ['𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻', 'Chrome', '121.0.0'],
            connectTimeoutMs: 60000,
            retryRequestDelayMs: 2000,
            defaultQueryTimeoutMs: 60000,
            emitOwnEvents: false,             
            syncFullHistory: false,           
            fireInitQueries: true,            
            markOnlineOnConnect: true,        
            transactionOpts: {                
                maxCommitRetries: 2,            
                delayBetweenTriesMs: 500        
            },
            getMessage: async () => ({ conversation: '' }) 
        });

        logger.info('Socket connection created');

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            logger.debug('Connection update:', update);

            if (qr) {
                lastQR = qr;
                connectionState.state = 'qr_ready';
                connectionState.qrCode = qr;
                connectionState.connected = false;
                connectionState.message = 'QR-Code bereit zum Scannen';
                logger.info('⏳ New QR code generated');
                qrCount++;
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                logger.info(`Connection closed with status code: ${statusCode}`);
                connectionState.state = 'disconnected';
                connectionState.connected = false;
                connectionState.message = `Verbindung getrennt (${statusCode}). Versuche erneut...`;

                const shouldReconnect = (lastDisconnect?.error instanceof Boom)? 
                    lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;

                logger.info('Verbindung wurde geschlossen wegen:', lastDisconnect?.error?.message);

                // Store disconnect reason in state
                connectionState.disconnectReason = statusCode;
                
                // Only clear auth data if we're logged out, otherwise preserve it
                logger.info('Prüfe, ob Auth-Daten für Neuverbindung erhalten werden können...');
                await clearAuthData(false);

                if (shouldReconnect) {
                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        logger.info('Sitzung abgelaufen oder ungültig.');
                        // Sofort neu verbinden nachdem die Daten gelöscht wurden
                        setTimeout(() => connectToWhatsApp(0), 1000);
                    } else if (retryCount < RETRY_CONFIG.maxRetries) {
                        const delay = getRetryDelay(retryCount);
                        logger.info(`Verbindung wird in ${delay/1000} Sekunden erneut versucht... (Versuch ${retryCount + 1}/${RETRY_CONFIG.maxRetries})`);
                        setTimeout(() => connectToWhatsApp(retryCount + 1), delay);
                    } else {
                        logger.info('Maximale Anzahl an Wiederverbindungsversuchen erreicht. Bitte scannen Sie einen neuen QR-Code.');
                        await resetConnection();
                    }
                }
            } else if (connection === 'open') {
                logger.info('🟢 WhatsApp connection established!');
                connectionState.state = 'connected';
                connectionState.connected = true;
                connectionState.message = 'Verbindung hergestellt! Du kannst diese Seite jetzt schließen.';
                retryCount = 0; // Reset retry counter on successful connection
                
                // Send creds to self when connected
                setTimeout(() => sendCredsToSelf(sock), 5000);
            }
        });

        // Handle messages
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type === 'notify') {
                for (const message of messages) {
                    try {
                        await messageHandler(sock, message);
                    } catch (err) {
                        logger.error('Error handling message:', err);
                    }
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

        return sock;
    } catch (error) {
        logger.error('Error in WhatsApp connection:', error);
        throw error;
    }
}

/**
 * Backup session at regular intervals
 */
function setupSessionBackup() {
  // Clear existing interval if it exists
  if (backupInterval) {
    clearInterval(backupInterval);
  }
  
  // Set up new interval (every 5 minutes)
  backupInterval = setInterval(() => {
    try {
      const timestamp = Date.now();
      const backupPath = path.join(BACKUP_DIR, `creds_backup_${timestamp}.json`);
      
      // Copy current auth file
      const authFiles = fs.readdirSync(SESSION_DIR);
      for (const file of authFiles) {
        if (file.includes('creds')) {
          const srcPath = path.join(SESSION_DIR, file);
          fs.copyFileSync(srcPath, backupPath);
          logger.info(`Session backup created: ${backupPath}`);
          break;
        }
      }
      
      // Limit number of backups to 5
      const backups = fs.readdirSync(BACKUP_DIR)
                        .filter(file => file.startsWith('creds_backup_'))
                        .sort();
                        
      if (backups.length > 5) {
        const oldestBackup = path.join(BACKUP_DIR, backups[0]);
        fs.unlinkSync(oldestBackup);
        logger.info(`Removed old backup: ${oldestBackup}`);
      }
    } catch (error) {
      logger.error('Error creating session backup:', error);
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

/**
 * Get current connection status
 */
function getConnectionStatus() {
  connectionState.uptime = getUptime();
  return connectionState;
}

/**
 * Reset the connection state and reconnect
 */
async function resetConnection() {
  try {
    logger.info('🔄 Manually resetting connection...');
    
    // Force disconnect if connected
    if (sock) {
      try {
        sock.ev.removeAllListeners();
        await sock.logout();
      } catch (e) {
        logger.info('Error during logout:', e);
        // Continue anyway
      }
      sock = null;
    }
    
    // Clear authentication data with force=true
    await clearAuthData(true); 
    logger.info('Auth data cleared for fresh start');
    
    // Reset state
    connectionState.state = 'connecting';
    connectionState.qrCode = null;
    connectionState.connected = false;
    
    // Reconnect
    connectToWhatsApp();
    
    return { success: true, message: 'Connection reset and auth data cleared' };
  } catch (error) {
    logger.error('Error resetting connection:', error);
    return { success: false, message: 'Could not reset connection' };
  }
}

/**
 * Get formatted uptime string
 */
function getUptime() {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Send creds.json file to the bot itself for backup
 */
async function sendCredsToSelf(sock) {
    try {
        // Wait for a short time to ensure connection is ready
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check if connected
        if (!sock || !connectionState.connected) {
            logger.warn('Cannot send creds file: Bot not connected');
            return;
        }

        // Check if creds.json exists
        const credsPath = path.join(SESSION_DIR, 'creds.json');
        if (!fs.existsSync(credsPath)) {
            logger.warn('Cannot send creds file: creds.json does not exist');
            return;
        }

        // Read and compress the creds.json file
        const credsData = fs.readFileSync(credsPath, 'utf8');
        const compressedCreds = JSON.stringify(JSON.parse(credsData)).replace(/\s+/g, '');

        // Get bot's own JID
        const botJid = sock.user.id;

        // Send the message with the creds data to the bot itself
        await safeSendMessage(sock, botJid, {
            text: `🔐 *BLACKSKY-MD BACKUP*\n\nHere is your creds.json for backup purposes:\n\n\`\`\`${compressedCreds}\`\`\``
        });
        logger.info('Credentials backup sent to bot itself');
    } catch (error) {
        logger.error('Error sending creds to bot:', error);
    }
}

/**
 * Send deployment notification to the bot owner
 */
async function sendDeploymentNotification(sock) {
    try {
        // Wait for a short time to ensure connection is ready
        await new Promise(resolve => setTimeout(resolve, 6000));

        // Check if connected
        if (!sock || !connectionState.connected) {
            logger.warn('Cannot send deployment notification: Bot not connected');
            return;
        }

        // Get owner number from environment or config
        const ownerNumber = process.env.OWNER_NUMBER;
        if (!ownerNumber) {
            logger.warn('Cannot send deployment notification: Owner number not set in environment');
            return;
        }

        // Format the owner JID properly
        const ownerJid = `${ownerNumber.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

        // Get environment info
        const isHeroku = process.env.NODE_ENV === 'production' || process.env.DYNO;
        const isReplit = process.env.REPL_ID || process.env.REPL_SLUG;
        const env = isHeroku ? 'Heroku' : isReplit ? 'Replit' : 'Local';

        // Send the deployment notification
        await safeSendMessage(sock, ownerJid, {
            text: `🚀 *BLACKSKY-MD DEPLOYED*\n\n✅ Bot has been successfully deployed on ${env}!\n📅 Date: ${new Date().toISOString()}\n⏱️ Uptime: ${getUptime()}\n\n_Type .help for a list of all commands._`
        });
        logger.info('Deployment notification sent to owner');
    } catch (error) {
        logger.error('Error sending deployment notification:', error);
    }
}

// QR web server endpoints
qrApp.get('/qrcode.png', async (req, res) => {
    if (lastQR) {
        try {
            // Convert QR data to PNG buffer
            const qrImage = await qrcode.toBuffer(lastQR);
            res.type('png');
            res.send(qrImage);
        } catch (err) {
            logger.error('Error generating QR image:', err);
            res.status(500).send('Error generating QR code');
        }
    } else {
        // If no QR code is available yet, send a placeholder or error image
        res.status(503).send('QR code not yet available');
    }
});

qrApp.get('/status', (req, res) => {
    res.json(connectionState);
});

// API endpoints
apiApp.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: getUptime(),
        connection: connectionState
    });
});

apiApp.post('/reset', async (req, res) => {
    try {
        const result = await resetConnection();
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error resetting connection',
            error: error.message
        });
    }
});

/**
 * Main application startup
 */
async function start() {
    try {
        logger.info('Starting 𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻...');
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`Process ID: ${process.pid}`);

        // Create required directories
        [SESSION_DIR, BACKUP_DIR].forEach(dir => {
            if (!fs.existsSync(dir)) {
                logger.info(`Creating directory: ${dir}`);
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // Start QR web server
        qrApp.listen(QR_PORT, '0.0.0.0', () => {
            logger.info(`QR web server started on port ${QR_PORT}`);
            
            // Start API server
            apiApp.listen(API_PORT, '0.0.0.0', () => {
                logger.info(`API server started on port ${API_PORT}`);
                
                // Initialize WhatsApp connection after server is ready
                (async () => {
                    try {
                        logger.info('Initializing message handler...');
                        await initMessageHandler();
                        
                        logger.info('Initializing WhatsApp connection...');
                        const socket = await connectToWhatsApp();
                        setupSessionBackup(); // Start backup process
                        
                        // Initialize command modules with the socket
                        try {
                            const commandIndex = require('./src/commands/index');
                            if (commandIndex && typeof commandIndex.initializeModules === 'function') {
                                logger.info('Initializing command modules with socket...');
                                await commandIndex.initializeModules(socket);
                                logger.info('Command modules initialized with socket');
                            }
                        } catch (err) {
                            logger.error('Error initializing command modules with socket:', err);
                        }
                        
                        logger.info('WhatsApp connection initialized');
                    } catch (error) {
                        logger.error('Failed to initialize WhatsApp:', error);
                        process.exit(1);
                    }
                })();
            });
        });

    } catch (error) {
        logger.error('Failed to start application:', error);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    // Don't exit - just log and continue
});

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err);
    // Don't exit - just log and continue
});

// Start application if running directly
if (require.main === module) {
    start().catch((error) => {
        logger.error('Fatal error during startup:', error);
        process.exit(1);
    });
}

module.exports = { connectToWhatsApp, setupSessionBackup, getConnectionStatus, resetConnection, start, sendCredsToSelf };