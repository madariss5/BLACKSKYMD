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

// Initialize Express app and server
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize session manager
const sessionManager = new SessionManager();
let sock = null;
let latestQR = null;

// Serve QR code page
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
                        background-color: #e8f5e9;
                        color: #2e7d32;
                        font-weight: bold;
                    }
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

// Basic health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: Date.now()
    });
});

// Status endpoint
app.get('/status', (req, res) => {
    res.json({
        connected: sock?.user ? true : false,
        user: sock?.user || null,
        connectionState: sock?.state || 'disconnected'
    });
});

async function startWhatsAppConnection() {
    try {
        // Initialize handler
        await handler.init();
        logger.info('Command handler initialized');

        // Initialize session manager
        await sessionManager.initialize();
        logger.info('Session manager initialized');

        // Get connection config from session manager
        const config = sessionManager.getConnectionConfig();
        logger.info('Retrieved connection configuration');

        // Create WhatsApp socket
        sock = makeWASocket(config);

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            logger.info('Connection update:', update);

            // Handle QR code updates
            if (qr) {
                try {
                    latestQR = await qrcode.toDataURL(qr);
                    logger.info('New QR code generated and ready for display');
                } catch (err) {
                    logger.error('Failed to generate QR code:', err);
                }
            }

            if (connection === 'open') {
                logger.info('Connection established successfully');
                sessionManager.resetRetryCount();
                latestQR = null; // Clear QR code once connected
                try {
                    const user = sock.user;
                    logger.info('Connected as:', user.name || user.verifiedName || user.id.split(':')[0]);
                } catch (e) {
                    logger.error('Could not get user details:', e.message);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                logger.info(`Connection closed with status code: ${statusCode}`);

                const action = await sessionManager.handleConnectionError(
                    lastDisconnect?.error,
                    statusCode
                );

                if (action === 'retry') {
                    logger.info('Attempting immediate reconnection...');
                    startWhatsAppConnection();
                } else if (typeof action === 'number') {
                    logger.info(`Scheduling reconnection in ${action/1000} seconds...`);
                    setTimeout(startWhatsAppConnection, action);
                } else {
                    logger.error('Connection terminated, manual restart required');
                    process.exit(1);
                }
            }
        });

        // Handle messages
        sock.ev.on('messages.upsert', async (m) => {
            if (m.type === 'notify') {
                try {
                    await handler.messageHandler(sock, m.messages[0]);
                } catch (err) {
                    logger.error('Message handling error:', err);
                }
            }
        });

        return sock;
    } catch (err) {
        logger.error('Fatal error in startWhatsAppConnection:', err);
        process.exit(1);
    }
}

// Start the server first to ensure port binding
server.listen(PORT, '0.0.0.0', async () => {
    logger.info(`Server running on port ${PORT}`);

    try {
        // Start WhatsApp connection
        await startWhatsAppConnection();
    } catch (err) {
        logger.error('Failed to start WhatsApp connection:', err);
        process.exit(1);
    }
});

// Handle process termination
process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM signal');
    try {
        if (sock) {
            await sock.logout();
            await sessionManager.clearSession();
        }
    } catch (err) {
        logger.error('Error during shutdown:', err);
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT signal');
    try {
        if (sock) {
            await sock.logout();
            await sessionManager.clearSession();
        }
    } catch (err) {
        logger.error('Error during shutdown:', err);
    }
    process.exit(0);
});

// Export for testing
module.exports = { app, server, startWhatsAppConnection };