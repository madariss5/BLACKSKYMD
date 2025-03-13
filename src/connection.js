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
const INITIAL_RETRY_INTERVAL = 10000; // 10 seconds
const MAX_RETRY_INTERVAL = 300000; // 5 minutes
let currentRetryInterval = INITIAL_RETRY_INTERVAL;
let qrPort = 5006;
let isConnecting = false;
let connectionLock = false;
let sessionInvalidated = false;
let reconnectTimer = null;

// Set up Express server for QR code display
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>WhatsApp QR Code</title>
                <meta http-equiv="refresh" content="30">
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
                    h2 { color: #333; margin-bottom: 20px; }
                    .status { margin-top: 20px; color: #666; }
                    .reconnecting { color: #e67e22; }
                    .error { color: #e74c3c; }
                </style>
            </head>
            <body>
                <h2>Scan QR Code with WhatsApp</h2>
                <div id="qrcode">
                    ${sessionInvalidated ? 'Reconnecting...' : (latestQR ? `<img src="${latestQR}" alt="QR Code"/>` : 'Waiting for QR Code...')}
                </div>
                <p class="status" id="statusMessage">Please scan the QR code with WhatsApp to connect</p>
            </body>
        </html>
    `);
});

async function cleanupSession() {
    try {
        logger.info('Cleaning up session files...');
        const filesToClean = [
            'auth_info_multi.json',
            'auth_info_baileys.json',
            'auth_info.json',
            'auth_info_qr.json'
        ];

        const authDirs = [
            'auth_info',
            'auth_info_baileys',
            'auth_info_multi'
        ].map(dir => path.join(process.cwd(), dir));

        // Clean up files
        for (const file of filesToClean) {
            try {
                if (fs.existsSync(file)) {
                    await fsPromises.unlink(file);
                    logger.info(`Removed session file: ${file}`);
                }
            } catch (err) {
                logger.error(`Error removing file ${file}:`, err);
            }
        }

        // Clean up directories
        for (const dir of authDirs) {
            try {
                if (fs.existsSync(dir)) {
                    await fsPromises.rm(dir, { recursive: true, force: true });
                    logger.info(`Removed directory: ${dir}`);
                }
            } catch (err) {
                logger.error(`Error removing directory ${dir}:`, err);
            }
        }

        sessionInvalidated = true;
        logger.info('Session cleanup completed');
    } catch (err) {
        logger.error('Error during session cleanup:', err);
        throw err;
    }
}

async function ensureAuthDir() {
    const authDir = path.join(process.cwd(), 'auth_info');
    try {
        await fsPromises.mkdir(authDir, { recursive: true });
        return authDir;
    } catch (err) {
        logger.error('Failed to create auth directory:', err);
        throw err;
    }
}

async function displayQR(qr) {
    try {
        latestQR = await qrcode.toDataURL(qr);
        logger.info(`QR Code ready at http://localhost:${qrPort}`);
    } catch (err) {
        logger.error('QR code generation failed:', err);
        throw err;
    }
}

function clearReconnectTimer() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}

async function startConnection() {
    if (isConnecting || connectionLock) {
        logger.info('Connection attempt already in progress, skipping...');
        return null;
    }

    try {
        isConnecting = true;
        connectionLock = true;

        // Start QR server if not already running
        if (!server.listening) {
            server.listen(qrPort, '0.0.0.0', () => {
                logger.info(`QR server listening on port ${qrPort}`);
            });
        }

        const authDir = await ensureAuthDir();
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        // Create socket with optimized settings
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: ['WhatsApp Bot', 'Firefox', '2.0.0'],
            logger: pino({ level: 'silent' }),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            emitOwnEvents: true,
            retryRequestDelayMs: 5000,
            fireInitQueries: true,
            downloadHistory: false,
            syncFullHistory: false,
            shouldSyncHistoryMessage: false,
            patchMessageBeforeSending: false,
            markOnlineOnConnect: false,
            version: [2, 2323, 4],
            browser: ['BLACKSKY-MD', 'Chrome', '121.0.0'],
            transactionOpts: { 
                maxCommitRetries: 10, 
                delayBetweenTriesMs: 5000 
            },
            getMessage: async () => {
                return { conversation: 'hello' };
            }
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                await displayQR(qr);
            }

            if (connection === 'open') {
                logger.info('Connection established successfully');
                retryCount = 0;
                currentRetryInterval = INITIAL_RETRY_INTERVAL;
                sessionInvalidated = false;
                clearReconnectTimer();
                await saveCreds();

                isConnecting = false;
                connectionLock = false;
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                logger.info(`Connection closed with status code: ${statusCode}`);

                // Handle critical errors
                if (statusCode === DisconnectReason.loggedOut || 
                    statusCode === DisconnectReason.connectionReplaced ||
                    statusCode === DisconnectReason.connectionClosed ||
                    statusCode === DisconnectReason.connectionLost ||
                    statusCode === DisconnectReason.timedOut) {

                    logger.info('Critical connection error detected');
                    await cleanupSession();

                    if (statusCode === DisconnectReason.loggedOut ||
                        statusCode === DisconnectReason.connectionReplaced) {
                        process.exit(1);
                        return;
                    }
                }

                if (retryCount >= MAX_RETRIES) {
                    logger.error('Max retries reached, restarting...');
                    await cleanupSession();
                    process.exit(1);
                    return;
                }

                // Implement exponential backoff
                retryCount++;
                currentRetryInterval = Math.min(
                    currentRetryInterval * 2,
                    MAX_RETRY_INTERVAL
                );

                logger.info(`Scheduling reconnection attempt ${retryCount}/${MAX_RETRIES} in ${currentRetryInterval}ms`);

                clearReconnectTimer();
                reconnectTimer = setTimeout(async () => {
                    try {
                        isConnecting = false;
                        connectionLock = false;
                        await startConnection();
                    } catch (err) {
                        logger.error('Reconnection attempt failed:', err);
                        if (retryCount >= MAX_RETRIES) {
                            await cleanupSession();
                            process.exit(1);
                        }
                    }
                }, currentRetryInterval);
            }
        });

        sock.ev.on('creds.update', saveCreds);

        return sock;
    } catch (err) {
        logger.error('Fatal error in startConnection:', err);

        if (retryCount < MAX_RETRIES) {
            retryCount++;
            currentRetryInterval = Math.min(
                currentRetryInterval * 2,
                MAX_RETRY_INTERVAL
            );

            logger.info(`Retrying connection in ${currentRetryInterval}ms`);
            clearReconnectTimer();
            reconnectTimer = setTimeout(async () => {
                try {
                    isConnecting = false;
                    connectionLock = false;
                    await startConnection();
                } catch (retryErr) {
                    logger.error('Retry failed:', retryErr);
                    if (retryCount >= MAX_RETRIES) {
                        await cleanupSession();
                        process.exit(1);
                    }
                }
            }, currentRetryInterval);
        } else {
            await cleanupSession();
            process.exit(1);
        }
    } finally {
        isConnecting = false;
        connectionLock = false;
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, cleaning up...');
    clearReconnectTimer();
    try {
        if (sock) {
            await sock.logout();
            await cleanupSession();
        }
    } catch (err) {
        logger.error('Cleanup error:', err);
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, cleaning up...');
    clearReconnectTimer();
    try {
        if (sock) {
            await sock.logout();
            await cleanupSession();
        }
    } catch (err) {
        logger.error('Cleanup error:', err);
    }
    process.exit(0);
});

module.exports = { startConnection };