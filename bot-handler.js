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

// Connection state management
const state = {
    connection: null,
    isConnected: false,
    isConnecting: false,
    qrCode: null,
    retryCount: 0,
    retryTimeout: null,
    connectionLock: false,
    lastError: null
};

// Connection settings
const CONFIG = {
    maxRetries: 3,
    baseDelay: 20000, // 20 seconds
    maxDelay: 60000,  // 1 minute
    connectTimeout: 45000, // 45 seconds
    authTimeout: 30000 // 30 seconds
};

// Clean up connection
async function cleanup() {
    try {
        if (state.retryTimeout) {
            clearTimeout(state.retryTimeout);
            state.retryTimeout = null;
        }

        if (state.connection) {
            state.connection.ev.removeAllListeners();
            await state.connection.logout();
            await state.connection.end();
            state.connection = null;
        }

        state.isConnected = false;
        state.isConnecting = false;
        state.connectionLock = false;
    } catch (err) {
        logger.error('Cleanup error:', err);
    }
}

// Initialize WhatsApp connection
async function connect() {
    if (state.isConnecting || state.connectionLock) {
        logger.warn('Connection attempt blocked - already in progress');
        return;
    }

    try {
        state.isConnecting = true;
        state.connectionLock = true;

        // Ensure clean state
        await cleanup();

        // Ensure auth directory exists
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }

        // Load auth state
        const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

        // Create connection
        const sock = makeWASocket({
            auth: authState,
            printQRInTerminal: true,
            logger: pino({ level: 'silent' }),
            browser: ['BLACKSKY-MD', 'Chrome', '121.0.0'],
            connectTimeoutMs: CONFIG.connectTimeout,
            defaultQueryTimeoutMs: CONFIG.authTimeout,
            keepAliveIntervalMs: 10000,
            emitOwnEvents: false,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            retryRequestDelayMs: 10000
        });

        // Update state
        state.connection = sock;

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                state.qrCode = qr;
                logger.info('New QR code received');
            }

            if (connection === 'connecting') {
                logger.info('Connecting to WhatsApp...');
            }

            if (connection === 'open') {
                logger.info('🟢 Connected to WhatsApp');
                state.isConnected = true;
                state.isConnecting = false;
                state.connectionLock = false;
                state.retryCount = 0;
                state.qrCode = null;
                state.lastError = null;

                // Initialize message handler
                try {
                    const { messageHandler, init } = require('./src/handlers/simpleMessageHandler');
                    await init();

                    sock.ev.on('messages.upsert', async ({ messages, type }) => {
                        if (type === 'notify' && Array.isArray(messages)) {
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
                }
            }

            if (connection === 'close') {
                state.isConnected = false;
                state.isConnecting = false;

                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                                     state.retryCount < CONFIG.maxRetries;

                if (shouldReconnect) {
                    state.retryCount++;
                    const delay = Math.min(CONFIG.maxDelay, CONFIG.baseDelay * Math.pow(2, state.retryCount - 1));

                    logger.info(`Connection closed. Retry ${state.retryCount}/${CONFIG.maxRetries} in ${delay/1000}s`);

                    // Clear any existing timeout
                    if (state.retryTimeout) {
                        clearTimeout(state.retryTimeout);
                    }

                    // Schedule reconnection
                    state.retryTimeout = setTimeout(async () => {
                        await cleanup();
                        connect();
                    }, delay);
                } else if (statusCode === DisconnectReason.loggedOut) {
                    logger.info('Logged out, clearing auth data');
                    await cleanup();
                    try {
                        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
                        fs.mkdirSync(SESSION_DIR, { recursive: true });
                        connect();
                    } catch (err) {
                        logger.error('Error clearing auth data:', err);
                    }
                } else {
                    logger.error('Connection closed permanently:', lastDisconnect?.error);
                    state.lastError = lastDisconnect?.error;
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

    } catch (err) {
        logger.error('Connection error:', err);
        state.lastError = err;
        state.isConnecting = false;
        state.connectionLock = false;

        // Attempt reconnection if within retry limits
        if (state.retryCount < CONFIG.maxRetries) {
            state.retryCount++;
            const delay = Math.min(CONFIG.maxDelay, CONFIG.baseDelay * Math.pow(2, state.retryCount - 1));

            if (state.retryTimeout) {
                clearTimeout(state.retryTimeout);
            }

            state.retryTimeout = setTimeout(async () => {
                await cleanup();
                connect();
            }, delay);
        }
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
            <div id="error"></div>
            <script>
                function updateStatus() {
                    fetch('/api/status')
                        .then(res => res.json())
                        .then(data => {
                            const statusDiv = document.getElementById('status');
                            const qrcodeDiv = document.getElementById('qrcode');
                            const errorDiv = document.getElementById('error');

                            let statusClass = 'disconnected';
                            if (data.connected) statusClass = 'connected';
                            if (data.connecting) statusClass = 'connecting';

                            statusDiv.className = 'status ' + statusClass;
                            statusDiv.textContent = 'Status: ' + 
                                (data.connected ? 'Connected' : 
                                 data.connecting ? 'Connecting...' : 
                                 'Disconnected');

                            if (data.qrCode) {
                                qrcodeDiv.innerHTML = '<img src="' + data.qrCode + '" alt="QR Code">';
                            } else if (data.connected) {
                                qrcodeDiv.innerHTML = '<p>Connected successfully!</p>';
                            } else {
                                qrcodeDiv.innerHTML = '<p>Waiting for QR code...</p>';
                            }

                            if (data.lastError) {
                                errorDiv.innerHTML = '<p style="color: red">Last Error: ' + data.lastError + '</p>';
                            } else {
                                errorDiv.innerHTML = '';
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

// Status API endpoint
app.get('/api/status', async (req, res) => {
    try {
        const response = {
            connected: state.isConnected,
            connecting: state.isConnecting,
            retryCount: state.retryCount,
            qrCode: null,
            lastError: state.lastError ? state.lastError.message : null
        };

        if (state.qrCode && !state.isConnected) {
            try {
                response.qrCode = await qrcode.toDataURL(state.qrCode);
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
            connect();
        });

        server.on('error', (err) => {
            logger.error('Server error:', err);
            process.exit(1);
        });

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Shutting down...');
            await cleanup();
            process.exit(0);
        });

        process.on('uncaughtException', (err) => {
            logger.error('Uncaught Exception:', err);
        });

        process.on('unhandledRejection', (err) => {
            logger.error('Unhandled Rejection:', err);
        });

    } catch (err) {
        logger.error('Failed to start application:', err);
        process.exit(1);
    }
}

// Start the application
start();

module.exports = { connect, start };