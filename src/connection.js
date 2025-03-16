const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const pino = require('pino');
const logger = require('./utils/logger');
const express = require('express');
const http = require('http');
const SessionManager = require('./utils/sessionManager');
const app = express();
const server = http.createServer(app);
let messageHandler = null;

// Initialize SessionManager
const sessionManager = new SessionManager();

// Import the message handler dynamically to avoid circular dependencies
try {
    const { messageHandler: handler } = require('./handlers/messageHandler');
    messageHandler = handler;
} catch (err) {
    logger.warn('Message handler not loaded yet, will try later');
}

// Connection state management
let sock = null;
let retryCount = 0;
const MAX_RETRIES = 5;
const INITIAL_RETRY_INTERVAL = 10000;
const MAX_RETRY_INTERVAL = 300000;
let currentRetryInterval = INITIAL_RETRY_INTERVAL;
let qrPort = 5006;
let isConnecting = false;
let connectionLock = false;
let sessionInvalidated = false;
let reconnectTimer = null;
let latestQR = null;

// Enhanced connection configuration
const connectionConfig = {
    printQRInTerminal: true,
    logger: pino({ 
        level: 'warn',
        transport: {
            target: 'pino-pretty',
            options: { colorize: true }
        }
    }),
    // Use a unique browser ID for each connection to prevent conflicts
    browser: [`BLACKSKY-MD-${Date.now().toString().slice(-6)}`, 'Chrome', '110.0.0'],
    // Enhanced connection settings
    connectTimeoutMs: 120000, // Increased timeout
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
    emitOwnEvents: false,
    retryRequestDelayMs: 2000,
    fireInitQueries: true,
    downloadHistory: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: false,
    markOnlineOnConnect: false,
    version: [2, 2323, 4],
    transactionOpts: { 
        maxCommitRetries: 5, 
        delayBetweenTriesMs: 2000 
    }
};

async function startConnection() {
    if (isConnecting || connectionLock) {
        logger.info('Connection attempt already in progress, skipping...');
        return null;
    }

    try {
        isConnecting = true;
        connectionLock = true;

        // Initialize session manager
        await sessionManager.initialize();

        // Ensure auth directory exists
        const authDir = await ensureAuthDir();
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        // Create socket with enhanced config
        sock = makeWASocket({
            ...connectionConfig,
            auth: state
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                await displayQR(qr);
            }

            if (connection === 'open') {
                logger.info('Connection established successfully');
                retryCount = 0;
                currentRetryInterval = INITIAL_RETRY_INTERVAL;
                sessionInvalidated = false;
                clearReconnectTimer();
                await saveCreds();

                // Send credentials backup to self after successful connection
                try {
                    await sessionManager.sendCredentialsToSelf();
                    logger.info('Successfully sent credentials backup to self');
                } catch (err) {
                    logger.error('Failed to send credentials to self:', err);
                }

                // Initialize message handling after successful connection
                sock.ev.on('messages.upsert', async ({ messages, type }) => {
                    if (type === 'notify' && messageHandler) {
                        for (const message of messages) {
                            try {
                                // Pass both sock and message to handler for credential backup support
                                await messageHandler(sock, message);

                                // Check if this is a credentials backup message
                                await sessionManager.handleCredentialsBackup(message, sock);
                            } catch (err) {
                                logger.error('Error handling message:', err);
                            }
                        }
                    }
                });

                isConnecting = false;
                connectionLock = false;
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                logger.info(`Connection closed with status code: ${statusCode}`);

                // Handle critical errors
                if (statusCode === DisconnectReason.loggedOut || 
                    statusCode === DisconnectReason.connectionReplaced ||
                    statusCode === DisconnectReason.connectionClosed ||
                    statusCode === DisconnectReason.connectionLost ||
                    statusCode === DisconnectReason.timedOut ||
                    statusCode === 440) {

                    if (retryCount >= MAX_RETRIES) {
                        logger.error('Max retries reached, clearing session and restarting...');
                        await cleanupSession();
                        process.exit(1);
                        return;
                    }

                    // Implement exponential backoff
                    retryCount++;
                    currentRetryInterval = Math.min(
                        currentRetryInterval * 2,
                        MAX_RETRY_INTERVAL
                    );

                    logger.info(`Scheduling reconnection attempt ${retryCount}/${MAX_RETRIES} in ${currentRetryInterval/1000}s`);

                    clearReconnectTimer();
                    reconnectTimer = setTimeout(async () => {
                        isConnecting = false;
                        connectionLock = false;
                        await startConnection();
                    }, currentRetryInterval);
                } else {
                    // For other errors, attempt immediate reconnection
                    isConnecting = false;
                    connectionLock = false;
                    await startConnection();
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        return sock;
    } catch (err) {
        logger.error('Fatal error in startConnection:', err);

        if (retryCount < MAX_RETRIES) {
            retryCount++;
            currentRetryInterval = Math.min(
                currentRetryInterval * 2,
                MAX_RETRY_INTERVAL
            );

            logger.info(`Retrying connection in ${currentRetryInterval/1000}s`);
            clearReconnectTimer();
            reconnectTimer = setTimeout(async () => {
                isConnecting = false;
                connectionLock = false;
                await startConnection();
            }, currentRetryInterval);
        } else {
            await cleanupSession();
            process.exit(1);
        }
    } finally {
        isConnecting = false;
        connectionLock = false;
    }
}

async function ensureAuthDir() {
    const authDir = path.join(process.cwd(), 'auth_info');
    try {
        await fsPromises.mkdir(authDir, { recursive: true });
        return authDir;
    } catch (err) {
        logger.error('Failed to create auth directory:', err);
        throw err;
    }
}

async function cleanupSession() {
    try {
        const authDir = path.join(process.cwd(), 'auth_info');
        if (fs.existsSync(authDir)) {
            await fsPromises.rm(authDir, { recursive: true, force: true });
            await fsPromises.mkdir(authDir, { recursive: true });
            sessionInvalidated = true;
            logger.info('Session cleaned up successfully');
        }
    } catch (err) {
        logger.error('Error during session cleanup:', err);
    }
}

function clearReconnectTimer() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, cleaning up...');
    clearReconnectTimer();
    if (sock) {
        await sock.logout();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, cleaning up...');
    clearReconnectTimer();
    if (sock) {
        await sock.logout();
    }
    process.exit(0);
});

module.exports = { startConnection };

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