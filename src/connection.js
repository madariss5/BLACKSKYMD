const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const { sessionManager } = require('./utils/sessionManager');
const config = require('./config/config');

// Connection pool and state management
let connectionPool = [];
let isReconnecting = false;
let activeConnection = null;
const MAX_POOL_SIZE = 2;
const CONNECTION_CHECK_INTERVAL = 10000; // 10 seconds

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

        // Connection state monitoring
        const connectionState = {
            isActive: false,
            lastPing: Date.now(),
            missedPings: 0,
            maxMissedPings: 3
        };

        // Heartbeat mechanism
        const startHeartbeat = () => {
            const interval = setInterval(async () => {
                try {
                    if (sock.ws?.readyState === sock.ws?.OPEN) {
                        await sock.sendPresenceUpdate('available');
                        connectionState.lastPing = Date.now();
                        connectionState.missedPings = 0;
                    } else {
                        connectionState.missedPings++;
                        logger.warn(`Missed ping: ${connectionState.missedPings}/${connectionState.maxMissedPings}`);

                        if (connectionState.missedPings >= connectionState.maxMissedPings) {
                            logger.error('Connection dead, initiating recovery');
                            clearInterval(interval);
                            await handleConnectionFailure(sock);
                        }
                    }
                } catch (err) {
                    logger.error('Heartbeat error:', err);
                    connectionState.missedPings++;
                }
            }, CONNECTION_CHECK_INTERVAL);

            return interval;
        };

        // Connection failure handler
        async function handleConnectionFailure(failedSocket) {
            if (isReconnecting) return;
            isReconnecting = true;

            try {
                // Remove failed connection from pool
                connectionPool = connectionPool.filter(conn => conn !== failedSocket);

                // Clean up failed connection
                try {
                    await failedSocket.logout();
                    await failedSocket.end();
                    failedSocket.ev.removeAllListeners();
                } catch (err) {
                    logger.error('Error cleaning up failed connection:', err);
                }

                // If no backup connections available, create new one
                if (connectionPool.length < MAX_POOL_SIZE) {
                    logger.info('Creating new connection for pool');
                    const newConnection = await startConnection(retryCount + 1);
                    if (newConnection) {
                        connectionPool.push(newConnection);
                    }
                }

                // Switch to backup connection if available
                const backupConnection = connectionPool.find(conn => 
                    conn.ws?.readyState === conn.ws?.OPEN && conn !== failedSocket
                );

                if (backupConnection) {
                    logger.info('Switching to backup connection');
                    activeConnection = backupConnection;
                }

            } catch (err) {
                logger.error('Connection recovery failed:', err);
            } finally {
                isReconnecting = false;
            }
        }

        // Connection update handler
        sock.ev.on('connection.update', async (update) => {
            const { qr, connection, lastDisconnect } = update;

            if (qr) {
                logger.info('New QR code generated');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'open') {
                logger.info('Connection established successfully');
                connectionState.isActive = true;
                connectionState.missedPings = 0;

                // Add to connection pool if not full
                if (connectionPool.length < MAX_POOL_SIZE) {
                    connectionPool.push(sock);
                }

                activeConnection = sock;
                startHeartbeat();

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
                connectionState.isActive = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                                     statusCode !== DisconnectReason.forbidden &&
                                     statusCode !== DisconnectReason.timedOut;

                if (shouldReconnect && !isReconnecting) {
                    await handleConnectionFailure(sock);
                } else {
                    logger.error('Connection terminated permanently, shutting down');
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
            logger.info('Cleaning up connections...');

            for (const connection of connectionPool) {
                try {
                    connection.ev.removeAllListeners();
                    await connection.logout();
                    await connection.end();
                } catch (err) {
                    logger.error('Error cleaning up connection:', err);
                }
            }

            connectionPool = [];
            activeConnection = null;
        };

        // Register cleanup handlers
        process.once('SIGTERM', async () => {
            await cleanup();
            process.exit(0);
        });

        process.once('SIGINT', async () => {
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
            return await handleConnectionFailure(null);
        }

        throw err;
    }
}

module.exports = { startConnection };