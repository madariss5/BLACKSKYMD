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
            printQRInTerminal: true,
            browser: ['Chrome (Linux)', '', ''],
            logger: pino({ level: 'silent' }),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            emitOwnEvents: true,
            retryRequestDelayMs: 2000,
            version: [2, 2323, 4],
            browser: ['WhatsApp-MD', 'Chrome', '4.0.0'],
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            logger.info('Connection state update:', { connection, qr: !!qr });

            if(qr) {
                logger.info('\nQR Code received, scan with WhatsApp to connect\n');
                qrcode.generate(qr, {small: false});
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