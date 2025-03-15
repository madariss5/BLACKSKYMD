/**
 * BLACKSKY-MD WhatsApp Bot - Main Entry Point
 * Enhanced connection handling and QR display
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const handler = require('./handlers/ultra-minimal-handler');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Configure logger with more detailed output
const logger = pino({
    level: 'debug',
    transport: {
        target: 'pino-pretty',
        options: { 
            colorize: true,
            translateTime: true,
            ignore: 'pid,hostname'
        }
    }
});

// Constants
const AUTH_DIR = './auth_info_baileys';
const MAX_RETRIES = 5;
const RETRY_INTERVAL = 3000;

// Global state
let sock = null;
let qrCode = null;
let connectionState = 'disconnected';
let retryCount = 0;
let isConnecting = false;

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Clear auth state for fresh start
async function clearAuthState() {
    try {
        if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            fs.mkdirSync(AUTH_DIR, { recursive: true });
        }
        logger.info('Auth state cleared successfully');
    } catch (error) {
        logger.error('Error clearing auth state:', error);
    }
}

// Improved connection configuration with latest WhatsApp Web values
const connectionConfig = {
    printQRInTerminal: true,
    browser: ['Chrome (Linux)', '', ''], // More generic browser identification
    logger: logger.child({ level: 'silent' }),
    auth: undefined, // Will be set during connection
    version: [2, 2424, 6], // Updated to latest WhatsApp Web version
    connectTimeoutMs: 60000,
    qrTimeout: 40000,
    defaultQueryTimeoutMs: 30000,
    emitOwnEvents: true,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    retryRequestDelayMs: 2000,
    customUploadHosts: [],
    getMessage: async () => undefined
};

async function startWhatsAppConnection() {
    if (isConnecting) {
        logger.info('Connection attempt already in progress');
        return;
    }

    try {
        isConnecting = true;
        connectionState = 'connecting';
        logger.info('Starting new WhatsApp connection attempt...');

        // Clear auth state on fresh start
        await clearAuthState();

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        connectionConfig.auth = state;

        // Create socket with enhanced config
        sock = makeWASocket(connectionConfig);
        logger.info('Socket created, waiting for connection...');

        // Handle connection updates with enhanced logging
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            logger.debug('Connection update received:', update);

            if (qr) {
                logger.info('New QR code received');
                qrCode = qr;
                connectionState = 'qr_ready';
                retryCount = 0; // Reset retry count when new QR is generated
            }

            if (connection === 'open') {
                logger.info('Connection established successfully!');
                connectionState = 'connected';
                isConnecting = false;
                retryCount = 0;
                qrCode = null; // Clear QR once connected

                // Initialize message handler
                sock.ev.on('messages.upsert', async (m) => {
                    if (m.type === 'notify') {
                        try {
                            await handler.messageHandler(sock, m.messages[0]);
                        } catch (err) {
                            logger.error('Message handling error:', err);
                        }
                    }
                });
            }

            if (connection === 'close') {
                isConnecting = false;
                connectionState = 'disconnected';
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
                logger.warn(`Connection closed. Status code: ${statusCode}, Error: ${errorMessage}`);

                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                                     retryCount < MAX_RETRIES;

                if (shouldReconnect) {
                    retryCount++;
                    const delay = RETRY_INTERVAL * Math.pow(2, retryCount - 1);
                    logger.info(`Reconnecting in ${delay/1000}s (Attempt ${retryCount}/${MAX_RETRIES})`);
                    setTimeout(startWhatsAppConnection, delay);
                } else {
                    logger.error('Max retries reached or logged out, clearing session');
                    await clearAuthState();
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

    } catch (err) {
        logger.error('Fatal error in connection:', err);
        isConnecting = false;
        connectionState = 'error';

        if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = RETRY_INTERVAL * Math.pow(2, retryCount - 1);
            setTimeout(startWhatsAppConnection, delay);
        } else {
            await clearAuthState();
        }
    }
}

// Express routes for QR display
app.get('/', (req, res) => {
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
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>WhatsApp Bot QR Code</h1>
                    <div class="qr-container">
                        <img id="qr" src="/qr" alt="QR Code" style="max-width: 300px">
                    </div>
                    <div id="status" class="status">
                        Status: ${connectionState}
                    </div>
                </div>
                <script>
                    setInterval(() => {
                        fetch('/status')
                            .then(res => res.json())
                            .then(data => {
                                const status = document.getElementById('status');
                                status.textContent = 'Status: ' + data.state;
                                status.className = 'status ' + data.state;

                                if (data.state === 'qr_ready') {
                                    document.getElementById('qr').src = '/qr?t=' + Date.now();
                                }
                            });
                    }, 3000);
                </script>
            </body>
        </html>
    `);
});

app.get('/qr', async (req, res) => {
    if (qrCode) {
        try {
            const qrImage = await qrcode.toBuffer(qrCode);
            res.type('png').send(qrImage);
        } catch (err) {
            res.status(500).send('Error generating QR code');
        }
    } else {
        res.status(404).send('QR code not available');
    }
});

app.get('/status', (req, res) => {
    res.json({ state: connectionState });
});

// Start server and connection
app.listen(PORT, '0.0.0.0', async () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info('Starting WhatsApp connection...');
    await startWhatsAppConnection();
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('Shutting down...');
    if (sock) {
        try {
            await sock.logout();
            await clearAuthState();
        } catch (err) {
            logger.error('Shutdown error:', err);
        }
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    if (sock) {
        try {
            await sock.logout();
            await clearAuthState();
        } catch (err) {
            logger.error('Shutdown error:', err);
        }
    }
    process.exit(0);
});

module.exports = { app, startWhatsAppConnection };