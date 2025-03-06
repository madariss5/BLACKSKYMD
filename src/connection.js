const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const { sessionManager } = require('./utils/sessionManager');
const config = require('./config/config');

let retryCount = 0;
const MAX_RETRIES = 5;
const BASE_RETRY_INTERVAL = 5000;

async function startConnection() {
    try {
        logger.info('Initializing WhatsApp connection...');

        // Initialize session manager
        await sessionManager.initialize();

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(sessionManager.authDir);

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
            maxIdleTimeMs: 0
        });

        // Connection state tracking
        let connectionState = {
            lastActivity: Date.now(),
            isConnected: false,
            hasQR: false,
            authInfo: null
        };

        // Activity monitor
        const activityCheck = setInterval(() => {
            const idleTime = Date.now() - connectionState.lastActivity;
            if (connectionState.isConnected && idleTime > 30000) {
                try {
                    sock.sendPresenceUpdate('available');
                    connectionState.lastActivity = Date.now();
                } catch (err) {
                    logger.warn('Failed to send presence update:', err.message);
                }
            }
        }, 30000);

        // Connection update handler
        sock.ev.on('connection.update', async (update) => {
            const { qr, connection, lastDisconnect } = update;

            logger.info('Connection state update:', {
                connection,
                hasError: !!lastDisconnect?.error,
                retryCount,
                timestamp: new Date().toISOString()
            });

            if (qr) {
                connectionState.hasQR = true;
                logger.info('New QR code received');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'open') {
                connectionState.isConnected = true;
                connectionState.lastActivity = Date.now();
                retryCount = 0; // Reset retry counter on successful connection

                logger.info('Connection established successfully');

                // Save successful connection state
                await sessionManager.saveSession('latest', state);

                try {
                    const ownerJid = `${config.owner.number}@s.whatsapp.net`;
                    await sock.sendMessage(ownerJid, { 
                        text: '𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻 Bot Connected Successfully!'
                    });
                } catch (err) {
                    logger.error('Failed to send startup message:', err.message);
                }
            }

            if (connection === 'close') {
                connectionState.isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut &&
                                      statusCode !== DisconnectReason.forbidden;

                logger.warn('Connection closed:', {
                    statusCode,
                    error: lastDisconnect?.error?.message,
                    shouldReconnect,
                    retryCount
                });

                clearInterval(activityCheck);

                if (shouldReconnect && retryCount < MAX_RETRIES) {
                    retryCount++;
                    const delay = BASE_RETRY_INTERVAL * Math.pow(1.5, retryCount - 1);

                    logger.info(`Scheduling reconnection attempt ${retryCount}/${MAX_RETRIES} in ${delay/1000}s`);

                    // Backup credentials before attempting reconnection
                    await sessionManager.backupCredentials();

                    setTimeout(async () => {
                        try {
                            // Save current state before reconnecting
                            await saveCreds();
                            await startConnection();
                        } catch (err) {
                            logger.error('Reconnection attempt failed:', err.message);
                            process.exit(1);
                        }
                    }, delay);
                } else {
                    logger.error('Maximum retry attempts reached or permanent disconnection');
                    process.exit(1);
                }
            }
        });

        // Enhanced credentials update handler
        sock.ev.on('creds.update', async () => {
            try {
                await saveCreds();
                await sessionManager.backupCredentials();
                logger.info('Credentials updated and backed up successfully');
            } catch (err) {
                logger.error('Failed to save credentials:', err.message);
                try {
                    await sessionManager.emergencyCredsSave(state);
                } catch (backupErr) {
                    logger.error('Emergency credentials save failed:', backupErr.message);
                }
            }
        });

        // Setup backup schedule
        await sessionManager.createBackupSchedule();

        return sock;

    } catch (err) {
        logger.error('Fatal error in connection:', err.message);
        throw err;
    }
}

module.exports = { startConnection };