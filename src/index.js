const express = require('express');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const handler = require('./handlers/ultra-minimal-handler');
const logger = require('./utils/logger');
const fs = require('fs');
const fsPromises = require('fs').promises;
const qrcode = require('qrcode');
const path = require('path');
const pino = require('pino');

// Session directory
const AUTH_DIRECTORY = path.join(process.cwd(), 'auth_info');

// Global state
let latestQR = null;
let connectionStatus = 'disconnected';
let sock = null;

// Create Express apps
const mainApp = express();
const qrApp = express();

mainApp.use(express.json());

// Status endpoint
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
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>WhatsApp Bot Status</h1>
                    <div class="status-box">
                        <p>Status: ${connectionStatus}</p>
                        <p>Uptime: ${Math.floor(process.uptime())} seconds</p>
                    </div>
                    <a href="http://0.0.0.0:5007" class="qr-link" target="_blank">Open QR Code Scanner</a>
                </div>
            </body>
        </html>
    `);
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
                    text-align: center;
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                }
                h1 { color: #128C7E; }
                .qr-container {
                    margin: 30px auto;
                    padding: 20px;
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                    max-width: 350px;
                }
                .qr-code {
                    margin: 20px auto;
                }
                .qr-code img {
                    max-width: 100%;
                    height: auto;
                }
                .instructions {
                    margin-top: 20px;
                    text-align: left;
                    padding: 15px;
                    background: #f9f9f9;
                    border-radius: 5px;
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
            <h1>WhatsApp Bot QR Code</h1>
            <div class="qr-container">
                <div class="qr-code">
                    ${latestQR ? 
                        `<img src="${latestQR}" alt="WhatsApp QR Code">` : 
                        `<p class="waiting">Waiting for QR code... Please wait.</p>`
                    }
                </div>
            </div>
            <div class="instructions">
                <h3>How to Connect:</h3>
                <ol>
                    <li>Open WhatsApp on your phone</li>
                    <li>Go to Settings → Linked Devices</li>
                    <li>Tap on "Link a Device"</li>
                    <li>Scan the QR code above with your phone</li>
                </ol>
                <p>The page will refresh automatically every 30 seconds.</p>
            </div>
        </body>
        </html>
    `);
});

// Start servers
async function startServers() {
    try {
        // Start main API server
        await new Promise((resolve, reject) => {
            mainApp.listen(5000, '0.0.0.0', (err) => {
                if (err) {
                    logger.error('Main server error:', err);
                    reject(err);
                } else {
                    logger.info('Main server running on port 5000');
                    logger.info('Access the status page at http://0.0.0.0:5000');
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
                    logger.info('Access the QR code at http://0.0.0.0:5007');
                    resolve();
                }
            });
        });

        return true;
    } catch (err) {
        logger.error('Failed to start servers:', err);
        return false;
    }
}

// Start WhatsApp connection
async function startConnection() {
    try {
        // Initialize handler
        await handler.init();
        logger.info('Command handler initialized');

        // Clear auth directory to force new QR code
        logger.info('Clearing auth directory...');
        if (fs.existsSync(AUTH_DIRECTORY)) {
            fs.rmSync(AUTH_DIRECTORY, { recursive: true, force: true });
        }
        fs.mkdirSync(AUTH_DIRECTORY, { recursive: true });
        logger.info('Auth directory cleared');

        // Setup authentication state
        logger.info('Loading auth state...');
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIRECTORY);
        logger.info('Auth state loaded');

        // Create WhatsApp socket with minimal settings
        logger.info('Creating WhatsApp socket...');
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: ['BLACKSKY-MD', 'Safari', '117.0.0'],
            version: [2, 2408, 2],
            logger: pino({ level: 'silent' }),
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            qrTimeout: 40000,
            markOnlineOnConnect: false,
            // Prevent connection issues
            retryRequestDelayMs: 1000
        });
        logger.info('WhatsApp socket created');

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            logger.info('Connection update received:', {
                connection,
                hasQR: !!qr,
                disconnectReason: lastDisconnect?.error?.message,
                errorStack: lastDisconnect?.error?.stack
            });

            if (qr) {
                logger.info('\nNew QR code received. Displaying in terminal and web...\n');
                try {
                    latestQR = await qrcode.toDataURL(qr);
                    connectionStatus = 'connecting';
                    logger.info('QR code generated successfully');
                    logger.info('QR code available at http://0.0.0.0:5007');
                } catch (error) {
                    logger.error('Error generating web QR:', error);
                    logger.error('Error stack:', error.stack);
                }
            }

            if (connection === 'connecting') {
                connectionStatus = 'connecting';
                logger.info('Connecting to WhatsApp...');
            }

            if (connection === 'open') {
                logger.info('\nSuccessfully connected to WhatsApp!\n');
                connectionStatus = 'connected';
                latestQR = null;
                await saveCreds();

                try {
                    const user = sock.user;
                    logger.info('Connected as:', user.name || user.verifiedName || user.id.split(':')[0]);
                } catch (e) {
                    logger.error('Could not get user details:', e.message);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                connectionStatus = 'disconnected';
                logger.info('Connection closed:', {
                    statusCode,
                    shouldReconnect,
                    error: lastDisconnect?.error?.message,
                    stack: lastDisconnect?.error?.stack
                });

                if (shouldReconnect) {
                    logger.info('Attempting reconnection in 5 seconds...');
                    setTimeout(() => {
                        logger.info('Starting reconnection...');
                        startConnection();
                    }, 5000);
                } else {
                    logger.info('Not reconnecting - logged out');
                    process.exit(1);
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', async () => {
            logger.info('Credentials updated, saving...');
            await saveCreds();
            logger.info('Credentials saved successfully');
        });

        // Wire up message handler
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
    } catch (error) {
        logger.error('Connection error:', error);
        logger.error('Error stack:', error.stack);
        setTimeout(startConnection, 5000);
    }
}

// Start the application
async function startApplication() {
    try {
        // Start servers first
        const serversStarted = await startServers();
        if (!serversStarted) {
            throw new Error('Failed to start servers');
        }

        // Start WhatsApp connection
        await startConnection();
    } catch (err) {
        logger.error('Fatal error:', err);
        process.exit(1);
    }
}

// Start everything
startApplication().catch(err => {
    logger.error('Startup error:', err);
    process.exit(1);
});