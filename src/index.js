/**
 * Replit-Optimized WhatsApp QR Code Generator
 */

const express = require('express');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const handler = require('./handlers/ultra-minimal-handler');
const logger = require('./utils/logger');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const qrcodeWeb = require('qrcode');
const path = require('path');
const pino = require('pino');

// Constants
const PORT = 5000;
const AUTH_DIRECTORY = path.join(process.cwd(), 'auth_info');
const BROWSER_ID = `BLACKSKY-REPLIT-${Date.now().toString().slice(-6)}`;

// Global state
let qr = null;
let webQR = null;
let connectionStatus = 'disconnected';
let sock = null;
let qrGenerationCount = 0;

// Clean auth directory
if (fs.existsSync(AUTH_DIRECTORY)) {
    fs.rmSync(AUTH_DIRECTORY, { recursive: true, force: true });
}
fs.mkdirSync(AUTH_DIRECTORY, { recursive: true });

// Create Express app
const app = express();

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
                    background-color: #f0f2f5;
                }
                h1 { 
                    color: #128C7E;
                    font-size: 24px;
                    margin-bottom: 5px;
                }
                h2 {
                    color: #666;
                    font-size: 16px;
                    font-weight: normal;
                    margin-top: 0;
                }
                .qr-container {
                    background-color: white;
                    border-radius: 10px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    padding: 20px;
                    max-width: 500px;
                    margin: 20px auto;
                }
                .qr-code {
                    padding: 20px;
                    display: flex;
                    justify-content: center;
                }
                .qr-code img {
                    max-width: 300px;
                    height: auto;
                }
                .button {
                    background-color: #128C7E;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-top: 10px;
                    font-size: 14px;
                }
                .status {
                    margin: 20px 0;
                    padding: 10px;
                    border-radius: 5px;
                }
                .status.connecting { background-color: #FFF3CD; color: #856404; }
                .status.connected { background-color: #D4EDDA; color: #155724; }
                .status.disconnected { background-color: #F8D7DA; color: #721C24; }
                .instructions {
                    background-color: #f8f9fa;
                    border-radius: 5px;
                    padding: 15px;
                    text-align: left;
                    margin-top: 20px;
                }
                .instructions ol { padding-left: 20px; }
                .instructions li { margin-bottom: 5px; }
                .loader {
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #128C7E;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    animation: spin 1s linear infinite;
                    margin: 20px auto;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .pulsing {
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
            <h1>BLACKSKY-MD WhatsApp Bot</h1>
            <h2>Replit-Optimized QR Code Scanner</h2>

            <div class="qr-container">
                <div class="status ${connectionStatus}">
                    Status: ${connectionStatus.toUpperCase()}
                </div>

                <div class="qr-code">
                    ${webQR 
                        ? `<img src="${webQR}" alt="WhatsApp QR Code" />`
                        : connectionStatus === 'connecting' 
                            ? '<div class="loader"></div><p class="pulsing">Generating QR code...</p>' 
                            : connectionStatus === 'connected' 
                                ? '<p>✅ Successfully connected to WhatsApp!</p>' 
                                : '<p>Waiting to connect to WhatsApp servers...</p>'
                    }
                </div>

                <button class="button" onclick="location.reload()">Refresh QR Code</button>
            </div>

            <div class="instructions">
                <h3>How to connect your WhatsApp:</h3>
                <ol>
                    <li>Open WhatsApp on your phone</li>
                    <li>Tap on Settings (three dots) → Linked Devices</li>
                    <li>Tap on "Link a Device"</li>
                    <li>When the camera opens, point it at this screen to scan the QR code</li>
                </ol>
                <p><strong>Note:</strong> The QR code refreshes every 30 seconds. If scanning fails, click the Refresh button.</p>
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

        // Setup authentication state
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIRECTORY);
        logger.info('Auth state loaded');

        // Create socket with Replit-optimized settings
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: [BROWSER_ID, 'Chrome', '110.0.0'],
            version: [2, 2323, 4],
            logger: pino({ level: 'silent' }),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            markOnlineOnConnect: false,
            syncFullHistory: false
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr: receivedQr } = update;
            logger.info('📡 CONNECTION UPDATE:', JSON.stringify(update, null, 2));

            if (receivedQr) {
                qrGenerationCount++;
                logger.info(`\n[QR] New QR code generated (${qrGenerationCount})`);

                // Show QR in terminal
                qrcode.generate(receivedQr, { small: true });

                try {
                    // Generate QR for web
                    webQR = await qrcodeWeb.toDataURL(receivedQr);
                    connectionStatus = 'connecting';
                    logger.info('✅ QR code updated for web interface');
                } catch (err) {
                    logger.error('❌ Error generating web QR:', err.message);
                }
            }

            if (connection === 'open') {
                logger.info('🎉 CONNECTION OPENED SUCCESSFULLY!');
                connectionStatus = 'connected';
                webQR = null;
                await saveCreds();
                logger.info('💾 Credentials saved successfully');

                try {
                    const user = sock.user;
                    logger.info('👤 Connected as:', user.name || user.verifiedName || user.id.split(':')[0]);
                } catch (e) {
                    logger.error('⚠️ Could not get user details:', e.message);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                connectionStatus = 'disconnected';
                logger.info(`\n🔴 CONNECTION CLOSED:
- Status Code: ${statusCode}
- Should Reconnect: ${shouldReconnect ? 'Yes' : 'No'}
`);

                if (shouldReconnect) {
                    logger.info('🔄 Attempting reconnection in 5 seconds...');
                    setTimeout(startConnection, 5000);
                } else {
                    logger.info('⛔ Not reconnecting - logged out');
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

// Start the server and connection
app.listen(PORT, '0.0.0.0', () => {
    logger.info(`\n✅ QR Web Server running at http://localhost:${PORT}\n`);
    logger.info('✅ Use this URL to access the WhatsApp QR code scanning interface\n');
    startConnection();
});