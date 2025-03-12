const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const pino = require('pino');
const logger = require('./utils/logger');

let sock = null;
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_INTERVAL = 5000; // 5 seconds
const RECONNECT_INTERVAL = 3000; // 3 seconds

async function ensureAuthDir() {
    const authDir = path.join(process.cwd(), 'auth_info');
    try {
        if (!fs.existsSync(authDir)) {
            await fsPromises.mkdir(authDir, { recursive: true });
            logger.info('Created auth directory');
        }
        return authDir;
    } catch (err) {
        logger.error('Error creating auth directory:', err);
        throw err;
    }
}

async function displayQR(qr) {
    try {
        // Clear console and add spacing
        console.clear();
        console.log('\n'.repeat(2));

        logger.info('⚡ NEW QR CODE RECEIVED ⚡');
        logger.info('Please scan this QR code with WhatsApp on your phone:');
        console.log('\n'.repeat(1));

        // Generate QR with custom size
        qrcode.generate(qr, { small: false }, (qrResult) => {
            console.log(qrResult);
            console.log('\n'.repeat(1));
            logger.info('Waiting for you to scan the QR code...');
            logger.info('Note: QR code will refresh if not scanned soon.');
        });
    } catch (err) {
        logger.error('Error displaying QR code:', err);
        // Try alternative display method
        console.log('\nQR CODE (if not visible, try resizing your terminal):\n');
        qrcode.generate(qr, { small: true });
    }
}

async function startConnection() {
    try {
        console.clear();
        logger.info("Starting WhatsApp connection...\n");

        const authDir = await ensureAuthDir();

        logger.info('Loading auth state...');
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        logger.info('Initializing WhatsApp connection...');
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true, // Enable native QR printing temporarily for debugging
            browser: ['WhatsApp Bot', 'Firefox', '2.0.0'],
            logger: pino({ level: 'info' }), // Enable more detailed logging
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            emitOwnEvents: true,
            retryRequestDelayMs: 2000,
            version: [2, 2323, 4],
            // Add these connection parameters
            patchMessageBeforeSending: false,
            getMessage: async () => {
                return { conversation: 'hello' };
            },
            markOnlineOnConnect: false, // Don't mark as online immediately
            syncFullHistory: false, // Don't sync full history to reduce load
            userDevicesCache: false, // Disable device cache
            transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
            // Add WebSocket options
            ws: {
                connectTimeoutMs: 30000,
                keepAliveIntervalMs: 25000,
                retryOnServerClose: true,
                retryOnTimeout: true,
                retryCount: 5
            }
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Debug log the entire update object
            logger.info('Connection update received:', JSON.stringify(update, null, 2));

            if(qr) {
                logger.info('QR Code received, length:', qr.length);
                logger.info('Attempting to display QR code...');
                // Try both display methods
                await displayQR(qr);
                // Force QR to display using native method as backup
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'connecting') {
                logger.info('Connecting to WhatsApp...');
            }

            if (connection === 'open') {
                retryCount = 0; // Reset retry count on successful connection
                logger.info('Connected successfully to WhatsApp!');

                try {
                    await saveCreds(); // Save session immediately
                    logger.info('Session credentials saved successfully');
                } catch (err) {
                    logger.error('Error saving session credentials:', err);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                const error = lastDisconnect?.error?.message || 'Unknown error';

                logger.warn(`Connection closed. Status: ${statusCode}, Error: ${error}`);

                if (shouldReconnect && retryCount < MAX_RETRIES) {
                    retryCount++;
                    const delay = RETRY_INTERVAL * Math.pow(2, retryCount - 1); // Exponential backoff
                    logger.info(`Reconnecting... Attempt ${retryCount}/${MAX_RETRIES} in ${delay}ms`);

                    setTimeout(async () => {
                        try {
                            await startConnection();
                        } catch (err) {
                            logger.error('Error during reconnection:', err);
                        }
                    }, delay);
                } else if (retryCount >= MAX_RETRIES) {
                    logger.error('Max retry attempts reached. Please restart the bot manually.');
                    process.exit(1);
                } else {
                    logger.error('Connection closed permanently. User logged out.');
                    // Clean up auth state before exiting
                    try {
                        const authDir = path.join(process.cwd(), 'auth_info');
                        if (fs.existsSync(authDir)) {
                            await fsPromises.rm(authDir, { recursive: true, force: true });
                            logger.info('Auth state cleaned up');
                        }
                    } catch (err) {
                        logger.error('Error cleaning up auth state:', err);
                    }
                    process.exit(1);
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', async () => {
            logger.info('Credentials updated, saving...');
            try {
                await saveCreds();
                logger.info('Credentials saved successfully');
            } catch (err) {
                logger.error('Error saving credentials:', err);
            }
        });

        // Handle messages
        sock.ev.on('messages.upsert', async (m) => {
            logger.debug('New message received:', m.type);
        });

        // Handle errors
        process.on('unhandledRejection', (err) => {
            logger.error('Unhandled promise rejection:', err);
        });

        return sock;
    } catch (err) {
        logger.error('Connection error:', err);
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = RETRY_INTERVAL * Math.pow(2, retryCount - 1);
            logger.info(`Retrying connection... Attempt ${retryCount}/${MAX_RETRIES} in ${delay}ms`);

            setTimeout(async () => {
                try {
                    await startConnection();
                } catch (err) {
                    logger.error('Error during retry:', err);
                }
            }, delay);
        } else {
            logger.error('Failed to connect after maximum retries');
            throw err;
        }
    }
}

module.exports = { startConnection };