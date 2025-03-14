const express = require('express');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const handler = require('./handlers/ultra-minimal-handler');
const { commandLoader } = require('./utils/commandLoader');
const commandModules = require('./commands/index');
const logger = require('./utils/logger');
const config = require('./config/config');
const fs = require('fs').promises;
const qrcode = require('qrcode');
const path = require('path');

// Session directory
const AUTH_DIRECTORY = path.join(process.cwd(), 'auth_info');

// Global state
let latestQR = null;
let connectionStatus = 'disconnected';
let sock = null;
let isReconnecting = false;

// Create Express apps
const mainApp = express();
const qrApp = express();

mainApp.use(express.json());

// Main app status endpoint
mainApp.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>WhatsApp Bot - Status</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="refresh" content="30">
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center;
                        margin-top: 50px;
                    }
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .status-box {
                        background-color: #f5f5f5;
                        border-radius: 8px;
                        padding: 15px;
                        margin: 20px 0;
                    }
                    .qr-link {
                        display: inline-block;
                        background-color: #128C7E;
                        color: white;
                        padding: 10px 20px;
                        text-decoration: none;
                        border-radius: 5px;
                        margin-top: 20px;
                    }
                    .reconnect-button {
                        background-color: #34B7F1;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>WhatsApp Bot Status</h1>
                    <div class="status-box">
                        <p>Status: ${connectionStatus}</p>
                        <p>Uptime: ${Math.floor(process.uptime())} seconds</p>
                    </div>
                    <a href="http://localhost:5007" class="qr-link" target="_blank">Open QR Code Scanner</a>
                    ${connectionStatus === 'disconnected' ? 
                        `<br><button onclick="fetch('/reconnect').then(() => location.reload())" class="reconnect-button">
                            Force Reconnect
                        </button>` : ''
                    }
                </div>
            </body>
        </html>
    `);
});

// Add reconnect endpoint
mainApp.get('/reconnect', async (req, res) => {
    try {
        logger.info('Manual reconnection requested');
        // Clear auth state and force new connection
        await clearAuthState();
        startConnection();
        res.json({ status: 'reconnecting' });
    } catch (err) {
        logger.error('Reconnection failed:', err);
        res.status(500).json({ error: 'Reconnection failed' });
    }
});

// Add status check endpoint
mainApp.get('/status', (req, res) => {
    res.json({
        status: connectionStatus,
        hasQR: !!latestQR,
        isReconnecting,
        uptime: Math.floor(process.uptime())
    });
});

// QR code endpoint
qrApp.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Bot QR Code</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="refresh" content="30">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #f0f4f7;
                    margin: 0;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    text-align: center;
                }
                .container {
                    background-color: white;
                    border-radius: 15px;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                    padding: 30px;
                    max-width: 500px;
                    width: 100%;
                }
                h1 { color: #128C7E; margin-bottom: 5px; }
                h2 { color: #075E54; font-size: 1.2em; margin-top: 0; }
                .qr-container {
                    background-color: white;
                    padding: 20px;
                    border-radius: 10px;
                    margin: 20px auto;
                    display: inline-block;
                }
                .status {
                    font-weight: bold;
                    padding: 10px;
                    border-radius: 5px;
                    margin: 15px 0;
                }
                .disconnected { background-color: #ffcccc; color: #d32f2f; }
                .connecting { background-color: #fff8e1; color: #ff8f00; }
                .connected { background-color: #e8f5e9; color: #2e7d32; }
                .refresh-button {
                    background-color: #128C7E;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 1em;
                    margin-top: 10px;
                }
                img { max-width: 100%; height: auto; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>BLACKSKY-MD</h1>
                <h2>WhatsApp QR Code Scanner</h2>
                <div class="status ${connectionStatus}">
                    Status: ${connectionStatus === 'connected' 
                            ? 'Connected ✓' 
                            : connectionStatus === 'connecting' 
                                ? 'Connecting...' 
                                : 'Waiting for QR Code...'}
                </div>
                <div class="qr-container">
                    ${latestQR 
                        ? `<img src="${latestQR}" alt="WhatsApp QR Code" width="300" height="300">`
                        : `<p>Generating QR code... ${connectionStatus === 'connected' ? 'Already connected!' : 'Please wait.'}</p>`
                    }
                </div>
                <button class="refresh-button" onclick="location.reload()">Refresh</button>
            </div>
        </body>
        </html>
    `);
});

// Improve auth state clearing with better error handling
async function clearAuthState() {
    try {
        // Check if directory exists first
        try {
            await fs.access(AUTH_DIRECTORY);
        } catch (err) {
            if (err.code === 'ENOENT') {
                logger.info('Auth directory does not exist, creating new one');
                await fs.mkdir(AUTH_DIRECTORY, { recursive: true });
                return;
            }
            throw err;
        }

        // Clear directory contents
        const files = await fs.readdir(AUTH_DIRECTORY);
        for (const file of files) {
            const filePath = path.join(AUTH_DIRECTORY, file);
            try {
                await fs.unlink(filePath);
                logger.info(`Cleared auth file: ${file}`);
            } catch (err) {
                logger.error(`Failed to clear auth file ${file}:`, err);
            }
        }

        logger.info('Auth state cleared successfully');
    } catch (err) {
        logger.error('Error clearing auth state:', err);
        // Try to recreate directory as last resort
        try {
            await fs.rm(AUTH_DIRECTORY, { recursive: true, force: true });
            await fs.mkdir(AUTH_DIRECTORY, { recursive: true });
            logger.info('Auth directory recreated after error');
        } catch (recreateErr) {
            logger.error('Failed to recreate auth directory:', recreateErr);
            throw recreateErr;
        }
    }
}

// Start WhatsApp connection
async function startConnection() {
    try {
        if (isReconnecting) {
            logger.info('Already attempting to reconnect, skipping...');
            return;
        }

        isReconnecting = true;
        logger.info('Starting WhatsApp connection...');
        logger.info('Current connection status:', connectionStatus);
        logger.info('QR code available:', latestQR ? 'yes' : 'no');

        // Initialize the handler first
        await handler.init();
        logger.info('Command handler initialized');

        // Ensure auth directory exists
        await fs.mkdir(AUTH_DIRECTORY, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIRECTORY);
        logger.info('Auth state loaded');

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: ['BLACKSKY-MD', 'Chrome', '108.0.0.0'],
            logger: logger,
            connectTimeoutMs: 60000,
            qrTimeout: 60000,
            defaultQueryTimeoutMs: 60000
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            logger.info('Connection update:', {
                connection,
                hasQR: !!qr,
                disconnectReason: lastDisconnect?.error?.message
            });

            if (qr) {
                try {
                    latestQR = await qrcode.toDataURL(qr);
                    connectionStatus = 'connecting';
                    logger.info('New QR code generated');
                    logger.info('QR code available at http://localhost:5007');
                } catch (err) {
                    logger.error('QR generation error:', err);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                connectionStatus = 'disconnected';
                isReconnecting = false;

                logger.info('Connection closed. Details:', {
                    statusCode,
                    shouldReconnect,
                    error: lastDisconnect?.error?.message
                });

                if (shouldReconnect) {
                    logger.info('Attempting reconnection in 5 seconds...');
                    setTimeout(async () => {
                        try {
                            // Clear existing state
                            latestQR = null;
                            logger.info('Cleared QR code');

                            // Clear auth state
                            await clearAuthState();
                            logger.info('Cleared auth state');

                            // Start new connection
                            await startConnection();
                        } catch (err) {
                            logger.error('Reconnection attempt failed:', err);
                            connectionStatus = 'disconnected';
                            isReconnecting = false;
                        }
                    }, 5000);
                } else {
                    logger.info('Not reconnecting - user logged out');
                    latestQR = null;
                    await clearAuthState();
                }
            }

            if (connection === 'open') {
                connectionStatus = 'connected';
                isReconnecting = false;
                latestQR = null;
                logger.info('Connection established successfully');

                try {
                    // Initialize command handlers after successful connection
                    await handler.init();
                    logger.info('Command handlers reloaded after connection');

                    // Log available commands for debugging
                    const availableCommands = Array.from(handler.commands.keys());
                    logger.info('Available commands:', availableCommands);
                } catch (err) {
                    logger.error('Handler initialization error:', err);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Wire up message handler using our ultra-minimal-handler
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
        logger.error('Connection error:', err);
        connectionStatus = 'disconnected';
        isReconnecting = false;
        latestQR = null;
        throw err;
    }
}

// Start servers and initialize connection
async function startApplication() {
    try {
        // Start main API server
        await new Promise((resolve, reject) => {
            mainApp.listen(5000, '0.0.0.0', (err) => {
                if (err) {
                    logger.error('Main server error:', err);
                    reject(err);
                } else {
                    logger.info('Main server running on port 5000');
                    resolve();
                }
            });
        });

        // Start QR server
        await new Promise((resolve, reject) => {
            qrApp.listen(5007, '0.0.0.0', (err) => {
                if (err) {
                    logger.error('QR server error:', err);
                    reject(err);
                } else {
                    logger.info('QR server running on port 5007');
                    resolve();
                }
            });
        });

        // Start WhatsApp connection
        await startConnection();

    } catch (err) {
        logger.error('Fatal error:', err);
        process.exit(1);
    }
}

// Start the application
startApplication().catch(err => {
    logger.error('Startup error:', err);
    process.exit(1);
});