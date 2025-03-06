const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const { sessionManager } = require('./utils/sessionManager');
const config = require('./config/config');
const { languageManager } = require('./utils/language');

async function startConnection(retryCount = 0) {
    try {
        logger.info('Initializing WhatsApp connection...');

        // Check for required configuration
        const { isValid, missingVars } = config.validateConfig();
        if (!isValid) {
            logger.warn(`Missing required configuration: ${missingVars.join(', ')}`);
        }

        // Clear session if this is a fresh start
        if (retryCount === 0) {
            await sessionManager.clearSession();
            logger.info('Starting fresh session');
        }

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(config.session.authDir);

        // Create socket with stable configuration
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: logger,
            browser: ['WhatsApp-MD', 'Chrome', '1.0.0'],
            version: [2, 2323, 4],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            emitOwnEvents: true
        });

        // Handle connection updates
        sock.ev.on('connection.update', ({ qr, connection, lastDisconnect }) => {
            logger.debug('Connection state:', { connection, retryCount });

            if (qr) {
                logger.info('Please scan QR code with WhatsApp');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'connecting') {
                logger.info('Connecting to WhatsApp...');
            }

            if (connection === 'open') {
                logger.info('Connected successfully!');

                // Reset retry counter
                retryCount = 0;

                // Send startup message if owner number is configured
                if (config.owner.number) {
                    const startupMessage = languageManager.getText('system.connected');
                    sock.sendMessage(`${config.owner.number}@s.whatsapp.net`, { 
                        text: startupMessage 
                    }).catch(err => {
                        logger.error('Failed to send startup message:', err.message);
                    });
                }
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
                logger.info('Connection closed:', { shouldReconnect, statusCode: lastDisconnect?.error?.output?.statusCode });

                if (shouldReconnect && retryCount < config.settings.maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                    logger.info(`Attempting reconnection in ${delay/1000}s... (Attempt ${retryCount + 1}/${config.settings.maxRetries})`);

                    setTimeout(() => {
                        startConnection(retryCount + 1);
                    }, delay);
                } else if (!shouldReconnect) {
                    logger.warn('Session logged out, clearing session data...');
                    sessionManager.clearSession().then(() => {
                        startConnection(0);
                    });
                } else {
                    logger.error('Max reconnection attempts reached');
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