const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const path = require('path');
const fs = require('fs').promises;

let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_INTERVAL = 5000;

async function ensureAuthDirs() {
    const authDir = path.join(process.cwd(), 'auth_info');
    try {
        await fs.mkdir(authDir, { recursive: true });
        return authDir;
    } catch (err) {
        logger.error('Failed to create auth directory:', err);
        throw err;
    }
}

async function startConnection() {
    try {
        logger.info('Starting WhatsApp connection...');

        // Ensure auth directory exists
        const authDir = path.join(process.cwd(), 'auth_info');
        await fs.mkdir(authDir, { recursive: true });

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        // Create socket with basic configuration
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: logger,
            browser: ['WhatsApp-MD', 'Safari', '1.0.0'],
            version: [2, 2323, 4],
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 15000
        });

        // Connection update handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Detailed logging
            logger.info('Connection update received:', {
                connectionState: connection,
                hasError: !!lastDisconnect?.error,
                errorMessage: lastDisconnect?.error?.message,
                errorCode: lastDisconnect?.error?.output?.statusCode,
                retryAttempt: retryCount,
                hasQR: !!qr
            });

            if (qr) {
                logger.info('New QR code received, please scan with WhatsApp');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'open') {
                logger.info('Successfully connected to WhatsApp');
                retryCount = 0;

                // Send test message to owner
                try {
                    const ownerJid = `${process.env.OWNER_NUMBER}@s.whatsapp.net`;
                    await sock.sendMessage(ownerJid, {
                        text: '𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻 Bot is now connected!'
                    });
                    logger.info('Successfully sent connection message to owner');
                } catch (err) {
                    logger.error('Failed to send connection message:', err);
                }
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

                logger.warn('Connection closed:', {
                    shouldReconnect,
                    errorCode: lastDisconnect?.error?.output?.statusCode,
                    errorMessage: lastDisconnect?.error?.message,
                    retryCount
                });

                if (shouldReconnect && retryCount < MAX_RETRIES) {
                    retryCount++;
                    logger.info(`Attempting reconnection ${retryCount}/${MAX_RETRIES}`);

                    // Attempt to save credentials before reconnecting
                    try {
                        await saveCreds();
                    } catch (err) {
                        logger.error('Failed to save credentials before reconnection:', err);
                    }

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

        return sock;
    } catch (err) {
        logger.error('Fatal error in connection:', {
            error: err.message,
            stack: err.stack,
            retryCount
        });

        if (retryCount < MAX_RETRIES) {
            retryCount++;
            logger.info(`Retrying connection in ${RETRY_INTERVAL}ms...`);
            setTimeout(startConnection, RETRY_INTERVAL);
        } else {
            throw err;
        }
    }
}

module.exports = { startConnection };