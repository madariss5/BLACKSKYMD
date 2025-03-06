const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const path = require('path');
const fs = require('fs').promises;

let sock = null;
let retryCount = 0;
const MAX_RETRIES = 10; // Increased from 5 to 10
const RETRY_INTERVAL = 10000; // Increased from 5000 to 10000

async function startConnection() {
    try {
        // Ensure auth directory exists with proper permissions
        const authDir = path.join(process.cwd(), 'auth_info');
        await fs.mkdir(authDir, { recursive: true, mode: 0o700 });

        // Get latest version of WhatsApp Web
        const { version } = await fetchLatestBaileysVersion();
        logger.info(`Using WA v${version.join('.')}`);

        // Initialize auth state with enhanced error handling
        let state, saveCreds;
        try {
            const auth = await useMultiFileAuthState(authDir);
            state = auth.state;
            saveCreds = auth.saveCreds;
        } catch (authErr) {
            logger.error('Auth state initialization failed:', authErr);
            // Clear auth directory and retry
            await fs.rm(authDir, { recursive: true, force: true });
            await fs.mkdir(authDir, { recursive: true, mode: 0o700 });
            const auth = await useMultiFileAuthState(authDir);
            state = auth.state;
            saveCreds = auth.saveCreds;
        }

        // Create socket with improved configuration
        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            logger: logger,
            browser: ['WhatsApp-MD', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000, // Increased timeout
            qrTimeout: 60000, // Increased QR timeout
            defaultQueryTimeoutMs: 30000,
            keepAliveIntervalMs: 15000, // Increased keep-alive interval
            retryRequestDelayMs: 5000,
            markOnlineOnConnect: true,
            // Additional connection stability options
            maxRetries: 10,
            patchMessageBeforeSending: true,
            getMessage: async () => {
                return { conversation: 'retry' };
            }
        });

        // Enhanced connection update handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            logger.info('Connection state:', {
                state: connection,
                hasQR: !!qr,
                error: lastDisconnect?.error?.message || 'none',
                retryCount
            });

            if (qr) {
                logger.info('New QR code received. Please scan with WhatsApp');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'open') {
                logger.info('Connected to WhatsApp');
                retryCount = 0;

                try {
                    const ownerJid = `${process.env.OWNER_NUMBER}@s.whatsapp.net`;
                    await sock.sendMessage(ownerJid, {
                        text: '𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻 Bot is now connected!'
                    });
                } catch (err) {
                    logger.warn('Failed to send owner notification:', err);
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
                    const delay = Math.min(RETRY_INTERVAL * Math.pow(1.5, retryCount - 1), 300000); // Exponential backoff
                    logger.info(`Reconnecting (${retryCount}/${MAX_RETRIES}) in ${delay}ms...`);
                    setTimeout(startConnection, delay);
                } else if (!shouldReconnect) {
                    logger.error('Connection terminated due to logout or forbidden status');
                    process.exit(1);
                } else {
                    logger.error('Max retry attempts reached. Connection terminated permanently');
                    process.exit(1);
                }
            }
        });

        // Enhanced credentials update handler
        sock.ev.on('creds.update', async () => {
            try {
                await saveCreds();
                logger.info('Credentials updated and saved successfully');
            } catch (err) {
                logger.error('Failed to save credentials:', err);
                // Attempt to recreate auth files
                try {
                    await fs.writeFile(path.join(authDir, 'creds.json'), JSON.stringify(state.creds));
                    logger.info('Credentials recovered and saved manually');
                } catch (recoveryErr) {
                    logger.error('Failed to recover credentials:', recoveryErr);
                }
            }
        });

        // Enhanced error handler
        sock.ev.on('error', async (err) => {
            logger.error('Connection error:', {
                error: err.message,
                stack: err.stack,
                retryCount
            });

            if (retryCount < MAX_RETRIES) {
                retryCount++;
                const delay = Math.min(RETRY_INTERVAL * Math.pow(1.5, retryCount - 1), 300000);
                logger.info(`Attempting recovery (${retryCount}/${MAX_RETRIES}) in ${delay}ms...`);
                setTimeout(startConnection, delay);
            }
        });

        // Enhanced cleanup handler
        const cleanup = async (signal) => {
            logger.info(`Received ${signal} signal. Starting cleanup...`);

            if (sock) {
                try {
                    logger.info('Logging out of WhatsApp...');
                    await sock.logout();
                    await sock.end();
                    logger.info('WhatsApp logout successful');
                } catch (err) {
                    logger.error('Error during WhatsApp cleanup:', err);
                }
            }

            process.exit(0);
        };

        process.on('SIGTERM', () => cleanup('SIGTERM'));
        process.on('SIGINT', () => cleanup('SIGINT'));
        process.on('uncaughtException', (err) => {
            logger.error('Uncaught exception:', err);
            cleanup('UNCAUGHT_EXCEPTION');
        });

        return sock;
    } catch (err) {
        logger.error('Fatal connection error:', {
            error: err.message,
            stack: err.stack,
            retryCount
        });

        if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = Math.min(RETRY_INTERVAL * Math.pow(1.5, retryCount - 1), 300000);
            logger.info(`Retrying connection (${retryCount}/${MAX_RETRIES}) in ${delay}ms...`);
            setTimeout(startConnection, delay);
        } else {
            throw err;
        }
    }
}

module.exports = { startConnection };