/**
 * BLACKSKY-MD WhatsApp Bot - Main Entry Point
 * Handles server startup and WhatsApp connection with improved error handling
 */

const express = require('express');
const http = require('http');
const { default: makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const handler = require('./handlers/ultra-minimal-handler');
const logger = require('./utils/logger');
const SessionManager = require('./utils/sessionManager');
const path = require('path');
const qrcode = require('qrcode');
const pino = require('pino');

// Initialize Express app and server
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize session manager
const sessionManager = new SessionManager();
let sock = null;
let latestQR = null;
let isConnecting = false;
let connectionLock = false;
let retryCount = 0;
const MAX_RETRIES = 5;

// Connection configuration
const connectionConfig = {
    printQRInTerminal: true,
    logger: pino({ 
        level: 'warn',
        transport: {
            target: 'pino-pretty',
            options: { colorize: true }
        }
    }),
    browser: ['BLACKSKY-MD', 'Firefox', '119.0.0'],
    version: [2, 2323, 4],
    connectTimeoutMs: 120000,
    qrTimeout: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 15000,
    emitOwnEvents: true,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    linkPreviewImageThumbnailWidth: 300,
    transactionOpts: { 
        maxCommitRetries: 5, 
        delayBetweenTriesMs: 2000 
    },
    // Customize user agent
    browser: [`BLACKSKY-MD-${Date.now()}`, 'Chrome', '119.0.0'],
    // WebSocket config
    customUploadHosts: ['upload.whatsapp.net'],
    retryRequestDelayMs: 3000,
    fireInitQueries: true,
    downloadHistory: false
};

// Serve QR code page
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>WhatsApp Bot QR Code</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="refresh" content="30">
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
                    }
                    .qrcode img {
                        max-width: 100%;
                        height: auto;
                    }
                    h1 { color: #128C7E; }
                    .status { 
                        margin: 20px 0;
                        padding: 10px;
                        border-radius: 5px;
                        background: #e8f5e9;
                        color: #2e7d32;
                    }
                    .refresh { 
                        background: #128C7E;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                    }
                    .waiting {
                        color: #666;
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
                    <h1>WhatsApp Bot QR Code</h1>
                    <div class="qrcode">
                        ${latestQR 
                            ? `<img src="${latestQR}" alt="WhatsApp QR Code">`
                            : `<div class="waiting">Generating QR code... Please wait.</div>`
                        }
                    </div>
                    <button class="refresh" onclick="location.reload()">Refresh QR Code</button>
                    <div class="status">
                        Scan this QR code with WhatsApp to connect the bot
                    </div>
                </div>
                <script>
                    // Auto refresh every 30 seconds
                    setTimeout(() => location.reload(), 30000);
                </script>
            </body>
        </html>
    `);
});

// Status endpoint
app.get('/status', (req, res) => {
    res.json({
        connected: sock?.user ? true : false,
        user: sock?.user || null,
        retryCount,
        isConnecting,
        timestamp: Date.now()
    });
});

async function startWhatsAppConnection() {
    if (isConnecting || connectionLock) {
        logger.info('Connection attempt already in progress, skipping...');
        return;
    }

    try {
        isConnecting = true;
        connectionLock = true;

        // Initialize session and handler
        await sessionManager.initialize();
        await handler.init();
        logger.info('Session and handler initialized');

        // Get credentials from session manager
        const config = {
            ...connectionConfig,
            auth: {
                creds: sessionManager.credentialsFile,
                keys: sessionManager.authDir
            }
        };

        // Create socket
        sock = makeWASocket(config);

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            logger.info('Connection update:', update);

            if (qr) {
                try {
                    latestQR = await qrcode.toDataURL(qr);
                    logger.info('New QR code generated');
                } catch (err) {
                    logger.error('QR generation error:', err);
                }
            }

            if (connection === 'open') {
                logger.info('Connection established successfully');
                retryCount = 0;
                isConnecting = false;
                connectionLock = false;
                latestQR = null;

                // Setup message handler
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
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                logger.info(`Connection closed with status code: ${statusCode}`);

                if (statusCode === DisconnectReason.loggedOut ||
                    statusCode === DisconnectReason.connectionClosed ||
                    statusCode === DisconnectReason.connectionLost ||
                    statusCode === DisconnectReason.connectionReplaced ||
                    statusCode === DisconnectReason.timedOut) {

                    if (retryCount >= MAX_RETRIES) {
                        logger.error('Max retries reached, clearing session');
                        await sessionManager.clearSession();
                        retryCount = 0;
                    } else {
                        retryCount++;
                        const delay = Math.min(5000 * Math.pow(2, retryCount - 1), 300000);
                        logger.info(`Retrying in ${delay/1000} seconds (attempt ${retryCount}/${MAX_RETRIES})`);

                        isConnecting = false;
                        connectionLock = false;

                        setTimeout(startWhatsAppConnection, delay);
                    }
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', async (creds) => {
            try {
                await sessionManager.saveSession(sessionManager.sessionId, creds);
            } catch (err) {
                logger.error('Failed to save credentials:', err);
            }
        });

        return sock;
    } catch (err) {
        logger.error('Fatal error in connection:', err);
        isConnecting = false;
        connectionLock = false;

        if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = Math.min(5000 * Math.pow(2, retryCount - 1), 300000);
            setTimeout(startWhatsAppConnection, delay);
        } else {
            await sessionManager.clearSession();
            process.exit(1);
        }
    }
}

// Start server and connection
server.listen(PORT, '0.0.0.0', async () => {
    logger.info(`Server running on port ${PORT}`);
    try {
        await startWhatsAppConnection();
    } catch (err) {
        logger.error('Failed to start:', err);
        process.exit(1);
    }
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM');
    try {
        if (sock) {
            await sock.logout();
            await sessionManager.clearSession();
        }
    } catch (err) {
        logger.error('Shutdown error:', err);
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT');
    try {
        if (sock) {
            await sock.logout();
            await sessionManager.clearSession();
        }
    } catch (err) {
        logger.error('Shutdown error:', err);
    }
    process.exit(0);
});

module.exports = { app, server };