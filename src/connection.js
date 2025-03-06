const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const { sessionManager } = require('./utils/sessionManager');
const config = require('./config/config');

async function startConnection(retryCount = 0) {
    try {
        logger.info('Initializing WhatsApp connection...');

        // Clear session data for fresh start
        await sessionManager.clearSession();
        logger.info('Starting fresh session');

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(config.session.authDir);

        // Create socket with minimal configuration
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: logger,
            browser: ['WhatsApp-MD', 'Chrome', '1.0.0'],
            version: [2, 2323, 4]
        });

        // Handle connection updates
        sock.ev.on('connection.update', async ({ qr, connection, lastDisconnect }) => {
            logger.debug('Connection state:', { 
                connection, 
                retryCount,
                error: lastDisconnect?.error?.message,
                code: lastDisconnect?.error?.output?.statusCode
            });

            if (qr) {
                logger.info('Please scan QR code with WhatsApp');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'open') {
                logger.info('Connected successfully!');
                retryCount = 0;

                // Send startup message
                if (config.owner.number) {
                    sock.sendMessage(`${config.owner.number}@s.whatsapp.net`, { 
                        text: '𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻 Bot Connected Successfully!'
                    }).catch(err => {
                        logger.error('Failed to send startup message:', err.message);
                    });
                }
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);

                logger.info('Connection closed:', { 
                    shouldReconnect, 
                    statusCode: lastDisconnect?.error?.output?.statusCode,
                    error: lastDisconnect?.error?.message,
                    stack: lastDisconnect?.error?.stack
                });

                if (shouldReconnect && retryCount < config.settings.maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                    logger.info(`Reconnecting in ${delay/1000}s... (Attempt ${retryCount + 1}/${config.settings.maxRetries})`);

                    // Clean up existing listeners
                    sock.ev.removeAllListeners();

                    setTimeout(() => startConnection(retryCount + 1), delay);
                } else {
                    logger.error('Connection terminated. Please restart the bot.');
                    process.exit(1);
                }
            }
        });

        // Handle credentials updates
        sock.ev.on('creds.update', saveCreds);

        // Cleanup handler
        const cleanup = async () => {
            logger.info('Cleaning up connection...');
            try {
                sock.ev.removeAllListeners();
                await sock.logout();
            } catch (err) {
                logger.error('Error during cleanup:', err.message);
            }
        };

        process.on('SIGTERM', cleanup);
        process.on('SIGINT', cleanup);

        return sock;

    } catch (err) {
        logger.error('Connection error:', {
            message: err.message,
            stack: err.stack,
            attempt: retryCount
        });

        if (retryCount < config.settings.maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
            logger.info(`Retrying in ${delay/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return startConnection(retryCount + 1);
        }

        throw err;
    }
}

module.exports = { startConnection };