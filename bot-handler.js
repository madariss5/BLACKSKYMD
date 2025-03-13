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

    // Load the simpler message handler to avoid dependency issues
    try {
        logger.info('Loading simple message handler...');
        const simpleHandler = require('./src/handlers/simpleMessageHandler');
        messageHandler = simpleHandler.messageHandler;

        if (!messageHandler) {
            throw new Error('Simple message handler failed to load properly');
        }

        logger.info('Simple message handler loaded successfully with basic commands');
    } catch (simpleHandlerErr) {
        logger.error('Failed to load simple message handler:', simpleHandlerErr);

        // Fallback to original handler if simple one fails
        logger.warn('Attempting to load original message handler as fallback...');
        const messageHandlerModule = require('./src/handlers/messageHandler');
        messageHandler = messageHandlerModule.messageHandler;

        if (!messageHandler) {
            throw new Error('All message handlers failed to load properly');
        }

        logger.info('Original message handler loaded as fallback');
    }

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

// Root endpoint for web interface
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>WhatsApp Bot Status</title>
            </head>
            <body>
                <h1>WhatsApp Bot Status</h1>
                <p>Status: Active</p>
                <p>Port: ${PORT}</p>
                <p>Commands Loaded: ${commandHandler.commands.size}</p>
            </body>
        </html>
    `);
});

// Configure retry settings
const RETRY_CONFIG = {
    maxRetries: 5,
    baseDelay: 10000, // 10 seconds
    maxDelay: 60000,  // 1 minute
    connectionTimeout: 30000 // 30 seconds
};

// Connection state tracking
let connectionState = {
    state: 'disconnected',
    qrCode: null,
    connected: false,
    lastError: null,
    reconnectCount: 0,
    reconnectTimer: null,
    isReconnecting: false
};

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt) {
    const delay = Math.min(
        RETRY_CONFIG.maxDelay,
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt)
    );
    // Add some randomness to prevent thundering herd
    return delay + (Math.random() * 1000);
}

/**
 * Helper function to check broadcast JIDs
 */
function isJidBroadcast(jid) {
    return jid?.endsWith('@broadcast');
}

// Message handler setup with improved error checking
async function setupMessageEventHandler(sock, handlerFunction) {
    try {
        // Validate handler function
        if (typeof handlerFunction !== 'function') {
            throw new Error('Invalid message handler: not a function');
        }

        // Create a wrapper function to process messages
        const messageProcessor = async ({ messages, type }) => {
            if (type === 'notify' && Array.isArray(messages)) {
                for (const message of messages) {
                    // Skip if message is invalid or from self
                    if (!message || !message.key || message.key.fromMe) continue;

                    // Call the handler with error catching
                    try {
                        await handlerFunction(sock, message);
                    } catch (err) {
                        logger.error('Message handling error:', err);
                    }
                }
            }
        };

        // Safely remove existing handlers
        try {
            sock.ev.off('messages.upsert');
        } catch (err) {
            logger.warn('Error removing existing handlers:', err);
        }

        // Set up new handler
        sock.ev.on('messages.upsert', messageProcessor);
        logger.info('Message handler setup completed successfully');
        return true;
    } catch (err) {
        logger.error('Error setting up message event handler:', err);
        return false;
    }
}

/**
 * Safe reconnection handler
 */
async function handleReconnection(retryCount = 0) {
    // Prevent multiple reconnection attempts
    if (connectionState.isReconnecting) {
        logger.warn('Reconnection already in progress, skipping...');
        return;
    }

    try {
        connectionState.isReconnecting = true;
        connectionState.state = 'connecting';
        logger.info(`Attempting reconnection (attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries})`);

        // Clear any existing timer
        if (connectionState.reconnectTimer) {
            clearTimeout(connectionState.reconnectTimer);
            connectionState.reconnectTimer = null;
        }

        // Initialize WhatsApp connection
        const sock = await connectToWhatsApp(retryCount);

        if (!sock) {
            throw new Error('Failed to create socket connection');
        }

        return sock;
    } catch (error) {
        logger.error('Reconnection attempt failed:', error);

        // Schedule next retry if within limits
        if (retryCount < RETRY_CONFIG.maxRetries) {
            const delay = getRetryDelay(retryCount);
            logger.info(`Scheduling next reconnection attempt in ${delay/1000} seconds...`);

            connectionState.reconnectTimer = setTimeout(() => {
                handleReconnection(retryCount + 1);
            }, delay);
        } else {
            logger.error('Maximum reconnection attempts reached');
            connectionState.state = 'failed';
        }
    } finally {
        connectionState.isReconnecting = false;
    }
}

// Initialize WhatsApp connection with retry logic
async function connectToWhatsApp(retryCount = 0) {
    try {
        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

        // Create WhatsApp socket connection with optimized settings
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'silent' }),
            browser: ['𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻', 'Chrome', '121.0.0'],
            connectTimeoutMs: RETRY_CONFIG.connectionTimeout,
            defaultQueryTimeoutMs: 20000,
            markOnlineOnConnect: true,
            keepAliveIntervalMs: 15000,
            emitOwnEvents: false,
            syncFullHistory: false,
            patchMessageBeforeSending: false,
            shouldIgnoreJid: jid => isJidBroadcast(jid)
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                connectionState.state = 'qr_ready';
                connectionState.qrCode = qr;
                logger.info('New QR code generated');
            }

            if (connection === 'connecting') {
                connectionState.state = 'connecting';
                logger.info('Connecting to WhatsApp...');
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut &&
                                     retryCount < RETRY_CONFIG.maxRetries &&
                                     !connectionState.isReconnecting;

                connectionState.state = 'disconnected';
                connectionState.connected = false;
                connectionState.lastError = lastDisconnect?.error;

                if (shouldReconnect) {
                    handleReconnection(retryCount);
                } else {
                    logger.error('Connection closed permanently:', lastDisconnect?.error);
                }
            }

            if (connection === 'open') {
                logger.info('🟢 WhatsApp connection established!');
                connectionState.state = 'connected';
                connectionState.connected = true;
                connectionState.reconnectCount = 0;
                connectionState.lastError = null;

                try {
                    // Initialize handlers
                    logger.info('Loading message handler...');
                    const { messageHandler: simpleHandler, init } = require('./src/handlers/simpleMessageHandler');

                    if (!simpleHandler || typeof simpleHandler !== 'function') {
                        throw new Error('Invalid message handler loaded');
                    }

                    // Initialize the handler
                    await init();
                    logger.info('Message handler initialized');

                    // Set up the message event handler
                    if (await setupMessageEventHandler(sock, simpleHandler)) {
                        logger.info('Message handler setup complete');
                    } else {
                        throw new Error('Failed to set up message handler');
                    }
                } catch (err) {
                    logger.error('Handler initialization failed:', err);

                    // Setup emergency handler
                    const emergencyHandler = async (sock, message) => {
                        try {
                            const content = message.message?.conversation ||
                                         message.message?.extendedTextMessage?.text;

                            if (content?.startsWith('!') && message.key?.remoteJid) {
                                const sender = message.key.remoteJid;
                                if (content.trim() === '!ping') {
                                    await sock.sendMessage(sender, { 
                                        text: '🏓 Pong! (Emergency Mode)' 
                                    });
                                }
                            }
                        } catch (err) {
                            logger.error('Emergency handler error:', err);
                        }
                    };

                    // Set up emergency handler
                    await setupMessageEventHandler(sock, emergencyHandler);
                    logger.info('Emergency handler activated');
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

        return sock;
    } catch (error) {
        logger.error('Error in WhatsApp connection:', error);
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
    logger.error('Uncaught Exception - recovering if possible:', err);
    console.error('Uncaught Exception occurred:', err);

    // Only exit for severe errors that we can't recover from
    if (err.code === 'EADDRINUSE' ||
        err.code === 'EACCES' ||
        err.message.includes('Cannot find module')) {
        process.exit(1);
    }
    // For other errors, try to continue
});

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection - bot will continue running:', err);
    console.error('Unhandled Promise Rejection:', err);
    // Don't exit process - log and continue
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