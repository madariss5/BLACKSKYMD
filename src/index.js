/**
 * BLACKSKY-MD WhatsApp Bot - Main Entry Point
 * Using @whiskeysockets/baileys with enhanced connection persistence
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

// Import handlers and utilities
const handler = require('./handlers/simpleMessageHandler');
const { handleError } = require('./utils/error');
const logger = require('./utils/logger');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Global state
let client = null;
let qrCode = null;
let connectionState = 'disconnected';
let reconnectAttempts = 0;
let isReconnecting = false;

// Constants
const SESSION_PATH = path.join(__dirname, '..', 'sessions');
const MAX_RECONNECT_RETRIES = 999999; // Effectively infinite retries
const RECONNECT_INTERVAL = 3000;
const COMMAND_MODULES = [
    './commands/educational',
    './commands/example-with-error-handling',
    './commands/basic',
    './commands/owner',
    './commands/utility'
];

// Ensure session directory exists
if (!fs.existsSync(SESSION_PATH)) {
    fs.mkdirSync(SESSION_PATH, { recursive: true });
}

// Initialize command modules
async function initializeCommands() {
    try {
        logger.info('Initializing command modules...');
        await handler.init();
        logger.info('Main handler initialized');

        for (const modulePath of COMMAND_MODULES) {
            try {
                const module = require(modulePath);
                if (typeof module.init === 'function') {
                    await module.init();
                    logger.info(`Initialized command module: ${modulePath}`);
                }
            } catch (err) {
                logger.warn(`Failed to load command module ${modulePath}:`, err.message);
            }
        }

        logger.info('All command modules initialized');
        return true;
    } catch (err) {
        logger.error('Error initializing commands:', err);
        return false;
    }
}

// Enhanced connection manager
async function startWhatsAppClient(forceReconnect = false) {
    if (isReconnecting && !forceReconnect) {
        logger.info('Already attempting to reconnect...');
        return;
    }

    try {
        logger.info('Starting WhatsApp client...');
        logger.info('Session path:', SESSION_PATH);
        connectionState = 'connecting';
        isReconnecting = true;

        // Initialize commands before starting client
        await initializeCommands();

        const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);

        // Create WhatsApp socket with enhanced persistence
        client = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: logger.child({ level: 'silent' }),
            browser: ['BLACKSKY-Bot', 'Chrome', '108.0.0'],
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 15000, // Send keep-alive every 15 seconds
            retryRequestDelayMs: 2000,
            defaultQueryTimeoutMs: 60000,
            markOnlineOnConnect: true, // Stay online
            syncFullHistory: false,
            throwOnError: false, // Don't throw on non-fatal errors
        });

        // Enhanced connection monitoring
        client.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            logger.debug('Connection update:', update);

            if (qr) {
                logger.info('New QR code received');
                qrCode = qr;
                connectionState = 'qr_ready';
                reconnectAttempts = 0;
            }

            if (connection === 'open') {
                logger.info('Connection established successfully!');
                connectionState = 'connected';
                isReconnecting = false;
                qrCode = null;
                reconnectAttempts = 0;

                // Backup credentials after successful connection
                try {
                    const SessionManager = require('./utils/sessionManager');
                    const sessionManager = new SessionManager();
                    await sessionManager.backupCredentials();
                    logger.info('Initial credentials backup completed');
                } catch (backupErr) {
                    logger.error('Failed to create initial credentials backup:', backupErr);
                }

                // Initialize message handler with error boundary
                client.ev.on('messages.upsert', async (m) => {
                    if (m.type === 'notify') {
                        try {
                            const msg = m.messages[0];

                            // Check if message is a credentials backup
                            if (msg?.message?.text) {
                                try {
                                    const data = JSON.parse(msg.message.text);
                                    if (data.type === 'BOT_CREDENTIALS_BACKUP') {
                                        const SessionManager = require('./utils/sessionManager');
                                        const sessionManager = new SessionManager();
                                        await sessionManager.handleCredentialsBackup(msg.message);
                                        return; // Skip regular message handling for backup messages
                                    }
                                } catch (parseErr) {
                                    // Not a JSON message or not a backup, continue with normal handling
                                }
                            }

                            await handler.messageHandler(client, msg);
                        } catch (err) {
                            logger.error('Message handling error:', err);
                            try {
                                const remoteJid = m.messages[0].key.remoteJid;
                                await handleError(
                                    client,
                                    remoteJid,
                                    err,
                                    'Error processing command'
                                );
                            } catch (sendErr) {
                                logger.error('Error sending error message:', sendErr);
                            }
                        }
                    }
                });

                // Periodic connection check
                setInterval(() => {
                    if (client?.ws?.readyState !== client?.ws?.OPEN) {
                        logger.warn('Detected connection issue, initiating reconnection...');
                        startWhatsAppClient(true);
                    }
                }, 30000);
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                logger.info('Connection closed. Status:', statusCode);
                connectionState = 'disconnected';
                isReconnecting = false;

                // Aggressive reconnection strategy
                if (shouldReconnect) {
                    reconnectAttempts++;
                    const delay = Math.min(RECONNECT_INTERVAL * Math.pow(1.5, reconnectAttempts - 1), 300000);

                    logger.info(`Reconnecting in ${delay/1000}s (Attempt ${reconnectAttempts})...`);
                    setTimeout(() => startWhatsAppClient(true), delay);
                } else {
                    logger.warn('Logged out. Manual reconnection required.');
                    if (client?.ws) client.ws.close();
                    setTimeout(() => startWhatsAppClient(true), 60000);
                }
            }
        });

        // Handle credentials update
        client.ev.on('creds.update', saveCreds);

    } catch (err) {
        logger.error('Error starting WhatsApp client:', err);
        connectionState = 'error';
        isReconnecting = false;

        // Always attempt to reconnect
        const delay = Math.min(RECONNECT_INTERVAL * Math.pow(1.5, reconnectAttempts), 300000);
        setTimeout(() => startWhatsAppClient(true), delay);
    }
}

// Express route for QR code page
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>WhatsApp Bot QR Code</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        font-family: Arial, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        background: #f0f2f5;
                        padding: 20px;
                    }
                    .container {
                        background: white;
                        padding: 30px;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        max-width: 500px;
                        width: 100%;
                        text-align: center;
                    }
                    h1 { color: #128C7E; }
                    .qr-container {
                        margin: 20px 0;
                        padding: 20px;
                        border: 2px dashed #ddd;
                        display: inline-block;
                        background: white;
                    }
                    #qr-image {
                        max-width: 300px;
                        height: auto;
                    }
                    .status {
                        margin: 20px 0;
                        padding: 10px;
                        border-radius: 5px;
                        font-weight: bold;
                    }
                    .connected { background: #e8f5e9; color: #2e7d32; }
                    .disconnected { background: #fff3e0; color: #ef6c00; }
                    .error { background: #ffebee; color: #c62828; }
                    .loading { 
                        font-size: 1.2em;
                        color: #666;
                        margin: 20px 0;
                        animation: pulse 1.5s infinite;
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
                    <h1>WhatsApp Bot QR Code</h1>
                    <div class="qr-container">
                        <div id="loading" class="loading">Generating QR code...</div>
                        <img id="qr-image" style="display: none;" alt="QR Code">
                    </div>
                    <div id="status" class="status disconnected">
                        Waiting for connection...
                    </div>
                </div>
                <script>
                    function updateQR() {
                        fetch('/status')
                            .then(res => res.json())
                            .then(data => {
                                const status = document.getElementById('status');
                                const loading = document.getElementById('loading');
                                const qrImage = document.getElementById('qr-image');

                                status.textContent = data.message;
                                status.className = 'status ' + data.state;

                                if (data.state === 'qr_ready' && data.qrCode) {
                                    qrImage.src = data.qrCode;
                                    qrImage.style.display = 'block';
                                    loading.style.display = 'none';
                                } else {
                                    qrImage.style.display = 'none';
                                    loading.style.display = 'block';
                                }

                                setTimeout(updateQR, data.state === 'qr_ready' ? 20000 : 3000);
                            })
                            .catch(err => {
                                console.error('Error:', err);
                                setTimeout(updateQR, 3000);
                            });
                    }

                    updateQR();
                </script>
            </body>
        </html>
    `);
});

// Status endpoint with QR code
app.get('/status', (req, res) => {
    res.json({
        state: connectionState,
        message: getStatusMessage(),
        qrCode: qrCode
    });
});

function getStatusMessage() {
    switch (connectionState) {
        case 'connected':
            return 'Connected to WhatsApp! You can close this window.';
        case 'disconnected':
            return 'Disconnected. Waiting for connection...';
        case 'connecting':
            return 'Connecting to WhatsApp...';
        case 'qr_ready':
            return 'Please scan the QR code with WhatsApp';
        case 'error':
            return 'Error connecting to WhatsApp. Retrying...';
        default:
            return 'Initializing...';
    }
}

// Start server and WhatsApp client
app.listen(PORT, '0.0.0.0', async () => {
    logger.info(`Server running on port ${PORT}`);
    await startWhatsAppClient();
});

// Handle process signals
process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM signal');
    // Instead of shutting down, attempt to reconnect
    if (client?.ws?.readyState !== client?.ws?.OPEN) {
        await startWhatsAppClient(true);
    }
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT signal');
    // Instead of shutting down, attempt to reconnect
    if (client?.ws?.readyState !== client?.ws?.OPEN) {
        await startWhatsAppClient(true);
    }
});

// Add error handlers to prevent crashes
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    // Attempt recovery
    if (client?.ws?.readyState !== client?.ws?.OPEN) {
        startWhatsAppClient(true);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Attempt recovery
    if (client?.ws?.readyState !== client?.ws?.OPEN) {
        startWhatsAppClient(true);
    }
});

module.exports = { app, startWhatsAppClient };