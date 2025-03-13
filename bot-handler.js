// Load environment variables first
require('dotenv').config();

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

// Configure logging first
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    }
});

// Load message handlers with proper error handling
let messageHandler;
let commandHandler;

try {
    logger.info('Loading message and command handlers...');

    // Load command handler first since message handler depends on it
    commandHandler = require('./src/handlers/commandHandler');
    if (!commandHandler || !commandHandler.processCommand) {
        throw new Error('Command handler failed to load properly');
    }
    logger.info('Command handler loaded successfully');

    // Then load message handler
    const { messageHandler: handler, init: initMessageHandler } = require('./src/handlers/messageHandler');
    messageHandler = handler;
    if (!messageHandler) {
        throw new Error('Message handler failed to load properly');
    }
    logger.info('Message handler loaded successfully');

} catch (err) {
    logger.error('Failed to load handlers:', err);
    process.exit(1);
}

// Configure options based on environment variables
const AUTH_DIR = process.env.AUTH_DIR || 'auth_info_qr';
const SESSION_DIR = path.join(__dirname, AUTH_DIR);
const PORT = parseInt(process.env.PORT || '5000', 10);

// Initialize express app
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        port: PORT,
        commandsLoaded: commandHandler.commands.size
    });
});

// Connection state storage
let connectionState = {
    state: 'disconnected',
    qrCode: null,
    uptime: 0,
    connected: false,
    disconnectReason: null
};

let isConnecting = false;

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 5000,
    maxDelay: 30000
};

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt) {
    return Math.min(
        RETRY_CONFIG.maxDelay,
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt)
    ) + (Math.random() * 1000);
}

/**
 * Helper function to check broadcast JIDs
 */
function isJidBroadcast(jid) {
    return jid?.endsWith('@broadcast');
}

/**
 * Initialize WhatsApp connection with retry logic
 */
async function connectToWhatsApp(retryCount = 0) {
    try {
        isConnecting = true;
        connectionState.state = 'connecting';
        logger.info('🟢 Starting WhatsApp authentication...');

        // Ensure session directory exists
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

        // Create WhatsApp socket connection
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'debug' }),
            browser: ['𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻', 'Chrome', '121.0.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            markOnlineOnConnect: true,
            shouldIgnoreJid: jid => isJidBroadcast(jid)
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            logger.info('Connection update received:', update);

            if (qr) {
                connectionState.state = 'qr_ready';
                connectionState.qrCode = qr;
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                connectionState.state = 'disconnected';
                connectionState.connected = false;
                connectionState.disconnectReason = statusCode;
                isConnecting = false;

                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    setTimeout(() => connectToWhatsApp(0), 5000);
                } else if (retryCount < RETRY_CONFIG.maxRetries) {
                    const delay = getRetryDelay(retryCount);
                    setTimeout(() => connectToWhatsApp(retryCount + 1), delay);
                } else {
                    logger.info('Max retries reached, manual restart needed');
                }
            } else if (connection === 'open') {
                logger.info('🟢 WhatsApp connection established!');
                connectionState.state = 'connected';
                connectionState.connected = true;
                isConnecting = false;

                // Initialize message handling
                logger.info('Initializing message handlers...');
                try {
                    // Initialize message handler
                    logger.info('Starting message handler initialization...');
                    const initialized = await initMessageHandler();
                    logger.info('Message handler initialization result:', initialized);

                    if (!initialized) {
                        logger.error('Message handler initialization failed - check dependencies');
                        return;
                    }

                    logger.info('Message handler initialized successfully');

                    // Set up message event handlers
                    sock.ev.off('messages.upsert'); // Remove any existing handlers
                    sock.ev.on('messages.upsert', async ({ messages, type }) => {
                        if (type === 'notify') {
                            for (const message of messages) {
                                if (message.key.fromMe) {
                                    logger.debug('Skipping own message');
                                    continue;
                                }

                                try {
                                    logger.debug('Processing incoming message:', {
                                        type: message.message ? Object.keys(message.message)[0] : null,
                                        from: message.key.remoteJid
                                    });
                                    await messageHandler(sock, message);
                                } catch (err) {
                                    logger.error('Message handling error:', err);
                                }
                            }
                        }
                    });
                    logger.info('Message event handler registered successfully');
                } catch (error) {
                    logger.error('Failed to initialize message handlers:', error);
                    logger.error('Stack trace:', error.stack);
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

        return sock;
    } catch (error) {
        logger.error('Error in WhatsApp connection:', error);
        logger.error('Stack trace:', error.stack);
        isConnecting = false;
        throw error;
    }
}

// Start the bot
async function start() {
    try {
        logger.info('Starting 𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻...');

        // Create required directories
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }

        // Start HTTP server
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`Server started on port ${PORT}`);

            // Initialize WhatsApp connection
            connectToWhatsApp().catch(error => {
                logger.error('Failed to initialize WhatsApp:', error);
                process.exit(1);
            });
        });

        server.on('error', (err) => {
            logger.error('Server error:', err);
            process.exit(1);
        });

    } catch (error) {
        logger.error('Failed to start application:', error);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err);
    process.exit(1);
});

// Start application
start().catch((error) => {
    logger.error('Fatal error during startup:', error);
    process.exit(1);
});

module.exports = {
    connectToWhatsApp,
    start,
    isJidBroadcast
};