/**
 * WhatsApp Bot Handler with Stable Connection Management
 */

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
    lastError: null,
    shouldReconnect: true
};

// Connection settings
const CONFIG = {
    maxRetries: 3,
    baseDelay: 20000,
    maxDelay: 60000,
    connectTimeout: 45000
};

// Translations
const TRANSLATIONS = {
    en: {
        title: 'WhatsApp Bot Status',
        status: 'Status',
        connected: 'Connected',
        connecting: 'Connecting...',
        disconnected: 'Disconnected',
        waitingQR: 'Waiting for QR code...',
        connectedSuccess: 'Connected successfully!',
        instructions: [
            'Wait for QR code to appear below',
            'Open WhatsApp on your phone',
            'Tap Menu or Settings and select Linked Devices',
            'Tap on "Link a Device"',
            'Point your phone at this screen to capture the QR code'
        ]
    },
    de: {
        title: 'WhatsApp Bot Status',
        status: 'Status',
        connected: 'Verbunden',
        connecting: 'Verbindung wird hergestellt...',
        disconnected: 'Nicht verbunden',
        waitingQR: 'Warte auf QR-Code...',
        connectedSuccess: 'Erfolgreich verbunden!',
        instructions: [
            'Warten Sie, bis der QR-Code unten erscheint',
            'Öffnen Sie WhatsApp auf Ihrem Telefon',
            'Tippen Sie auf Menü oder Einstellungen und wählen Sie Verknüpfte Geräte',
            'Tippen Sie auf "Gerät verknüpfen"',
            'Richten Sie Ihr Telefon auf diesen Bildschirm, um den QR-Code zu scannen'
        ]
    }
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
            if (typeof state.connection.end === 'function') {
                await state.connection.end();
            }
            state.connection = null;
        }

        state.isConnected = false;
        state.isConnecting = false;
        state.connectionLock = false;
        state.qrCode = null;
    } catch (err) {
        logger.error('Cleanup error:', err);
    }
}

// Initialize WhatsApp connection
async function connect() {
    // Prevent connection if already connected or in progress
    if (state.isConnected || state.isConnecting || state.connectionLock) {
        logger.info('Connection attempt blocked - already connected or in progress');
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
            logger.info('Connection update:', { connection, hasQR: !!qr });

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
                state.shouldReconnect = false; // Disable reconnection once connected

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
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = state.shouldReconnect && 
                                      statusCode !== DisconnectReason.loggedOut &&
                                      state.retryCount < CONFIG.maxRetries;

                state.isConnected = false;
                state.isConnecting = false;

                if (shouldReconnect) {
                    state.retryCount++;
                    const delay = Math.min(CONFIG.maxDelay, CONFIG.baseDelay * Math.pow(2, state.retryCount - 1));
                    logger.info(`Connection closed. Retry ${state.retryCount}/${CONFIG.maxRetries} in ${delay/1000}s`);

                    if (state.retryTimeout) {
                        clearTimeout(state.retryTimeout);
                    }

                    state.retryTimeout = setTimeout(async () => {
                        await cleanup();
                        if (state.shouldReconnect) {
                            connect();
                        }
                    }, delay);
                } else {
                    logger.info('Connection closed permanently');
                    if (statusCode === DisconnectReason.loggedOut) {
                        await cleanup();
                        try {
                            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
                            fs.mkdirSync(SESSION_DIR, { recursive: true });
                            state.shouldReconnect = true; // Re-enable reconnection after logout
                            connect();
                        } catch (err) {
                            logger.error('Error clearing auth data:', err);
                        }
                    }
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
    }
}

// Serve web interface with translations
app.get('/', (req, res) => {
    // Get user language preference (default to English)
    const lang = (req.headers['accept-language'] || '').includes('de') ? 'de' : 'en';
    const t = TRANSLATIONS[lang];

    res.send(`
        <!DOCTYPE html>
        <html lang="${lang}">
        <head>
            <title>${t.title}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta charset="UTF-8">
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    text-align: center; 
                    margin: 20px;
                    background-color: #f5f5f5;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: white;
                    border-radius: 10px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                #qrcode { 
                    margin: 20px auto;
                    padding: 20px;
                    background: white;
                    border-radius: 10px;
                }
                .status { 
                    padding: 10px; 
                    margin: 10px 0; 
                    border-radius: 5px;
                    font-weight: bold;
                }
                .connected { background: #d4edda; color: #155724; }
                .disconnected { background: #f8d7da; color: #721c24; }
                .connecting { background: #fff3cd; color: #856404; }
                .instructions {
                    text-align: left;
                    margin: 20px auto;
                    max-width: 600px;
                }
                .instructions ol {
                    padding-left: 20px;
                }
                .instructions li {
                    margin: 10px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>${t.title}</h1>
                <div id="status"></div>
                <div class="instructions">
                    <ol>
                        ${t.instructions.map(instruction => `<li>${instruction}</li>`).join('')}
                    </ol>
                </div>
                <div id="qrcode"></div>
                <div id="error"></div>
            </div>
            <script>
                const translations = ${JSON.stringify(t)};

                function updateStatus() {
                    fetch('/api/status')
                        .then(res => res.json())
                        .then(data => {
                            const statusDiv = document.getElementById('status');
                            const qrcodeDiv = document.getElementById('qrcode');
                            const errorDiv = document.getElementById('error');

                            let statusClass = 'disconnected';
                            let statusText = translations.disconnected;

                            if (data.connected) {
                                statusClass = 'connected';
                                statusText = translations.connected;
                            } else if (data.connecting) {
                                statusClass = 'connecting';
                                statusText = translations.connecting;
                            }

                            statusDiv.className = 'status ' + statusClass;
                            statusDiv.textContent = translations.status + ': ' + statusText;

                            if (data.qrCode) {
                                qrcodeDiv.innerHTML = '<img src="' + data.qrCode + '" alt="QR Code" style="max-width: 300px;">';
                            } else if (data.connected) {
                                qrcodeDiv.innerHTML = '<p>' + translations.connectedSuccess + '</p>';
                            } else {
                                qrcodeDiv.innerHTML = '<p>' + translations.waitingQR + '</p>';
                            }

                            if (data.lastError) {
                                errorDiv.innerHTML = '<p style="color: red">Error: ' + data.lastError + '</p>';
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
        // Ensure auth directory exists
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }

        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`Server running on port ${PORT}`);
            // Enable reconnection on initial start
            state.shouldReconnect = true;
            connect();
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

// Handle graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    state.shouldReconnect = false; // Prevent reconnection attempts during shutdown
    await cleanup();
    process.exit(0);
});

// Error handlers
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err);
});

// Start the application
start();

module.exports = { connect, start };