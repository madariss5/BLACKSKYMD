const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const path = require('path');
const fs = require('fs').promises;
const { messageHandler } = require('./handlers/messageHandler');

let sock = null;
let retryCount = 0;
const MAX_RETRIES = 10;
const RETRY_INTERVAL = 10000;
const AUTH_DIR = path.join(process.cwd(), 'auth_info');

async function validateSession() {
    try {
        const credentialsPath = path.join(AUTH_DIR, 'creds.json');
        const exists = await fs.access(credentialsPath)
            .then(() => true)
            .catch(() => false);

        if (!exists) {
            logger.info('No existing session found');
            return false;
        }

        const creds = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
        return !!creds?.me?.id;
    } catch (err) {
        logger.error('Error validating session:', err);
        return false;
    }
}

async function cleanAuthState() {
    try {
        await fs.rm(AUTH_DIR, { recursive: true, force: true });
        await fs.mkdir(AUTH_DIR, { recursive: true, mode: 0o700 });
        logger.info('Auth state cleaned successfully');
    } catch (err) {
        logger.error('Error cleaning auth state:', err);
        throw err;
    }
}

async function startConnection() {
    try {
        // Ensure auth directory exists with proper permissions
        await fs.mkdir(AUTH_DIR, { recursive: true, mode: 0o700 });

        // Get latest version of WhatsApp Web
        const { version } = await fetchLatestBaileysVersion();
        logger.info(`Using WA v${version.join('.')}`);

        // Validate existing session
        const isValidSession = await validateSession();
        if (!isValidSession && retryCount > 0) {
            logger.info('Invalid session detected, cleaning auth state');
            await cleanAuthState();
        }

        // Initialize auth state with enhanced error handling
        let state, saveCreds;
        try {
            const auth = await useMultiFileAuthState(AUTH_DIR);
            state = auth.state;
            saveCreds = auth.saveCreds;
        } catch (authErr) {
            logger.error('Auth state initialization failed:', authErr);
            await cleanAuthState();
            const auth = await useMultiFileAuthState(AUTH_DIR);
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
            connectTimeoutMs: 60000,
            qrTimeout: 60000,
            defaultQueryTimeoutMs: 30000,
            keepAliveIntervalMs: 15000,
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
                    // Format owner number properly
                    let ownerNumber = process.env.OWNER_NUMBER;
                    if (!ownerNumber.includes('@s.whatsapp.net')) {
                        // Remove any non-numeric characters
                        ownerNumber = ownerNumber.replace(/[^\d]/g, '');
                        // Ensure the number starts with the country code
                        if (!ownerNumber.startsWith('1') && !ownerNumber.startsWith('91')) {
                            ownerNumber = '1' + ownerNumber; // Default to US format if no country code
                        }
                        ownerNumber = `${ownerNumber}@s.whatsapp.net`;
                    }

                    await sock.sendMessage(ownerNumber, {
                        text: '𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻 Bot is now connected!'
                    });
                    logger.info('Startup message sent to owner');
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
                    const delay = Math.min(RETRY_INTERVAL * Math.pow(1.5, retryCount - 1), 300000);
                    logger.info(`Reconnecting (${retryCount}/${MAX_RETRIES}) in ${delay}ms...`);

                    // Clean auth state before retry if session is invalid
                    if (statusCode === DisconnectReason.connectionClosed) {
                        const isValid = await validateSession();
                        if (!isValid) {
                            await cleanAuthState();
                        }
                    }

                    setTimeout(startConnection, delay);
                } else {
                    if (!shouldReconnect) {
                        logger.error('Connection terminated due to logout or forbidden status. Please scan QR code again.');
                        await cleanAuthState();
                        process.exit(1);
                    } else {
                        logger.error('Max retry attempts reached. Connection terminated permanently');
                        process.exit(1);
                    }
                }
            }
        });

        sock.ev.on('messages.upsert', async ({ messages }) => {
            try {
                const message = messages[0];
                if (!message?.message) return; // Skip if no message content

                await messageHandler(sock, message);
            } catch (err) {
                logger.error('Error processing message:', err);
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
                    await fs.writeFile(path.join(AUTH_DIR, 'creds.json'), JSON.stringify(state.creds));
                    logger.info('Credentials recovered and saved manually');
                } catch (recoveryErr) {
                    logger.error('Failed to recover credentials:', recoveryErr);
                    await cleanAuthState();
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

                // Validate session before retry
                const isValid = await validateSession();
                if (!isValid) {
                    await cleanAuthState();
                }

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
                    await cleanAuthState();
                    logger.info('WhatsApp logout and cleanup successful');
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