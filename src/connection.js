const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const { sessionManager } = require('./utils/sessionManager');
const config = require('./config/config');
const { languageManager } = require('./utils/language');

// Enhanced exponential backoff with max delay
const getRetryDelay = (attempt) => {
    const maxDelay = 300000; // 5 minutes max
    return Math.min(1000 * Math.pow(2, attempt), maxDelay);
};

async function startConnection(retryCount = 0) {
    try {
        logger.info('Initializing WhatsApp connection...');
        await languageManager.loadTranslations();

        // Check for required configuration
        const { isValid, missingVars } = config.validateConfig();
        if (!isValid) {
            logger.warn(`Missing required configuration: ${missingVars.join(', ')}`);
        }

        const { state, saveCreds } = await useMultiFileAuthState(config.session.authDir);

        const sock = makeWASocket({
            printQRInTerminal: true,
            auth: state,
            logger: logger,
            defaultQueryTimeoutMs: 60000, // 1 minute timeout
            connectTimeoutMs: 60000,
            retryRequestDelayMs: getRetryDelay(retryCount),
            browser: ['𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻', 'Chrome', '1.0.0'],
            connectionRetryInterval: getRetryDelay(retryCount),
            markOnlineOnConnect: true,
            syncFullHistory: false // Reduce initial sync time
        });

        // Enhanced connection handling
        sock.ev.on('connection.update', async ({ qr, connection, lastDisconnect }) => {
            const logContext = {
                connection,
                retryCount,
                statusCode: lastDisconnect?.error?.output?.statusCode
            };
            logger.debug('Connection update received:', logContext);

            if (qr) {
                logger.info('New QR code generated, please scan with WhatsApp');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'connecting') {
                logger.info(`Attempting to connect (Attempt ${retryCount + 1})`);
            }

            if (connection === 'open') {
                logger.info('Successfully connected to WhatsApp!');
                retryCount = 0; // Reset retry counter on successful connection

                if (config.owner.number) {
                    const startupMessage = languageManager.getText('system.connected');
                    await sock.sendMessage(config.owner.number, { 
                        text: startupMessage 
                    }).catch(err => logger.error('Failed to send startup message:', err));
                }

                // Initialize session backup
                await sessionManager.createBackupSchedule(sock);
                await sessionManager.backupCredentials(sock);
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                logger.info('Connection closed:', { 
                    statusCode,
                    shouldReconnect,
                    retryCount,
                    maxRetries: config.settings.maxRetries
                });

                if (shouldReconnect && retryCount < config.settings.maxRetries) {
                    const delay = getRetryDelay(retryCount);
                    logger.info(`Scheduling reconnection in ${delay/1000}s...`);

                    // Clean up before reconnecting
                    sock.ev.removeAllListeners('connection.update');
                    sock.ev.removeAllListeners('creds.update');

                    setTimeout(async () => {
                        try {
                            await sessionManager.restoreFromBackup();
                            await startConnection(retryCount + 1);
                        } catch (err) {
                            logger.error('Failed to reconnect:', err);
                        }
                    }, delay);
                } else if (statusCode === DisconnectReason.loggedOut) {
                    logger.warn('Session logged out, clearing session and restarting...');
                    await sessionManager.clearSession();
                    await startConnection(0);
                } else {
                    logger.error(`Connection terminated: Max retries (${config.settings.maxRetries}) reached or fatal error`);
                    throw new Error('Connection terminated');
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', async () => {
            logger.debug('Credentials updated');
            await saveCreds();
        });

        // Implement proper cleanup
        const cleanup = async () => {
            logger.info('Cleaning up connection...');
            try {
                await sessionManager.backupCredentials(sock);
                sock.ev.removeAllListeners();
                await sock.logout();
                await sock.end();
            } catch (err) {
                logger.error('Error during cleanup:', err);
            }
        };

        process.on('SIGTERM', cleanup);
        process.on('SIGINT', cleanup);

        return sock;
    } catch (err) {
        logger.error('Error in connection:', err);

        if (retryCount < config.settings.maxRetries) {
            const delay = getRetryDelay(retryCount);
            logger.info(`Retrying connection in ${delay/1000}s... (Attempt ${retryCount + 1}/${config.settings.maxRetries})`);

            return new Promise((resolve) => {
                setTimeout(async () => {
                    try {
                        const sock = await startConnection(retryCount + 1);
                        resolve(sock);
                    } catch (retryErr) {
                        logger.error('Retry failed:', retryErr);
                        resolve(null);
                    }
                }, delay);
            });
        }

        throw new Error(`Failed to establish connection after ${config.settings.maxRetries} attempts`);
    }
}

module.exports = { startConnection };