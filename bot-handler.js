// Load environment variables first
require('dotenv').config();

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

// Import message handlers with error handling
let messageHandler;
try {
    const { messageHandler: handler } = require('./src/handlers/messageHandler');
    messageHandler = handler;
} catch (err) {
    console.error('Failed to load message handler:', err);
    process.exit(1);
}

// Load command handler
const { getAllCommands } = require('./src/handlers/commandHandler');

// Configure options based on environment variables
const AUTH_DIR = process.env.AUTH_DIR || 'auth_info_qr';
const BOT_MODE = process.env.BOT_MODE || 'BOT_HANDLER';
const SESSION_DIR = path.join(__dirname, AUTH_DIR);
const BACKUP_DIR = path.join(__dirname, 'sessions');
const PORT = parseInt(process.env.BOT_PORT || '5001', 10);

// Set up pino logger
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

// Verify command handler initialization
const availableCommands = getAllCommands();
logger.info('Command handler initialized with commands:', {
    count: availableCommands.length,
    commands: availableCommands
});

// Initialize express app
const app = express();
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
});

// Basic health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        port: PORT,
        mode: BOT_MODE,
        auth_dir: AUTH_DIR,
        availableCommands
    });
});

// Globals
let sock = null;
let startTime = Date.now();
let connectionState = {
    state: 'disconnected',
    qrCode: null,
    uptime: 0,
    connected: false,
    disconnectReason: null
};

let qrCount = 0;
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
 * Get formatted uptime string
 */
function getUptime() {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Get current connection status
 */
function getConnectionStatus() {
    connectionState.uptime = getUptime();
    return connectionState;
}

/**
 * Clear authentication data
 */
async function clearAuthData(force = false) {
    try {
        if (force ||
            connectionState.disconnectReason === DisconnectReason.loggedOut ||
            connectionState.disconnectReason === 440) {

            if (fs.existsSync(SESSION_DIR)) {
                fs.rmSync(SESSION_DIR, { recursive: true, force: true });
                fs.mkdirSync(SESSION_DIR, { recursive: true });
                logger.info('Authentication data cleared');
            }

            // Reset connection state
            connectionState.state = 'disconnected';
            connectionState.qrCode = null;
            connectionState.connected = false;
            connectionState.disconnectReason = null;
            isConnecting = false;
        }
    } catch (error) {
        logger.error('Error clearing auth data:', error);
    }
}

/**
 * Initialize WhatsApp connection with retry logic
 */
async function connectToWhatsApp(retryCount = 0) {
    // Prevent multiple connection attempts
    if (isConnecting) {
        logger.info('Connection attempt already in progress, skipping...');
        return;
    }

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
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'silent' }),
            browser: ['𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻', 'Chrome', '121.0.0'],
            connectTimeoutMs: 30000,
            defaultQueryTimeoutMs: 30000,
            emitOwnEvents: false,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            mobile: false,
            shouldIgnoreJid: jid => isJidBroadcast(jid)
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            logger.info('Connection update:', update);

            if (qr) {
                connectionState.state = 'qr_ready';
                connectionState.qrCode = qr;
                qrCount++;
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                connectionState.state = 'disconnected';
                connectionState.connected = false;
                connectionState.disconnectReason = statusCode;
                isConnecting = false;

                logger.info(`Connection closed with status code: ${statusCode}`);

                // Handle session conflict
                if (statusCode === 440) {
                    logger.info('Session conflict detected, clearing auth...');
                    await clearAuthData(true);
                    setTimeout(() => connectToWhatsApp(0), 5000);
                    return;
                }

                // Handle other disconnections
                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    await clearAuthData(true);
                    setTimeout(() => connectToWhatsApp(0), 5000);
                } else if (retryCount < RETRY_CONFIG.maxRetries) {
                    const delay = getRetryDelay(retryCount);
                    setTimeout(() => connectToWhatsApp(retryCount + 1), delay);
                } else {
                    logger.info('Max retries reached, manual restart needed');
                    await resetConnection();
                }
            } else if (connection === 'open') {
                logger.info('🟢 WhatsApp connection established!');
                connectionState.state = 'connected';
                connectionState.connected = true;
                isConnecting = false;
                retryCount = 0;

                // Initialize message handling
                logger.info('Initializing message handlers...');
                try {
                    // Set up message event handlers
                    sock.ev.off('messages.upsert'); // Remove any existing handlers
                    sock.ev.on('messages.upsert', async ({ messages, type }) => {
                        logger.info('Messages event received:', {
                            type,
                            messageCount: messages.length,
                            isNotify: type === 'notify',
                            messageTypes: messages.map(m => m.message ? Object.keys(m.message) : [])
                        });

                        if (type === 'notify') {
                            for (const message of messages) {
                                // Skip own messages to prevent loops
                                if (message.key.fromMe) {
                                    logger.debug('Skipping message from self');
                                    continue;
                                }

                                try {
                                    // Extract message content for debugging
                                    const content = message.message?.conversation ||
                                                    message.message?.extendedTextMessage?.text ||
                                                    message.message?.imageMessage?.caption ||
                                                    message.message?.videoMessage?.caption;

                                    logger.info('Processing incoming message:', {
                                        content,
                                        messageType: message.message ? Object.keys(message.message)[0] : null,
                                        remoteJid: message.key.remoteJid
                                    });

                                    await handleIncomingMessage(sock, message);
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
                    logger.info('Message handlers initialized successfully');
                } catch (error) {
                    logger.error('Failed to initialize message handlers:', error);
                }

                // Set up backup and send initial backup
                setupSessionBackup();
                setTimeout(() => sendCredsToSelf(sock), 5000);
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

/**
 * Reset the connection state and reconnect
 */
async function resetConnection() {
    try {
        logger.info('🔄 Manually resetting connection...');

        if (sock) {
            try {
                sock.ev.removeAllListeners();
                await sock.logout();
            } catch (e) {
                logger.warn('Error during logout:', e);
            }
            sock = null;
        }

        await clearAuthData(true);

        // Wait before reconnecting
        setTimeout(() => connectToWhatsApp(0), 5000);

        return { success: true, message: 'Connection reset initiated' };
    } catch (error) {
        logger.error('Error resetting connection:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Send creds.json file to the bot itself for backup
 */
async function sendCredsToSelf(sock) {
    try {
        // Wait for a short time to ensure connection is ready
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check if connected
        if (!sock || !connectionState.connected) {
            logger.warn('Cannot send creds file: Bot not connected');
            return;
        }

        // Check if creds.json exists
        const credsPath = path.join(SESSION_DIR, 'creds.json');
        if (!fs.existsSync(credsPath)) {
            logger.warn('Cannot send creds file: creds.json does not exist');
            return;
        }

        // Read and compress the creds.json file
        const credsData = fs.readFileSync(credsPath, 'utf8');
        const compressedCreds = JSON.stringify(JSON.parse(credsData)).replace(/\s+/g, '');

        // Get bot's own JID
        const botJid = sock.user.id;

        // Send the message with the creds data to the bot itself
        await sock.sendMessage(botJid, {
            text: `🔐 *BLACKSKY-MD BACKUP*\n\nHere is your creds.json for backup purposes:\n\n\`\`\`${compressedCreds}\`\`\``
        });
        logger.info('Credentials backup sent to bot itself');
    } catch (error) {
        logger.error('Error sending creds to bot:', error);
    }
}

/**
 * Setup session backup at regular intervals
 */
function setupSessionBackup() {
    const BACKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
    let backupInterval = null;

    if (backupInterval) {
        clearInterval(backupInterval);
    }

    backupInterval = setInterval(() => {
        try {
            const timestamp = Date.now();
            const backupPath = path.join(BACKUP_DIR, `creds_backup_${timestamp}.json`);

            // Copy current auth file
            const authFiles = fs.readdirSync(SESSION_DIR);
            for (const file of authFiles) {
                if (file.includes('creds')) {
                    const srcPath = path.join(SESSION_DIR, file);
                    fs.copyFileSync(srcPath, backupPath);
                    logger.info(`Session backup created: ${backupPath}`);
                    break;
                }
            }

            // Limit number of backups to 5
            const backups = fs.readdirSync(BACKUP_DIR)
                .filter(file => file.startsWith('creds_backup_'))
                .sort();

            if (backups.length > 5) {
                const oldestBackup = path.join(BACKUP_DIR, backups[0]);
                fs.unlinkSync(oldestBackup);
                logger.info(`Removed old backup: ${oldestBackup}`);
            }
        } catch (error) {
            logger.error('Error creating session backup:', error);
        }
    }, BACKUP_INTERVAL);

    return backupInterval;
}

// Handle messages with proper error handling
async function handleIncomingMessage(sock, message) {
    try {
        // Log full message details for debugging
        logger.info('Processing message:', {
            messageId: message.key?.id,
            remoteJid: message.key?.remoteJid,
            messageType: message.message ? Object.keys(message.message)[0] : null,
            messageContent: message.message?.conversation ||
                            message.message?.extendedTextMessage?.text ||
                            message.message?.imageMessage?.caption ||
                            message.message?.videoMessage?.caption
        });

        // Skip invalid messages
        if (!message?.key?.remoteJid || !message.message) {
            logger.debug('Skipping invalid message');
            return;
        }

        // Process message through handler
        await messageHandler(sock, message);
        logger.info('Message processed successfully');

    } catch (err) {
        logger.error('Error in handleIncomingMessage:', {
            error: err.message,
            stack: err.stack,
            messageId: message.key?.id,
            remoteJid: message.key?.remoteJid
        });
    }
}



/**
 * Start application
 */
async function start() {
    try {
        logger.info('Starting 𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻...');
        logger.info('Environment:', {
            NODE_ENV: process.env.NODE_ENV || 'development',
            BOT_MODE,
            AUTH_DIR,
            PORT
        });

        // Create required directories
        [SESSION_DIR, BACKUP_DIR].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

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

// Start application if running directly
if (require.main === module) {
    start().catch((error) => {
        logger.error('Fatal error during startup:', error);
        process.exit(1);
    });
}

module.exports = {
    connectToWhatsApp,
    getConnectionStatus,
    resetConnection,
    start,
    getUptime,
    isJidBroadcast,
    sendCredsToSelf,
    setupSessionBackup
};