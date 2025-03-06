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

        // Enhanced socket configuration for better stability
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: logger,
            browser: ['WhatsApp-MD', 'Safari', '1.0.0'],
            // Increased timeouts and intervals for better stability
            connectTimeoutMs: 120000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 15000, // More frequent keep-alive
            retryRequestDelayMs: 2000,
            // Enhanced network settings
            maxReconnectAttempts: Infinity,
            maxIdleTimeMs: 60000,
            // Improved connection options
            fireAndForget: false,
            emitOwnEvents: true,
            shouldIgnoreJid: jid => !jid.includes('@s.whatsapp.net'),
            // WebSocket config
            patchMessageBeforeSending: true,
            getMessage: async () => {
                return { conversation: 'retry' };
            }
        });

        // Connection monitoring interval
        const healthCheck = setInterval(async () => {
            try {
                if (sock.ws?.readyState !== sock.ws?.OPEN) {
                    logger.warn('WebSocket not in OPEN state, attempting recovery...');
                    await sock.ws?.refresh();
                }
            } catch (err) {
                logger.error('Health check failed:', err);
            }
        }, 30000);

        // Enhanced connection update handler
        sock.ev.on('connection.update', async (update) => {
            const { qr, connection, lastDisconnect } = update;

            // Detailed connection state logging
            logger.debug('Connection update:', {
                state: connection,
                retryCount,
                error: lastDisconnect?.error?.message,
                code: lastDisconnect?.error?.output?.statusCode,
                timestamp: new Date().toISOString(),
                wsState: sock.ws?.readyState
            });

            if (qr) {
                logger.info('New QR code generated');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'open') {
                logger.info('Connected successfully!');
                clearInterval(healthCheck); // Reset health check

                // Send startup message with error handling
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
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                                      statusCode !== DisconnectReason.forbidden &&
                                      statusCode !== DisconnectReason.timedOut;

                logger.info('Connection closed:', {
                    shouldReconnect,
                    statusCode,
                    error: lastDisconnect?.error?.message,
                    stack: lastDisconnect?.error?.stack
                });

                clearInterval(healthCheck);

                if (shouldReconnect && retryCount < config.settings.maxRetries) {
                    // Progressive backoff strategy
                    const baseDelay = 1000; // 1 second
                    const maxDelay = 300000; // 5 minutes
                    const delay = Math.min(baseDelay * Math.pow(1.5, retryCount), maxDelay);

                    logger.info(`Implementing reconnection strategy:`, {
                        attempt: retryCount + 1,
                        delay: `${delay/1000}s`,
                        maxRetries: config.settings.maxRetries
                    });

                    // Clean up existing connection
                    try {
                        clearInterval(healthCheck);
                        sock.ev.removeAllListeners();
                        await sock.logout();
                        await sock.end();
                    } catch (err) {
                        logger.error('Error during connection cleanup:', err);
                    }

                    // Attempt reconnection with a queue system
                    setTimeout(async () => {
                        try {
                            await startConnection(retryCount + 1);
                        } catch (err) {
                            logger.error('Reconnection attempt failed:', {
                                error: err.message,
                                attempt: retryCount + 1
                            });
                            // If reconnection fails, try again with increased delay
                            setTimeout(async () => {
                                try {
                                    await startConnection(retryCount + 2);
                                } catch (retryErr) {
                                    logger.error('Secondary reconnection attempt failed:', retryErr);
                                }
                            }, delay * 2);
                        }
                    }, delay);
                } else {
                    logger.error('Connection terminated permanently. Please restart the bot.');
                    process.exit(1);
                }
            }

            if (connection === 'connecting') {
                logger.info('Connecting to WhatsApp...');
            }
        });

        // Enhanced credentials update handler with retry mechanism
        sock.ev.on('creds.update', async () => {
            const maxRetries = 3;
            let retries = 0;

            const attemptSave = async () => {
                try {
                    await saveCreds();
                    logger.info('Credentials updated and saved successfully');
                } catch (err) {
                    logger.error('Failed to save credentials:', err);
                    if (retries < maxRetries) {
                        retries++;
                        logger.info(`Retrying credentials save (${retries}/${maxRetries})...`);
                        setTimeout(attemptSave, 1000 * retries);
                    } else {
                        // Emergency backup
                        try {
                            await sessionManager.emergencyCredsSave(state);
                        } catch (backupErr) {
                            logger.error('Emergency credentials save failed:', backupErr);
                        }
                    }
                }
            };

            await attemptSave();
        });

        // Comprehensive cleanup handler
        const cleanup = async () => {
            logger.info('Initiating comprehensive cleanup...');
            clearInterval(healthCheck);

            try {
                // Remove all event listeners
                sock.ev.removeAllListeners();

                // Close WebSocket connection gracefully
                if (sock.ws) {
                    sock.ws.close();
                }

                // Perform logout and save final state
                await saveCreds();
                await sock.logout();

                // End the connection
                await sock.end();

                logger.info('Cleanup completed successfully');
            } catch (err) {
                logger.error('Error during cleanup:', {
                    error: err.message,
                    stack: err.stack
                });
            }
        };

        // Register cleanup handlers with error boundaries
        process.on('SIGTERM', async () => {
            try {
                await cleanup();
                process.exit(0);
            } catch (err) {
                logger.error('Error during SIGTERM cleanup:', err);
                process.exit(1);
            }
        });

        process.on('SIGINT', async () => {
            try {
                await cleanup();
                process.exit(0);
            } catch (err) {
                logger.error('Error during SIGINT cleanup:', err);
                process.exit(1);
            }
        });

        process.on('uncaughtException', async (err) => {
            logger.error('Uncaught Exception:', err);
            try {
                await cleanup();
            } catch (cleanupErr) {
                logger.error('Error during uncaught exception cleanup:', cleanupErr);
            }
            process.exit(1);
        });

        return sock;

    } catch (err) {
        logger.error('Fatal connection error:', {
            message: err.message,
            stack: err.stack,
            attempt: retryCount
        });

        if (retryCount < config.settings.maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
            logger.info(`Retrying connection in ${delay/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return startConnection(retryCount + 1);
        }

        throw err;
    }
}

module.exports = { startConnection };