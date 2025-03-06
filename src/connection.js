const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const { sessionManager } = require('./utils/sessionManager');
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
        const authDir = await ensureAuthDirs();

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        // Create socket with optimized configuration
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: logger,
            browser: ['WhatsApp-MD', 'Safari', '1.0.0'],
            // Connection settings
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 30000,
            keepAliveIntervalMs: 10000,
            retryRequestDelayMs: 2000,
            // Prevent timeout disconnects
            maxIdleTimeMs: 0,
            // Browser identification
            version: [2, 2323, 4],
            browser: ['BlackSky-MD', 'Safari', '1.0.0'],
            // Reconnect settings
            reconnectMode: 'on-any-error',
            shouldIgnoreJid: jid => !jid.includes('@s.whatsapp.net')
        });

        // Connection state management
        let connectionState = {
            qrGenerated: false,
            authenticated: false,
            connected: false
        };

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && !connectionState.qrGenerated) {
                connectionState.qrGenerated = true;
                logger.info('New QR code received. Please scan with WhatsApp.');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                logger.info('Connection closed due to ', lastDisconnect?.error?.message);

                if (shouldReconnect && retryCount < MAX_RETRIES) {
                    retryCount++;
                    logger.info(`Reconnecting... Attempt ${retryCount} of ${MAX_RETRIES}`);
                    setTimeout(async () => {
                        await startConnection();
                    }, RETRY_INTERVAL);
                } else {
                    logger.error('Connection closed permanently. Please restart the bot.');
                    process.exit(1);
                }
            }

            if (connection === 'open') {
                connectionState.connected = true;
                connectionState.authenticated = true;
                retryCount = 0;
                logger.info('Connected successfully to WhatsApp');

                try {
                    // Send test message to owner
                    const ownerJid = `${process.env.OWNER_NUMBER}@s.whatsapp.net`;
                    await sock.sendMessage(ownerJid, {
                        text: '𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻 Bot is now connected!'
                    });
                } catch (err) {
                    logger.error('Failed to send initial message:', err);
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', async () => {
            try {
                await saveCreds();
                logger.info('Credentials updated successfully');
            } catch (err) {
                logger.error('Failed to save credentials:', err);
            }
        });

        // Cleanup on process termination
        const cleanup = async () => {
            try {
                logger.info('Cleaning up...');
                await sock.logout();
                process.exit(0);
            } catch (err) {
                logger.error('Error during cleanup:', err);
                process.exit(1);
            }
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        return sock;
    } catch (err) {
        logger.error('Fatal error in connection:', err);
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            logger.info(`Retrying connection in ${RETRY_INTERVAL}ms...`);
            setTimeout(async () => {
                await startConnection();
            }, RETRY_INTERVAL);
        } else {
            throw err;
        }
    }
}

module.exports = { startConnection };