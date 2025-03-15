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
const BASE_RETRY_INTERVAL = 3000;
const MAX_RETRY_INTERVAL = 30000;

// Global state
let sock = null;
let qrCode = null;
let connectionState = 'disconnected';
let retryCount = 0;
let isConnecting = false;
let connectionMonitorInterval = null;

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

// Calculate retry delay with exponential backoff and jitter
function getRetryDelay() {
    const exponentialDelay = BASE_RETRY_INTERVAL * Math.pow(2, retryCount);
    const withJitter = exponentialDelay + (Math.random() * 1000);
    return Math.min(withJitter, MAX_RETRY_INTERVAL);
}

// Cleanup socket and monitors
function cleanupConnection() {
    if (sock) {
        try {
            sock.ev.removeAllListeners();
            if (sock.ws) sock.ws.close();
            sock = null;
        } catch (err) {
            logger.error('Error during socket cleanup:', err);
        }
    }

    if (connectionMonitorInterval) {
        clearInterval(connectionMonitorInterval);
        connectionMonitorInterval = null;
    }
}

// Improved connection configuration
const connectionConfig = {
    version: [2, 2323, 4],
    printQRInTerminal: true,
    browser: ['Chrome', 'Chrome', '112.0.0'],
    logger: logger.child({ level: 'debug' }),
    connectTimeoutMs: 60000,
    qrTimeout: 40000,
    defaultQueryTimeoutMs: 20000,
    emitOwnEvents: false,
    markOnlineOnConnect: false,
    downloadHistory: false,
    linkPreviewImageThumbnailWidth: 192,
    getMessage: async () => undefined
};

async function startWhatsAppConnection() {
    if (isConnecting) {
        logger.info('Connection attempt already in progress');
        return;
    }

    try {
        cleanupConnection();
        isConnecting = true;
        connectionState = 'connecting';
        logger.info('Starting WhatsApp connection attempt...');

        // Clear auth state for fresh start
        await clearAuthState();

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        connectionConfig.auth = state;

        // Create socket with enhanced config
        sock = makeWASocket(connectionConfig);
        logger.info('Socket created, waiting for connection...');

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            logger.debug('Connection update received:', update);

            if (qr) {
                logger.info('New QR code received');
                qrCode = qr;
                connectionState = 'qr_ready';
                retryCount = 0;
            }

            if (connection === 'open') {
                logger.info('Connection established successfully!');
                connectionState = 'connected';
                isConnecting = false;
                retryCount = 0;
                qrCode = null;
                startConnectionMonitor();

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
                logger.warn(`Connection closed. Status: ${statusCode}, Error: ${errorMessage}`);

                if (statusCode === DisconnectReason.loggedOut || 
                    statusCode === DisconnectReason.multideviceMismatch) {
                    logger.info('Session invalid, clearing auth state...');
                    await clearAuthState();
                    retryCount = 0;
                    setTimeout(startWhatsAppConnection, 5000);
                } else if (statusCode === DisconnectReason.connectionClosed || 
                         statusCode === DisconnectReason.connectionLost ||
                         statusCode === DisconnectReason.connectionReplaced) {
                    if (retryCount < MAX_RETRIES) {
                        retryCount++;
                        const delay = getRetryDelay();
                        logger.info(`Connection lost, retrying in ${delay/1000}s (Attempt ${retryCount}/${MAX_RETRIES})`);
                        setTimeout(startWhatsAppConnection, delay);
                    } else {
                        logger.error('Max retries reached, clearing session');
                        await clearAuthState();
                        retryCount = 0;
                        setTimeout(startWhatsAppConnection, 5000);
                    }
                } else {
                    if (retryCount < MAX_RETRIES) {
                        retryCount++;
                        const delay = getRetryDelay();
                        logger.info(`Unknown error, retrying in ${delay/1000}s (Attempt ${retryCount}/${MAX_RETRIES})`);
                        setTimeout(startWhatsAppConnection, delay);
                    } else {
                        logger.error('Max retries reached, clearing session');
                        await clearAuthState();
                        retryCount = 0;
                        setTimeout(startWhatsAppConnection, 5000);
                    }
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

        // Monitor socket state
        sock.ws.on('open', () => {
            logger.info('WebSocket connection opened');
        });

        sock.ws.on('error', (err) => {
            logger.error('WebSocket error:', err);
        });

        sock.ws.on('close', () => {
            logger.warn('WebSocket closed');
        });

    } catch (err) {
        logger.error('Fatal error in connection:', err);
        isConnecting = false;
        connectionState = 'error';

        if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = getRetryDelay();
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
                        <div id="qr-placeholder" class="loading">Generating QR code...</div>
                        <img id="qr" src="" alt="QR Code" style="max-width: 300px; display: none">
                    </div>
                    <div id="status" class="status disconnected">
                        Status: Waiting for QR code...
                    </div>
                </div>
                <script>
                    function updateQR() {
                        fetch('/status')
                            .then(res => res.json())
                            .then(data => {
                                const status = document.getElementById('status');
                                const qrImg = document.getElementById('qr');
                                const placeholder = document.getElementById('qr-placeholder');

                                status.textContent = 'Status: ' + data.state;
                                status.className = 'status ' + data.state;

                                if (data.state === 'qr_ready') {
                                    qrImg.src = '/qr?t=' + Date.now();
                                    qrImg.style.display = 'block';
                                    placeholder.style.display = 'none';

                                    qrImg.onload = () => setTimeout(updateQR, 20000);
                                    qrImg.onerror = () => {
                                        qrImg.style.display = 'none';
                                        placeholder.style.display = 'block';
                                        setTimeout(updateQR, 3000);
                                    };
                                } else {
                                    qrImg.style.display = 'none';
                                    placeholder.style.display = 'block';
                                    setTimeout(updateQR, 3000);
                                }
                            })
                            .catch(err => {
                                console.error('Error fetching status:', err);
                                setTimeout(updateQR, 3000);
                            });
                    }

                    updateQR();
                </script>
            </body>
        </html>
    `);
});

app.get('/qr', async (req, res) => {
    try {
        if (!qrCode) {
            logger.debug('QR code requested but not available yet');
            res.status(503).send('QR code not yet available');
            return;
        }

        logger.debug('Generating QR code image');
        const qrImage = await qrcode.toBuffer(qrCode);
        res.type('png').send(qrImage);
    } catch (err) {
        logger.error('Error generating QR code:', err);
        res.status(500).send('Error generating QR code');
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