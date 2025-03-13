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
    messageHandler = require('./src/handlers/messageHandler').messageHandler;
} catch (err) {
    console.error('Failed to load message handler:', err);
    process.exit(1);
}

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
        auth_dir: AUTH_DIR
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
            }
        });

        // Handle messages
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type === 'notify') {
                for (const message of messages) {
                    try {
                        await messageHandler(sock, message);
                    } catch (err) {
                        logger.error('Error handling message:', err);
                        // Log full error details for debugging
                        logger.error('Full error details:', {
                            name: err.name,
                            message: err.message,
                            stack: err.stack,
                            cause: err.cause
                        });
                    }
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
    isJidBroadcast
};