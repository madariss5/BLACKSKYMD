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

async function startConnection() {
    try {
        console.clear();
        logger.info("Starting WhatsApp connection...\n");

        const authDir = path.join(process.cwd(), 'auth_info');
        // Don't clear auth directory on every start
        if (!fs.existsSync(authDir)) {
            await fsPromises.mkdir(authDir, { recursive: true });
        }

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
            retryRequestDelayMs: 2000
        });

        // Enhanced connection handling
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

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

                // Save session state immediately after successful connection
                await saveCreds();
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                logger.warn(`Connection closed. Reason: ${lastDisconnect?.error?.message}`);

                if (shouldReconnect && retryCount < MAX_RETRIES) {
                    retryCount++;
                    logger.info(`Reconnecting... Attempt ${retryCount}/${MAX_RETRIES}`);
                    setTimeout(async () => {
                        await startConnection();
                    }, RETRY_INTERVAL * retryCount); // Exponential backoff
                } else if (retryCount >= MAX_RETRIES) {
                    logger.error('Max retry attempts reached. Please restart the bot manually.');
                    process.exit(1);
                } else {
                    logger.error('Connection closed permanently. User logged out.');
                    process.exit(1);
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', async () => {
            logger.info('Credentials updated, saving...');
            await saveCreds();
        });

        // Handle messages
        sock.ev.on('messages.upsert', async (m) => {
            logger.debug('New message received');
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
            logger.info(`Retrying connection... Attempt ${retryCount}/${MAX_RETRIES}`);
            setTimeout(async () => {
                await startConnection();
            }, RETRY_INTERVAL * retryCount);
        } else {
            logger.error('Failed to connect after maximum retries');
            throw err;
        }
    }
}

module.exports = { startConnection };