const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const pino = require('pino');
const logger = require('./utils/logger');
const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);

let sock = null;
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_INTERVAL = 10000; 
const RECONNECT_INTERVAL = 5000; 
let latestQR = null;
let qrPort = 5006;
let isConnecting = false;
let connectionLock = false;

// Set up Express server for QR code display
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>WhatsApp QR Code</title>
                <style>
                    body { 
                        display: flex; 
                        flex-direction: column;
                        align-items: center; 
                        justify-content: center; 
                        height: 100vh; 
                        margin: 0;
                        font-family: Arial, sans-serif;
                        background: #f0f2f5;
                    }
                    #qrcode {
                        padding: 20px;
                        background: white;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    h2 {
                        color: #333;
                        margin-bottom: 20px;
                    }
                    .status {
                        margin-top: 20px;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <h2>Scan QR Code with WhatsApp</h2>
                <div id="qrcode">
                    ${latestQR ? `<img src="${latestQR}" alt="QR Code"/>` : 'Waiting for QR Code...'}
                </div>
                <p class="status">Please scan the QR code with WhatsApp to connect</p>
                <script>
                    // Auto-refresh the page every 20 seconds if no QR code is present
                    if (!document.querySelector('#qrcode img')) {
                        setTimeout(() => location.reload(), 20000);
                    }
                </script>
            </body>
        </html>
    `);
});

async function clearSession() {
    try {
        const sessionFiles = [
            'auth_info_multi.json',
            'auth_info_baileys.json',
            'auth_info.json',
            'auth_info_qr.json'
        ];

        for (const file of sessionFiles) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    logger.info(`Cleared session file: ${file}`);
                }
            } catch (err) {
                logger.error(`Error clearing session file ${file}:`, err);
            }
        }

        const authDir = path.join(process.cwd(), 'auth_info');
        if (fs.existsSync(authDir)) {
            await fsPromises.rm(authDir, { recursive: true, force: true });
            logger.info('Cleared auth_info directory');
        }
    } catch (err) {
        logger.error('Error in clearSession:', err);
    }
}

async function ensureAuthDir() {
    try {
        const authDir = path.join(process.cwd(), 'auth_info');
        if (!fs.existsSync(authDir)) {
            await fsPromises.mkdir(authDir, { recursive: true });
        }
        return authDir;
    } catch (err) {
        logger.error('Failed to create auth directory:', err);
        process.exit(1);
    }
}

async function displayQR(qr) {
    try {
        latestQR = await qrcode.toDataURL(qr);
        logger.info(`QR Code ready! Visit http://localhost:${qrPort} to scan`);
    } catch (err) {
        logger.error('Failed to generate QR code:', err);
        process.exit(1);
    }
}

async function startConnection() {
    if (isConnecting || connectionLock) {
        logger.info('Connection attempt already in progress, skipping...');
        return null;
    }

    isConnecting = true;
    connectionLock = true;

    try {
        server.listen(qrPort, '0.0.0.0', () => {
            logger.info(`QR Code server running at http://localhost:${qrPort}`);
        });

        const authDir = await ensureAuthDir();
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        // Create socket with more conservative settings
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: ['WhatsApp Bot', 'Firefox', '2.0.0'],
            logger: pino({ level: 'silent' }),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            emitOwnEvents: true,
            retryRequestDelayMs: 2000,
            version: [2, 2323, 4],
            markOnlineOnConnect: false,
            syncFullHistory: false,
            shouldSyncHistoryMessage: false,
            downloadHistory: false,
            getMessage: async () => {
                return { conversation: 'hello' };
            },
            patchMessageBeforeSending: false,
            userDevicesCache: false,
            transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
            ws: {
                connectTimeoutMs: 30000,
                keepAliveIntervalMs: 25000,
                retryOnServerClose: true,
                retryOnTimeout: true,
                retryCount: 5
            }
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if(qr) {
                await displayQR(qr);
            }

            if (connection === 'open') {
                retryCount = 0;
                latestQR = null; 
                await saveCreds();
                logger.restoreLogging();
                logger.info('Connection established successfully!');

                isConnecting = false;
                connectionLock = false;
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;

                // Handle critical disconnect reasons
                if (statusCode === DisconnectReason.loggedOut || 
                    statusCode === DisconnectReason.connectionReplaced ||
                    statusCode === DisconnectReason.connectionClosed ||
                    statusCode === DisconnectReason.timedOut) {

                    logger.info('Critical disconnect, clearing session...');
                    await clearSession();
                    process.exit(1); 
                    return;
                }

                // Implement exponential backoff for reconnection
                if (retryCount < MAX_RETRIES) {
                    retryCount++;
                    const delay = RETRY_INTERVAL * Math.pow(2, retryCount - 1);

                    setTimeout(async () => {
                        try {
                            logger.info(`Attempting reconnection ${retryCount}/${MAX_RETRIES}`);
                            isConnecting = false;
                            connectionLock = false;
                            sock = await startConnection();
                        } catch (err) {
                            logger.error('Reconnection attempt failed:', err);
                            process.exit(1);
                        }
                    }, delay);
                } else {
                    logger.error('Max reconnection attempts reached');
                    process.exit(1);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        return sock;
    } catch (err) {
        logger.error('Fatal error in startConnection:', err);

        if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = RETRY_INTERVAL * Math.pow(2, retryCount - 1);

            setTimeout(async () => {
                try {
                    isConnecting = false;
                    connectionLock = false;
                    sock = await startConnection();
                } catch (err) {
                    logger.error('Retry attempt failed:', err);
                    process.exit(1);
                }
            }, delay);
        } else {
            process.exit(1);
        }
    } finally {
        isConnecting = false;
        connectionLock = false;
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    logger.info('Received SIGINT. Cleaning up...');
    try {
        if (sock) {
            await sock.logout();
            await clearSession();
        }
    } catch (err) {
        logger.error('Error during cleanup:', err);
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM. Cleaning up...');
    try {
        if (sock) {
            await sock.logout();
            await clearSession();
        }
    } catch (err) {
        logger.error('Error during cleanup:', err);
    }
    process.exit(0);
});

module.exports = { startConnection };