/**
 * BLACKSKY-MD WhatsApp Bot - Main Entry Point
 * Using @whiskeysockets/baileys for better compatibility
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

// Constants
const SESSION_PATH = path.join(__dirname, '..', 'sessions');
const MAX_RETRIES = 5;
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

        // Initialize the main handler first
        await handler.init();
        logger.info('Main handler initialized');

        // Load additional command modules
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

// Initialize WhatsApp client
async function startWhatsAppClient() {
    try {
        logger.info('Starting WhatsApp client...');
        logger.info('Session path:', SESSION_PATH);
        connectionState = 'connecting';

        // Initialize commands before starting client
        await initializeCommands();

        const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);

        // Create WhatsApp socket with minimal configuration
        client = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: logger.child({ level: 'silent' }),
            browser: ['BLACKSKY-Bot', 'Chrome', '108.0.0'],
            connectTimeoutMs: 60000,
            qrTimeout: 60000
        });

        // Handle connection updates
        client.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            logger.debug('Connection update:', update);

            if (qr) {
                logger.info('New QR code received');
                qrCode = qr;
                connectionState = 'qr_ready';
            }

            if (connection === 'open') {
                logger.info('Connection established successfully!');
                connectionState = 'connected';
                qrCode = null;

                // Handle incoming messages with error boundary
                client.ev.on('messages.upsert', async (m) => {
                    if (m.type === 'notify') {
                        try {
                            const msg = m.messages[0];
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
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                logger.info('Connection closed. Reason:', lastDisconnect?.error?.message);
                connectionState = 'disconnected';

                if (shouldReconnect) {
                    logger.info('Attempting to reconnect...');
                    setTimeout(startWhatsAppClient, 5000);
                }
            }
        });

        // Handle credentials update
        client.ev.on('creds.update', saveCreds);

    } catch (err) {
        logger.error('Error starting WhatsApp client:', err);
        connectionState = 'error';
        setTimeout(startWhatsAppClient, 5000);
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

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('Shutting down...');
    if (client) {
        await client.end();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    if (client) {
        await client.end();
    }
    process.exit(0);
});

module.exports = { app, startWhatsAppClient };