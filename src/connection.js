const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const { sessionManager } = require('./utils/sessionManager');
const config = require('./config/config');

let connectionQueue = [];
let isReconnecting = false;

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
            // Connection stability settings
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 30000,
            keepAliveIntervalMs: 10000,
            retryRequestDelayMs: 1000,
            // Network settings
            maxReconnectAttempts: Infinity,
            maxIdleTimeMs: 30000,
            // WebSocket settings
            patchMessageBeforeSending: true,
            markOnlineOnConnect: true
        });

        // WebSocket heartbeat mechanism
        const heartbeat = {
            interval: null,
            missedBeats: 0,
            maxMissed: 3
        };

        function startHeartbeat() {
            if (heartbeat.interval) clearInterval(heartbeat.interval);
            heartbeat.missedBeats = 0;

            heartbeat.interval = setInterval(async () => {
                try {
                    if (sock.ws?.readyState === sock.ws?.OPEN) {
                        await sock.sendPresenceUpdate('available');
                        heartbeat.missedBeats = 0;
                    } else {
                        heartbeat.missedBeats++;
                        logger.warn(`Missed heartbeat: ${heartbeat.missedBeats}/${heartbeat.maxMissed}`);

                        if (heartbeat.missedBeats >= heartbeat.maxMissed) {
                            logger.error('Connection appears dead, initiating recovery...');
                            await handleConnectionRecovery();
                        }
                    }
                } catch (err) {
                    logger.error('Heartbeat error:', err);
                    heartbeat.missedBeats++;
                }
            }, 15000); // 15 second intervals
        }

        async function handleConnectionRecovery() {
            if (isReconnecting) return;
            isReconnecting = true;

            try {
                logger.info('Starting connection recovery...');
                clearInterval(heartbeat.interval);

                await sock.ws?.close();
                await sock.logout();
                await sock.end();

                // Queue reconnection attempt
                connectionQueue.push({
                    timestamp: Date.now(),
                    retryCount: retryCount + 1
                });

                // Process queue with exponential backoff
                while (connectionQueue.length > 0) {
                    const attempt = connectionQueue.shift();
                    const delay = Math.min(1000 * Math.pow(2, attempt.retryCount), 300000);

                    await new Promise(resolve => setTimeout(resolve, delay));

                    try {
                        await startConnection(attempt.retryCount);
                        break;
                    } catch (err) {
                        logger.error('Reconnection attempt failed:', err);
                        if (attempt.retryCount < config.settings.maxRetries) {
                            connectionQueue.push({
                                timestamp: Date.now(),
                                retryCount: attempt.retryCount + 1
                            });
                        }
                    }
                }
            } catch (err) {
                logger.error('Recovery failed:', err);
            } finally {
                isReconnecting = false;
            }
        }

        // Enhanced connection update handler
        sock.ev.on('connection.update', async (update) => {
            const { qr, connection, lastDisconnect } = update;

            if (qr) {
                logger.info('New QR code generated');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'open') {
                logger.info('Connected successfully!');
                startHeartbeat();
                isReconnecting = false;
                connectionQueue = [];

                try {
                    const ownerJid = `${config.owner.number}@s.whatsapp.net`;
                    await sock.sendMessage(ownerJid, { 
                        text: '𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻 Bot Connected Successfully!'
                    });
                } catch (err) {
                    logger.error('Failed to send startup message:', err);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                                     statusCode !== DisconnectReason.forbidden &&
                                     statusCode !== DisconnectReason.timedOut;

                clearInterval(heartbeat.interval);

                if (shouldReconnect && !isReconnecting) {
                    await handleConnectionRecovery();
                } else {
                    logger.error('Connection terminated permanently');
                    process.exit(1);
                }
            }
        });

        // Enhanced credentials update handler
        sock.ev.on('creds.update', async () => {
            try {
                await saveCreds();
                logger.info('Credentials updated successfully');
            } catch (err) {
                logger.error('Failed to save credentials:', err);
                try {
                    await sessionManager.emergencyCredsSave(state);
                } catch (backupErr) {
                    logger.error('Emergency credentials save failed:', backupErr);
                }
            }
        });

        // Cleanup handler
        const cleanup = async () => {
            logger.info('Cleaning up connection...');
            clearInterval(heartbeat.interval);

            try {
                sock.ev.removeAllListeners();
                await saveCreds();
                await sock.logout();
                await sock.end();
            } catch (err) {
                logger.error('Cleanup error:', err);
            }
        };

        // Register cleanup handlers
        process.on('SIGTERM', async () => {
            await cleanup();
            process.exit(0);
        });

        process.on('SIGINT', async () => {
            await cleanup();
            process.exit(0);
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
        logger.error('Fatal connection error:', err);

        if (!isReconnecting && retryCount < config.settings.maxRetries) {
            await handleConnectionRecovery();
        }

        throw err;
    }
}

module.exports = { startConnection };