const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const { sessionManager } = require('./utils/sessionManager');
const config = require('./config/config');

async function startConnection(retryCount = 0) {
    try {
        logger.info('Initializing WhatsApp connection...');

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(config.session.authDir);

        // Create socket with minimal configuration
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: logger,
            browser: ['WhatsApp-MD', 'Safari', '1.0.0']
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { qr, connection, lastDisconnect } = update;

            // Log detailed connection state
            logger.debug('Connection update:', {
                state: connection,
                retryCount,
                error: lastDisconnect?.error?.message,
                code: lastDisconnect?.error?.output?.statusCode,
                timestamp: new Date().toISOString()
            });

            if (qr) {
                logger.info('New QR code generated');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'open') {
                logger.info('Connected successfully!');

                // Send startup message
                const ownerJid = `${config.owner.number}@s.whatsapp.net`;
                try {
                    await sock.sendMessage(ownerJid, { 
                        text: '𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻 Bot Connected Successfully!'
                    });
                } catch (err) {
                    logger.error('Failed to send startup message:', err.message);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                logger.info('Connection closed:', {
                    shouldReconnect,
                    statusCode,
                    error: lastDisconnect?.error?.message,
                    stack: lastDisconnect?.error?.stack
                });

                if (shouldReconnect && retryCount < config.settings.maxRetries) {
                    // Clean up listeners before reconnecting
                    sock.ev.removeAllListeners();
                    await sock.end();

                    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                    logger.info(`Reconnecting in ${delay/1000}s... (Attempt ${retryCount + 1}/${config.settings.maxRetries})`);

                    setTimeout(async () => {
                        await startConnection(retryCount + 1);
                    }, delay);
                } else {
                    logger.error('Connection terminated. Please restart the bot.');
                    process.exit(1);
                }
            }
        });

        // Handle credentials update
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