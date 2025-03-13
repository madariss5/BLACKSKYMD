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
    const { messageHandler: handler, init: initMessageHandler } = require('./src/handlers/messageHandler');
    const { commands, processCommand } = require('./src/handlers/commandHandler');
    messageHandler = handler;
    commandHandler = { commands, processCommand };

    logger.info('Handlers loaded successfully:', {
        messageHandlerLoaded: !!messageHandler,
        commandsLoaded: commands.size
    });
} catch (err) {
    logger.error('Failed to load handlers:', err);
    process.exit(1);
}

// Configure options based on environment variables
const AUTH_DIR = process.env.AUTH_DIR || 'auth_info_qr';
const BOT_MODE = process.env.BOT_MODE || 'BOT_HANDLER';
const SESSION_DIR = path.join(__dirname, AUTH_DIR);
const PORT = parseInt(process.env.BOT_PORT || '5001', 10);

// Initialize express app
const app = express();
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        port: PORT,
        mode: BOT_MODE,
        auth_dir: AUTH_DIR,
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

// Add retry configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 5000,
    maxDelay: 30000
};

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt) {
    const delay = Math.min(
        RETRY_CONFIG.maxDelay,
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt)
    );
    return delay + (Math.random() * 1000);
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
            logger: pino({ level: 'silent' }),
            browser: ['𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻', 'Chrome', '121.0.0'],
            connectTimeoutMs: 30000,
            defaultQueryTimeoutMs: 30000,
            markOnlineOnConnect: true,
            shouldIgnoreJid: jid => isJidBroadcast(jid)
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

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

                // Handle session conflict
                if (statusCode === 440) {
                    setTimeout(() => connectToWhatsApp(0), 5000);
                    return;
                }

                // Handle other disconnections
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
                    const initialized = await initMessageHandler();
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
                                // Skip own messages to prevent loops
                                if (message.key.fromMe) {
                                    continue;
                                }

                                try {
                                    await messageHandler(sock, message);
                                } catch (err) {
                                    logger.error('Message handling error:', {
                                        error: err.message,
                                        stack: err.stack,
                                        messageId: message.key?.id,
                                        remoteJid: message.key?.remoteJid
                                    });
                                }
                            }
                        }
                    });
                    logger.info('Message event handler registered successfully');
                } catch (error) {
                    logger.error('Failed to initialize message handlers:', error);
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

        return sock;
    } catch (error) {
        logger.error('Error in WhatsApp connection:', error);
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