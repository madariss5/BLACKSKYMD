const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const path = require('path');
const fs = require('fs').promises;

let sock = null;
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_INTERVAL = 5000;

async function startConnection() {
    try {
        // Ensure auth directory exists
        const authDir = path.join(process.cwd(), 'auth_info');
        await fs.mkdir(authDir, { recursive: true });

        // Get latest version of WhatsApp Web
        const { version } = await fetchLatestBaileysVersion();
        logger.info(`Using WA v${version.join('.')}`);

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        // Create socket with optimized configuration
        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            logger: logger,
            browser: ['WhatsApp-MD', 'Chrome', '1.0.0'],
            // Basic connection settings
            connectTimeoutMs: 30000,
            qrTimeout: 40000,
            defaultQueryTimeoutMs: 20000,
            // Keep-alive settings
            keepAliveIntervalMs: 10000,
            // Connection retry settings
            retryRequestDelayMs: 2000,
            // Browser identification
            markOnlineOnConnect: true
        });

        // Connection update handler
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Log connection updates
            logger.info('Connection state:', { 
                state: connection,
                hasQR: !!qr,
                error: lastDisconnect?.error?.message || 'none'
            });

            if (qr) {
                logger.info('Please scan QR code with WhatsApp');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'open') {
                logger.info('Connected to WhatsApp');
                retryCount = 0;

                // Notify owner
                try {
                    const ownerJid = `${process.env.OWNER_NUMBER}@s.whatsapp.net`;
                    sock.sendMessage(ownerJid, {
                        text: '𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻 Bot is now connected!'
                    });
                } catch (err) {
                    logger.error('Failed to send owner notification:', err);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                                     statusCode !== DisconnectReason.forbidden;

                logger.warn('Connection closed:', {
                    code: statusCode,
                    error: lastDisconnect?.error?.message,
                    willRetry: shouldReconnect && retryCount < MAX_RETRIES
                });

                if (shouldReconnect && retryCount < MAX_RETRIES) {
                    retryCount++;
                    logger.info(`Reconnecting (${retryCount}/${MAX_RETRIES})...`);
                    setTimeout(startConnection, RETRY_INTERVAL);
                } else {
                    logger.error('Connection terminated permanently');
                    process.exit(1);
                }
            }
        });

        // Credentials update handler
        sock.ev.on('creds.update', async () => {
            try {
                await saveCreds();
                logger.info('Credentials updated successfully');
            } catch (err) {
                logger.error('Failed to save credentials:', err);
            }
        });

        // Error handler
        sock.ev.on('error', (err) => {
            logger.error('Connection error:', err);
        });

        // Process termination handlers
        const cleanup = async () => {
            if (sock) {
                logger.info('Cleaning up connection...');
                try {
                    await sock.logout();
                    await sock.end();
                } catch (err) {
                    logger.error('Error during cleanup:', err);
                }
            }
            process.exit(0);
        };

        process.on('SIGTERM', cleanup);
        process.on('SIGINT', cleanup);
        process.on('uncaughtException', (err) => {
            logger.error('Uncaught exception:', err);
            cleanup();
        });

        return sock;
    } catch (err) {
        logger.error('Fatal connection error:', err);

        if (retryCount < MAX_RETRIES) {
            retryCount++;
            logger.info(`Retrying in ${RETRY_INTERVAL}ms...`);
            setTimeout(startConnection, RETRY_INTERVAL);
        } else {
            throw err;
        }
    }
}

module.exports = { startConnection };