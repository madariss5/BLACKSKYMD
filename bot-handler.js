const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');

// Configure logging
const logger = pino({ 
    level: 'info',
    transport: {
        target: 'pino-pretty',
        options: { colorize: true }
    }
});

// Initialize express app
const app = express();
app.use(express.json());
app.use(express.static('public'));
const PORT = process.env.PORT || 5000;
const SESSION_DIR = './auth_info_qr';

// Connection state and lock management
const connectionState = {
    sock: null,
    isConnected: false,
    isConnecting: false,
    qrCode: null,
    retryCount: 0,
    connectionLock: false,
    lockTimeout: null,
    lastDisconnectTime: 0
};

// Connection configuration
const CONNECTION_CONFIG = {
    maxRetries: 5,
    minRetryDelay: 15000,  // 15 seconds
    maxRetryDelay: 300000, // 5 minutes
    lockTimeout: 30000,    // 30 seconds
    minReconnectInterval: 10000 // 10 seconds minimum between reconnect attempts
};

// Calculate retry delay with exponential backoff and jitter
function getRetryDelay() {
    const baseDelay = Math.min(
        CONNECTION_CONFIG.maxRetryDelay,
        CONNECTION_CONFIG.minRetryDelay * Math.pow(2, connectionState.retryCount)
    );
    // Add random jitter (±20%)
    const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
    return baseDelay + jitter;
}

// Acquire connection lock
function acquireConnectionLock() {
    if (connectionState.connectionLock) {
        logger.warn('Connection lock already acquired');
        return false;
    }

    connectionState.connectionLock = true;
    // Auto-release lock after timeout
    connectionState.lockTimeout = setTimeout(() => {
        releaseConnectionLock();
    }, CONNECTION_CONFIG.lockTimeout);

    return true;
}

// Release connection lock
function releaseConnectionLock() {
    if (connectionState.lockTimeout) {
        clearTimeout(connectionState.lockTimeout);
        connectionState.lockTimeout = null;
    }
    connectionState.connectionLock = false;
}

// Cleanup existing connection
async function cleanupConnection() {
    try {
        if (connectionState.sock) {
            connectionState.sock.ev.removeAllListeners();
            if (typeof connectionState.sock.end === 'function') {
                await connectionState.sock.end();
            }
            connectionState.sock = null;
        }
    } catch (err) {
        logger.warn('Error during connection cleanup:', err);
    } finally {
        connectionState.isConnected = false;
        connectionState.isConnecting = false;
        releaseConnectionLock();
    }
}

// Initialize WhatsApp connection
async function connectToWhatsApp() {
    // Prevent connection attempts if locked or connecting
    if (connectionState.connectionLock || connectionState.isConnecting) {
        logger.warn('Connection attempt blocked - lock or already connecting');
        return;
    }

    // Enforce minimum interval between reconnection attempts
    const now = Date.now();
    if ((now - connectionState.lastDisconnectTime) < CONNECTION_CONFIG.minReconnectInterval) {
        logger.warn('Reconnection attempted too soon, skipping...');
        return;
    }

    // Acquire connection lock
    if (!acquireConnectionLock()) {
        return;
    }

    try {
        connectionState.isConnecting = true;
        logger.info('Starting WhatsApp connection...');

        // Ensure session directory exists
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'silent' }),
            browser: ['BLACKSKY-MD', 'Chrome', '121.0.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 30000,
            keepAliveIntervalMs: 15000,
            emitOwnEvents: false,
            syncFullHistory: false,
            markOnlineOnConnect: true
        });

        connectionState.sock = sock;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                connectionState.qrCode = qr;
                logger.info('New QR code received');
            }

            if (connection === 'connecting') {
                logger.info('Connecting to WhatsApp...');
            }

            if (connection === 'open') {
                logger.info('🟢 Connected to WhatsApp!');
                connectionState.isConnected = true;
                connectionState.isConnecting = false;
                connectionState.retryCount = 0;
                connectionState.qrCode = null;

                try {
                    const { messageHandler, init } = require('./src/handlers/simpleMessageHandler');
                    await init();

                    sock.ev.on('messages.upsert', async ({ messages, type }) => {
                        if (type === 'notify') {
                            for (const message of messages) {
                                if (!message?.key?.fromMe) {
                                    try {
                                        await messageHandler(sock, message);
                                    } catch (err) {
                                        logger.error('Message handling error:', err);
                                    }
                                }
                            }
                        }
                    });

                    logger.info('Message handler initialized');
                } catch (err) {
                    logger.error('Failed to initialize message handler:', err);
                } finally {
                    releaseConnectionLock();
                }
            }

            if (connection === 'close') {
                connectionState.lastDisconnectTime = Date.now();
                connectionState.isConnected = false;
                connectionState.isConnecting = false;

                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut &&
                                      connectionState.retryCount < CONNECTION_CONFIG.maxRetries;

                if (shouldReconnect) {
                    connectionState.retryCount++;
                    const delay = getRetryDelay();
                    logger.info(`Scheduling reconnection in ${Math.round(delay/1000)} seconds (attempt ${connectionState.retryCount})`);

                    setTimeout(async () => {
                        await cleanupConnection();
                        connectToWhatsApp();
                    }, delay);
                } else {
                    logger.error('Connection closed permanently:', lastDisconnect?.error);
                    if (statusCode === DisconnectReason.loggedOut) {
                        try {
                            await cleanupConnection();
                            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
                            fs.mkdirSync(SESSION_DIR, { recursive: true });
                            logger.info('Auth data cleared due to logout');
                            setTimeout(connectToWhatsApp, CONNECTION_CONFIG.minRetryDelay);
                        } catch (err) {
                            logger.error('Error handling logout:', err);
                        }
                    }
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);
    } catch (err) {
        logger.error('Connection error:', err);
        connectionState.isConnecting = false;
        releaseConnectionLock();
    }
}

// Web interface routes
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Bot Status</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, sans-serif; text-align: center; margin: 20px; }
                #qrcode { margin: 20px auto; }
                .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
                .connected { background: #d4edda; color: #155724; }
                .disconnected { background: #f8d7da; color: #721c24; }
                .connecting { background: #fff3cd; color: #856404; }
            </style>
        </head>
        <body>
            <h1>WhatsApp Bot Status</h1>
            <div id="status"></div>
            <div id="qrcode"></div>
            <script>
                function updateStatus() {
                    fetch('/api/status')
                        .then(res => res.json())
                        .then(data => {
                            const statusDiv = document.getElementById('status');
                            const qrcodeDiv = document.getElementById('qrcode');

                            let statusClass = 'disconnected';
                            if (data.connected) statusClass = 'connected';
                            if (data.connecting) statusClass = 'connecting';

                            statusDiv.className = 'status ' + statusClass;
                            statusDiv.textContent = 'Status: ' + (data.connected ? 'Connected' : data.connecting ? 'Connecting...' : 'Disconnected');

                            if (data.qrCode) {
                                qrcodeDiv.innerHTML = '<img src="' + data.qrCode + '" alt="QR Code">';
                            } else if (data.connected) {
                                qrcodeDiv.innerHTML = '<p>Connected successfully!</p>';
                            } else {
                                qrcodeDiv.innerHTML = '<p>Waiting for QR code...</p>';
                            }
                        })
                        .catch(console.error);
                }

                setInterval(updateStatus, 1000);
                updateStatus();
            </script>
        </body>
        </html>
    `);
});

app.get('/api/status', async (req, res) => {
    try {
        const response = {
            connected: connectionState.isConnected,
            connecting: connectionState.isConnecting,
            retryCount: connectionState.retryCount,
            qrCode: null
        };

        if (connectionState.qrCode && !connectionState.isConnected) {
            try {
                response.qrCode = await qrcode.toDataURL(connectionState.qrCode);
            } catch (err) {
                logger.error('Error generating QR code:', err);
            }
        }

        res.json(response);
    } catch (err) {
        logger.error('Error in status API:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server and bot
async function start() {
    try {
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`Server running on port ${PORT}`);
            connectToWhatsApp();
        });

        server.on('error', (err) => {
            logger.error('Server error:', err);
            process.exit(1);
        });
    } catch (err) {
        logger.error('Failed to start application:', err);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await cleanupConnection();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err);
});

// Start the application
start();

module.exports = { connectToWhatsApp, start };