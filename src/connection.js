/**
 * Enhanced WhatsApp Connection Manager
 * Implements robust connection handling with proper cleanup and state management
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const logger = require('./utils/logger');
const SessionManager = require('./utils/sessionManager');
const qrcode = require('qrcode');
const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);

// Initialize session manager
const sessionManager = new SessionManager();

// Connection state tracking
let sock = null;
let connectionState = {
    isConnecting: false,
    isConnected: false,
    hasQR: false,
    retryCount: 0,
    lastRetryTimestamp: 0
};

// Constants
const MAX_RETRIES = 5;
const MIN_RETRY_INTERVAL = 10000; // 10 seconds
const MAX_RETRY_INTERVAL = 300000; // 5 minutes
const AUTH_FOLDER = 'auth_info_baileys';
let qrPort = 5006;
let latestQR = null;
let messageHandler = null;

// Import the message handler dynamically to avoid circular dependencies
try {
    const { messageHandler: handler } = require('./handlers/messageHandler');
    messageHandler = handler;
} catch (err) {
    logger.warn('Message handler not loaded yet, will try later');
}


// Enhanced connection configuration
const connectionConfig = {
    printQRInTerminal: true,
    logger: pino({ 
        level: 'silent',
        transport: {
            target: 'pino-pretty',
            options: { colorize: true }
        }
    }),
    browser: ['BLACKSKY-MD', 'Chrome', '108.0.0.0'],
    auth: undefined, // Will be set during connection
    version: [2, 2323, 4],
    connectTimeoutMs: 60000,
    qrTimeout: 40000,
    defaultQueryTimeoutMs: 20000,
    customUploadHosts: [],
    retryRequestDelayMs: 250,
    fireInitQueries: false,
    auth: undefined,
    downloadHistory: false,
    markOnlineOnConnect: false
};

// Cleanup all event listeners and connection state
async function cleanup() {
    if (sock) {
        try {
            logger.info('Cleaning up existing connection...');
            sock.ev.removeAllListeners();
            await sock.logout().catch(() => {}); // Ignore logout errors
            sock = null;
        } catch (err) {
            logger.error('Error during cleanup:', err);
        }
    }

    connectionState = {
        isConnecting: false,
        isConnected: false,
        hasQR: false,
        retryCount: 0,
        lastRetryTimestamp: 0
    };
    latestQR = null;
}

// Calculate next retry delay using exponential backoff
function getRetryDelay() {
    const baseDelay = Math.min(
        MIN_RETRY_INTERVAL * Math.pow(2, connectionState.retryCount),
        MAX_RETRY_INTERVAL
    );
    return baseDelay + Math.random() * 1000; // Add jitter
}

// Handle connection state updates
async function handleConnectionUpdate(update, saveCreds) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
        connectionState.hasQR = true;
        await displayQR(qr);
    }

    if (connection === 'open') {
        connectionState.isConnected = true;
        connectionState.isConnecting = false;
        connectionState.retryCount = 0;
        logger.info('Connection established successfully');

        // Save credentials
        await saveCreds();

        // Send credentials backup after connection stabilizes
        setTimeout(async () => {
            if (connectionState.isConnected) {
                try {
                    await sessionManager.sendCredentialsToSelf();
                    logger.info('Credentials backup sent successfully');
                } catch (err) {
                    logger.error('Failed to send credentials backup:', err);
                }
            }
        }, 5000);

        //Handle messages after connection is established.
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (!connectionState.isConnected || type !== 'notify') return;

            for (const message of messages) {
                try {
                    // Handle credentials backup messages and other messages
                    await messageHandler(sock, message);
                    await sessionManager.handleCredentialsBackup(message, sock);
                } catch (err) {
                    logger.error('Error handling message:', err);
                }
            }
        });

    }

    if (connection === 'close') {
        connectionState.isConnected = false;
        const error = lastDisconnect?.error;
        const statusCode = error?.output?.statusCode;

        // Don't retry on logout
        if (statusCode === DisconnectReason.loggedOut) {
            logger.info('Connection closed - logged out');
            await cleanup();
            process.exit(0);
            return;
        }

        // Handle retries
        if (connectionState.retryCount < MAX_RETRIES) {
            connectionState.retryCount++;
            const delay = getRetryDelay();
            logger.info(`Connection attempt ${connectionState.retryCount} of ${MAX_RETRIES} in ${delay/1000}s`);

            setTimeout(async () => {
                await cleanup();
                await startConnection();
            }, delay);
        } else {
            logger.error('Max retries reached, exiting...');
            await cleanup();
            process.exit(1);
        }
    }
}

// Start or restart connection
async function startConnection() {
    if (connectionState.isConnecting) {
        logger.warn('Connection already in progress, skipping...');
        return;
    }

    try {
        connectionState.isConnecting = true;

        // Ensure clean state
        await cleanup();

        // Initialize auth state
        const authFolder = path.join(process.cwd(), AUTH_FOLDER);
        if (!fs.existsSync(authFolder)) {
            fs.mkdirSync(authFolder, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(authFolder);
        connectionConfig.auth = state;

        // Create socket with enhanced config
        sock = makeWASocket(connectionConfig);

        // Set up connection handler
        sock.ev.on('connection.update', (update) => handleConnectionUpdate(update, saveCreds));

        // Handle credential updates
        sock.ev.on('creds.update', saveCreds);

        return sock;
    } catch (err) {
        logger.error('Error in startConnection:', err);
        connectionState.isConnecting = false;

        if (connectionState.retryCount < MAX_RETRIES) {
            const delay = getRetryDelay();
            setTimeout(startConnection, delay);
        } else {
            logger.error('Max retries reached in error handler');
            process.exit(1);
        }
    }
}

// Handle graceful shutdown
async function handleShutdown() {
    logger.info('Shutting down...');
    await cleanup();
    process.exit(0);
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

// Export connection manager
module.exports = {
    startConnection,
    cleanup,
    getConnectionState: () => ({ ...connectionState })
};

app.get('/', (req, res) => {
    // Create dynamic status message based on state
    let statusMessage = "Please scan the QR code with WhatsApp to connect";
    let statusClass = "";
    
    if (sessionInvalidated) {
        statusMessage = "Session reset. Preparing new QR code...";
        statusClass = "reconnecting";
    }
    
    res.send(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>WhatsApp Bot QR Code</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        display: flex; 
                        flex-direction: column;
                        align-items: center; 
                        justify-content: center; 
                        min-height: 100vh; 
                        margin: 0;
                        font-family: Arial, sans-serif;
                        background: #f0f2f5;
                        padding: 20px;
                        box-sizing: border-box;
                    }
                    .container {
                        text-align: center;
                        max-width: 500px;
                        width: 100%;
                    }
                    .qrcode {
                        padding: 20px;
                        background: white;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        margin: 20px auto;
                        display: inline-block;
                    }
                    .qrcode img {
                        max-width: 100%;
                        height: auto;
                        display: block;
                    }
                    h1 { color: #128C7E; margin-bottom: 5px; }
                    h2 { color: #075E54; font-size: 1.2em; margin-top: 0; }
                    .status { 
                        margin-top: 20px; 
                        padding: 10px;
                        border-radius: 5px;
                        font-weight: bold;
                    }
                    .normal { background-color: #e8f5e9; color: #2e7d32; }
                    .reconnecting { background-color: #fff8e1; color: #ff8f00; }
                    .error { background-color: #ffcccc; color: #d32f2f; }
                    .refresh-button {
                        background-color: #128C7E;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 1em;
                        margin-top: 20px;
                    }
                    .waiting-message {
                        margin: 20px 0;
                        color: #666;
                        font-style: italic;
                    }
                    .instructions {
                        margin-top: 30px;
                        text-align: left;
                        background: white;
                        padding: 20px;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .instructions ol {
                        margin-top: 10px;
                        padding-left: 25px;
                    }
                    .pulse {
                        animation: pulse 2s infinite;
                    }
                    @keyframes pulse {
                        0% { opacity: 1; }
                        50% { opacity: 0.5; }
                        100% { opacity: 1; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>WhatsApp Bot</h1>
                    <h2>QR Code Connection</h2>
                    
                    <div class="status ${statusClass || 'normal'}">
                        ${statusMessage}
                    </div>
                    
                    <div class="qrcode">
                        ${latestQR 
                            ? `<img src="${latestQR}" alt="WhatsApp QR Code">`
                            : `<div class="waiting-message pulse">Generating QR code... Please wait.</div>`
                        }
                    </div>
                    
                    <button class="refresh-button" onclick="location.reload()">Refresh QR Code</button>
                    
                    <div class="instructions">
                        <strong>How to connect:</strong>
                        <ol>
                            <li>Open WhatsApp on your phone</li>
                            <li>Tap Menu ⋮ or Settings ⚙ and select "Linked Devices"</li>
                            <li>Tap on "Link a Device"</li>
                            <li>Point your phone camera at this QR code to scan</li>
                        </ol>
                        <p>The QR code will automatically refresh every 60 seconds. If you don't see a QR code, click the Refresh button.</p>
                    </div>
                </div>
                
                <script>
                    // Auto-refresh if no QR code appears or every 60 seconds
                    const hasQR = ${latestQR ? 'true' : 'false'};
                    
                    if (!hasQR) {
                        // If no QR code, refresh more frequently (10 seconds)
                        setTimeout(() => location.reload(), 10000);
                    } else {
                        // Regular refresh every 60 seconds
                        setTimeout(() => location.reload(), 60000);
                    }
                </script>
            </body>
        </html>
    `);
});

async function displayQR(qr) {
    try {
        // Generate QR code and store it in memory
        latestQR = await qrcode.toDataURL(qr);
        
        // Log with more prominent message
        logger.info(`✅ QR CODE GENERATED SUCCESSFULLY!`);
        logger.info(`👉 Open http://localhost:${qrPort} in your browser to scan`);
        logger.info(`👉 If using Replit, check the QR tab in the web panel`);
        
        // Also output to console for maximum visibility
        console.log(`\n===== WhatsApp QR Code Ready =====`);
        console.log(`QR URL: http://localhost:${qrPort}`);
        console.log(`================================\n`);
        
        return latestQR;
    } catch (err) {
        logger.error('❌ QR code generation failed:', err);
        latestQR = null;
        throw err;
    }
}

let sessionInvalidated = false; // Added to maintain original functionality

server.listen(qrPort, () => {
    logger.info(`Server listening on port ${qrPort}`);
    startConnection();
});