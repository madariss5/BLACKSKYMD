const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const { sessionManager } = require('./utils/sessionManager');
const config = require('./config/config');
const { languageManager } = require('./utils/language');

// Exponential backoff implementation
const getRetryDelay = (attempt) => {
    return Math.min(1000 * Math.pow(2, attempt), config.settings.retryDelay);
};

async function startConnection(retryCount = 0) {
    try {
        await languageManager.loadTranslations();
        const { state, saveCreds } = await useMultiFileAuthState(config.session.authDir);

        const sock = makeWASocket({
            printQRInTerminal: true,
            auth: state,
            logger: logger,
            defaultQueryTimeoutMs: undefined,
            connectTimeoutMs: 60000,
            retryRequestDelayMs: getRetryDelay(retryCount),
            browser: ['𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻', 'Chrome', '1.0.0']
        });

        // Handle authentication
        sock.ev.on('creds.update', saveCreds);

        // Handle QR code and connection status
        sock.ev.on('connection.update', async ({ qr, connection, lastDisconnect }) => {
            if (qr) {
                logger.info('New QR code generated, please scan with WhatsApp');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'open') {
                logger.info(`Connected to WhatsApp as ${config.owner.name}!`);
                retryCount = 0; // Reset retry count on successful connection

                // Send startup message in configured language
                const startupMessage = languageManager.getText('system.connected');
                await sock.sendMessage(config.owner.number, { 
                    text: startupMessage 
                }).catch(err => logger.error('Failed to send startup message:', err));

                // Start credential backup scheduling
                await sessionManager.createBackupSchedule(sock);
                await sessionManager.backupCredentials(sock);
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect && retryCount < config.settings.maxRetries) {
                    const delay = getRetryDelay(retryCount);
                    logger.info(`Connection closed. Attempting to reconnect in ${delay/1000}s... (Attempt ${retryCount + 1}/${config.settings.maxRetries})`);

                    setTimeout(async () => {
                        await sessionManager.restoreFromBackup();
                        startConnection(retryCount + 1);
                    }, delay);
                } else if (statusCode === DisconnectReason.loggedOut) {
                    logger.error('Connection closed: Client logged out. Please scan the QR code again.');
                    await sessionManager.clearSession();
                    startConnection(0);
                } else {
                    logger.error(`Connection closed: Max retries (${config.settings.maxRetries}) reached or fatal error.`);
                }
            }
        });

        // Handle messages for credential backup
        sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const message of messages) {
                if (message.key.fromMe) {
                    await sessionManager.handleCredentialsBackup(message);
                }
            }
        });

        // Implement proper cleanup
        const cleanup = async () => {
            logger.info('Cleaning up connection...');
            await sessionManager.backupCredentials(sock);
            sock.ev.removeAllListeners();
            await sock.end();
        };

        process.on('SIGTERM', cleanup);
        process.on('SIGINT', cleanup);

        return sock;
    } catch (err) {
        logger.error('Error in connection:', err);
        if (retryCount < config.settings.maxRetries) {
            const delay = getRetryDelay(retryCount);
            logger.info(`Retrying connection in ${delay/1000}s... (Attempt ${retryCount + 1}/${config.settings.maxRetries})`);
            setTimeout(() => startConnection(retryCount + 1), delay);
        } else {
            logger.error(`Failed to establish connection after ${config.settings.maxRetries} attempts`);
            throw err;
        }
    }
}

module.exports = { startConnection };