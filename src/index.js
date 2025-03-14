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
                    <a href="http://localhost:5007" class="qr-link" target="_blank">Open QR Code Scanner</a>
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
                    background-color: #f0f4f7;
                    margin: 0;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                }
                .container {
                    background-color: white;
                    border-radius: 15px;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                    padding: 30px;
                    max-width: 500px;
                    width: 100%;
                    text-align: center;
                }
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
                .instructions {
                    font-size: 0.9em;
                    color: #666;
                    margin-top: 20px;
                    text-align: left;
                }
                img { max-width: 100%; height: auto; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>WhatsApp Bot QR Code</h1>
                <div class="status">
                    Status: ${connectionStatus}
                </div>
                <div class="qr-container">
                    ${latestQR 
                        ? `<img src="${latestQR}" alt="WhatsApp QR Code">`
                        : '<p>Waiting for QR code...</p>'}
                </div>
                <div class="instructions">
                    <ol>
                        <li>Open WhatsApp on your phone</li>
                        <li>Go to Settings > Linked Devices</li>
                        <li>Tap on "Link a Device"</li>
                        <li>Scan the QR code above</li>
                    </ol>
                    <p>Page refreshes automatically every 30 seconds.</p>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Start WhatsApp connection
async function startConnection() {
    try {
        // Initialize the handler first
        await handler.init();
        logger.info('Command handler initialized');

        // Ensure auth directory exists
        await fs.mkdir(AUTH_DIRECTORY, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIRECTORY);

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
            logger.info('Connection update:', update);

            if (qr) {
                try {
                    latestQR = await qrcode.toDataURL(qr);
                    connectionStatus = 'connecting';
                    logger.info('New QR code generated');
                } catch (err) {
                    logger.error('QR generation error:', err);
                }
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                connectionStatus = 'disconnected';
                logger.info('Connection closed:', lastDisconnect?.error?.message);

                if (shouldReconnect) {
                    logger.info('Attempting reconnection...');
                    setTimeout(startConnection, 5000);
                }
            }

            if (connection === 'open') {
                connectionStatus = 'connected';
                latestQR = null;
                logger.info('Connection established');

                try {
                    await commandLoader.loadCommandHandlers();
                    await commandModules.initializeModules(sock);
                    logger.info('Handlers initialized');
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
        setTimeout(startConnection, 5000);
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