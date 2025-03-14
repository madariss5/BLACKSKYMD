const express = require('express');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const handler = require('./handlers/ultra-minimal-handler');
const logger = require('./utils/logger');
const fs = require('fs');
const qrcode = require('qrcode');
const path = require('path');
const pino = require('pino');

// Constants
const PORT = 5000;  // Use port 5000 which is open on Replit
const AUTH_DIRECTORY = path.join(process.cwd(), 'auth_info');

// Global state
let qrCode = '';
let webQR = '';
let connectionStatus = 'disconnected';
let sock = null;

// Create Express app
const app = express();

// Create auth directory if it doesn't exist
if (fs.existsSync(AUTH_DIRECTORY)) {
    fs.rmSync(AUTH_DIRECTORY, { recursive: true, force: true });
}
fs.mkdirSync(AUTH_DIRECTORY, { recursive: true });

// Serve QR code via web interface
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
                .refresh-btn {
                    background-color: #128C7E;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    margin-top: 20px;
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
            <h1>WhatsApp Bot QR Code</h1>
            <div class="qr-container">
                <div class="qr-code">
                    ${webQR ? 
                        `<img src="${webQR}" alt="WhatsApp QR Code">` : 
                        `<p class="waiting">Waiting for QR code... Please wait.</p>`
                    }
                </div>
                <button class="refresh-btn" onclick="location.reload()">Refresh QR Code</button>
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

// Start WhatsApp connection
async function startConnection() {
    try {
        // Initialize handler
        await handler.init();
        logger.info('Command handler initialized');

        // Get auth state
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIRECTORY);
        logger.info('Auth state loaded');

        // Create WhatsApp socket with minimal settings
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: ['BLACKSKY-MD', 'Chrome', '110.0.0'],
            version: [2, 2323, 4],
            logger: pino({ level: 'silent' }),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
        });
        logger.info('WhatsApp socket created');

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            logger.info('Connection update:', { connection, hasQR: !!qr });

            if (qr) {
                logger.info('\nNew QR code received. Displaying in terminal and web...\n');
                qrCode = qr;
                try {
                    webQR = await qrcode.toDataURL(qr);
                    logger.info('QR code updated successfully');
                } catch (error) {
                    logger.error('Error generating QR:', error);
                }
            }

            if (connection === 'open') {
                logger.info('\nSuccessfully connected to WhatsApp!\n');
                connectionStatus = 'connected';
                webQR = '';
                await saveCreds();

                try {
                    const user = sock.user;
                    logger.info('Connected as:', user.name || user.verifiedName || user.id.split(':')[0]);
                } catch (e) {
                    logger.error('Could not get user details:', e.message);
                }
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                logger.info(`\nConnection closed due to ${lastDisconnect?.error?.output?.payload?.message || 'unknown reason'}`);

                if (shouldReconnect) {
                    logger.info('Reconnecting...');
                    setTimeout(startConnection, 5000);
                } else {
                    logger.info('Not reconnecting - logged out');
                    process.exit(1);
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

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
        setTimeout(startConnection, 5000);
    }
}

// Start web server and WhatsApp connection
app.listen(PORT, '0.0.0.0', () => {
    logger.info(`\nQR web server running at http://localhost:${PORT}`);
    startConnection();
});