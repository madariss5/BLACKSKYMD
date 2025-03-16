/**
 * Enhanced WhatsApp Connection Manager with Stable Connection Handling
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const logger = require('./utils/logger');
const SessionManager = require('./utils/sessionManager');

// Global state management
let sock = null;
let connectionAttempts = 0;
const MAX_RETRIES = 3;
const RETRY_INTERVAL = 3000;
const AUTH_FOLDER = 'auth_info_baileys';

// Initialize session manager
const sessionManager = new SessionManager();

// Import message handler
let messageHandler = null;
try {
    const { messageHandler: handler } = require('./handlers/messageHandler');
    messageHandler = handler;
} catch (err) {
    logger.warn('Message handler not loaded yet');
}

// Socket configuration
const connectionConfig = {
    printQRInTerminal: true,
    browser: ['BLACKSKY-MD', 'Chrome', '108.0.0.0'],
    version: [2, 2323, 4],
    logger: pino({ level: 'silent' }),
    auth: undefined,
    markOnlineOnConnect: false,
    defaultQueryTimeoutMs: 30000,
    connectTimeoutMs: 60000,
    fireInitQueries: false,
    downloadHistory: false
};

// Clean up existing connection
async function cleanup() {
    if (!sock) return;

    try {
        logger.info('Cleaning up existing connection...');
        sock.ev.removeAllListeners();
        await sock.logout().catch(() => {});
        sock = null;
        logger.info('Cleanup completed');
    } catch (err) {
        logger.error('Cleanup error:', err);
        sock = null;
    }
}

// Main connection function
async function startConnection() {
    try {
        await cleanup();

        // Initialize auth state
        const authFolder = path.join(process.cwd(), AUTH_FOLDER);
        if (!fs.existsSync(authFolder)) {
            fs.mkdirSync(authFolder, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(authFolder);
        connectionConfig.auth = state;

        // Create socket
        sock = makeWASocket(connectionConfig);

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                logger.info('Connection established');
                connectionAttempts = 0;

                // Save credentials
                await saveCreds();

                // Send credentials backup after connection stabilizes
                setTimeout(async () => {
                    try {
                        await sessionManager.sendCredentialsToSelf();
                        logger.info('Credentials backup sent');
                    } catch (err) {
                        logger.error('Failed to send credentials backup:', err);
                    }
                }, 5000);

                // Handle messages
                sock.ev.on('messages.upsert', async ({ messages, type }) => {
                    if (type !== 'notify' || !messageHandler) return;

                    for (const message of messages) {
                        try {
                            await messageHandler(sock, message);
                            await sessionManager.handleCredentialsBackup(message, sock);
                        } catch (err) {
                            logger.error('Message handling error:', err);
                        }
                    }
                });
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect && connectionAttempts < MAX_RETRIES) {
                    connectionAttempts++;
                    logger.info(`Connection attempt ${connectionAttempts}/${MAX_RETRIES}`);

                    setTimeout(async () => {
                        await startConnection();
                    }, RETRY_INTERVAL * connectionAttempts);
                } else {
                    if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
                        logger.info('Connection closed - logged out');
                        process.exit(0);
                    } else {
                        logger.error('Max retries reached');
                        process.exit(1);
                    }
                }
            }
        });

        // Handle credential updates
        sock.ev.on('creds.update', saveCreds);

        return sock;
    } catch (err) {
        logger.error('Connection error:', err);

        if (connectionAttempts < MAX_RETRIES) {
            connectionAttempts++;
            setTimeout(async () => {
                await startConnection();
            }, RETRY_INTERVAL * connectionAttempts);
        } else {
            logger.error('Max retries reached');
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

// Start the connection
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