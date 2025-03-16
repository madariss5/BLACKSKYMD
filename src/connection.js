/**
 * Stable WhatsApp Connection Manager
 * Based on proven connection patterns from terminal-qr.js
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const logger = require('./utils/logger');
const SessionManager = require('./utils/sessionManager');

// Global state management
let sock = null;
let isConnecting = false;
let hasSession = false;
const AUTH_FOLDER = 'auth_info_baileys';
const sessionManager = new SessionManager();

// Import message handler
let messageHandler = null;
try {
    const { messageHandler: handler } = require('./handlers/messageHandler');
    messageHandler = handler;
} catch (err) {
    logger.warn('Message handler not loaded yet');
}

// Browser configuration - Using Safari which has proven more stable
const browserConfig = {
    browser: ['BLACKSKY-MD', 'Safari', '17.0'],
    browserDescription: ['Safari on Mac', 'Desktop', '17.0'],
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
};

// Enhanced connection configuration
const connectionConfig = {
    ...browserConfig,
    printQRInTerminal: true,
    logger: pino({ level: 'silent' }),
    auth: undefined,
    version: [2, 2323, 4],
    connectTimeoutMs: 60000,
    qrTimeout: 40000,
    defaultQueryTimeoutMs: 20000,
    customUploadHosts: [],
    retryRequestDelayMs: 250,
    fireInitQueries: false,
    downloadHistory: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: false,
    markOnlineOnConnect: false,
    emitOwnEvents: false
};

// Clean up connection and state
async function cleanup() {
    try {
        if (sock) {
            logger.info('Cleaning up connection...');
            // Remove all listeners first
            sock.ev.removeAllListeners('connection.update');
            sock.ev.removeAllListeners('messages.upsert');
            sock.ev.removeAllListeners('creds.update');

            // Then attempt graceful logout
            try {
                await sock.logout();
            } catch (logoutErr) {
                logger.warn('Logout error:', logoutErr);
            }

            sock = null;
        }
        isConnecting = false;
    } catch (err) {
        logger.error('Cleanup error:', err);
        sock = null;
        isConnecting = false;
    }
}

// Main connection function
async function startConnection() {
    if (isConnecting) {
        logger.warn('Connection attempt already in progress...');
        return;
    }

    try {
        isConnecting = true;
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

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                logger.info('Connection established successfully');
                isConnecting = false;
                hasSession = true;

                // Save credentials
                await saveCreds();

                // Send credentials backup after connection stabilizes
                setTimeout(async () => {
                    try {
                        if (sock?.user) {  // Check if still connected
                            await sessionManager.sendCredentialsToSelf();
                            logger.info('Credentials backup sent successfully');
                        }
                    } catch (err) {
                        logger.error('Failed to send credentials backup:', err);
                    }
                }, 5000);

                // Handle messages
                const handleMessage = async ({ messages, type }) => {
                    if (type !== 'notify' || !messageHandler) return;

                    for (const message of messages) {
                        try {
                            await messageHandler(sock, message);
                            await sessionManager.handleCredentialsBackup(message, sock);
                        } catch (err) {
                            logger.error('Message handling error:', err);
                        }
                    }
                };

                // Add message handler
                sock.ev.on('messages.upsert', handleMessage);
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                logger.info(`Connection closed. Status code: ${statusCode}`);

                if (statusCode === DisconnectReason.loggedOut || 
                    statusCode === DisconnectReason.connectionReplaced) {
                    logger.info('Session ended:', statusCode === DisconnectReason.loggedOut ? 'Logged out' : 'Replaced');
                    hasSession = false;
                    await cleanup();
                    process.exit();
                    return;
                }

                // For other disconnections, wait a bit and try reconnecting once
                setTimeout(async () => {
                    await cleanup();
                    await startConnection();
                }, 3000);
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

        return sock;
    } catch (err) {
        logger.error('Connection error:', err);
        isConnecting = false;

        // Single retry after error
        setTimeout(async () => {
            await startConnection();
        }, 3000);
    }
}

// Handle graceful shutdown
async function handleShutdown() {
    logger.info('Shutting down...');
    await cleanup();
    process.exit(0);
}

// Setup shutdown handlers
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

// Start connection
startConnection().catch(err => {
    logger.error('Fatal error:', err);
    process.exit(1);
});

module.exports = {
    startConnection,
    cleanup
};

const qrcode = require('qrcode');
const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);

// Constants
let qrPort = 5006;
let latestQR = null;


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