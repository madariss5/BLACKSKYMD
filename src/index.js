const path = require('node:path');
const express = require('express');
const { startConnection } = require('./connection');
const { messageHandler } = require('./handlers/messageHandler');
const { commandLoader } = require('./utils/commandLoader');
const commandModules = require('./commands/index');
const logger = require('./utils/logger');
const config = require('./config/config');
const fs = require('node:fs');
const { DisconnectReason } = require('@whiskeysockets/baileys');

// Global state management
let isConnecting = false;
let connectionTimeout = null;
let reconnectTimer = null;
let sessionInvalidated = false;

// Enhanced reconnection manager
const reconnectManager = {
    attempts: 0,
    maxAttempts: 5,
    baseDelay: 10000,
    maxDelay: 300000,
    isReconnecting: false,
    connectionLock: false,

    async handleReconnect(error, lastDisconnect) {
        if (this.isReconnecting || this.connectionLock) {
            logger.info('Connection attempt already in progress, skipping...');
            return false;
        }

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        logger.info(`Handling disconnect with status code: ${statusCode}`);

        this.connectionLock = true;
        this.isReconnecting = true;

        try {
            // Clear session and exit on critical errors
            if (statusCode === DisconnectReason.loggedOut || 
                statusCode === DisconnectReason.connectionReplaced ||
                statusCode === DisconnectReason.connectionClosed ||
                statusCode === DisconnectReason.timedOut ||
                statusCode === DisconnectReason.connectionLost) {

                logger.info('Critical connection error, clearing session...');
                await this.clearSession();

                // Force restart on critical errors
                process.exit(1);
                return false;
            }

            // Handle stream conflicts (440)
            if (statusCode === 440) {
                logger.info('Stream conflict detected, clearing session and restarting...');
                await this.clearSession();
                process.exit(1);
                return false;
            }

            if (this.attempts >= this.maxAttempts) {
                logger.error('Max reconnection attempts reached, clearing session and restarting...');
                await this.clearSession();
                process.exit(1);
                return false;
            }

            const delay = Math.min(
                this.baseDelay * Math.pow(2, this.attempts),
                this.maxDelay
            );

            this.attempts++;
            logger.info(`Reconnection attempt ${this.attempts}/${this.maxAttempts} in ${delay}ms`);

            await new Promise(resolve => setTimeout(resolve, delay));
            return true;

        } catch (err) {
            logger.error('Error during reconnection:', err);
            return false;
        } finally {
            this.isReconnecting = false;
            this.connectionLock = false;
        }
    },

    async clearSession() {
        try {
            const sessionFiles = [
                'auth_info_multi.json',
                'auth_info_baileys.json',
                'auth_info.json',
                'auth_info_qr.json'
            ];

            for (const file of sessionFiles) {
                try {
                    if (fs.existsSync(file)) {
                        fs.unlinkSync(file);
                        logger.info(`Cleared session file: ${file}`);
                    }
                } catch (err) {
                    logger.error(`Error clearing session file ${file}:`, err);
                }
            }

            // Also clear the auth_info directory
            const authDirs = ['auth_info', 'auth_info_baileys', 'auth_info_multi'];
            for (const dir of authDirs) {
                const dirPath = path.join(process.cwd(), dir);
                if (fs.existsSync(dirPath)) {
                    await fs.promises.rm(dirPath, { recursive: true, force: true });
                    logger.info(`Cleared directory: ${dirPath}`);
                }
            }

            sessionInvalidated = true;
            logger.info('Session cleanup completed');
        } catch (err) {
            logger.error('Error in clearSession:', err);
        }
    },

    reset() {
        this.attempts = 0;
        this.isReconnecting = false;
        this.connectionLock = false;
        sessionInvalidated = false;
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
        }
        logger.info('Reset reconnection manager state');
    }
};

// Start WhatsApp connection with improved error handling
async function startWhatsAppConnection() {
    if (isConnecting) {
        logger.info('Connection attempt already in progress, skipping...');
        return;
    }

    isConnecting = true;
    try {
        const sock = await startConnection();

        // Set connection timeout
        if (connectionTimeout) {
            clearTimeout(connectionTimeout);
        }
        connectionTimeout = setTimeout(() => {
            logger.error('Connection timeout reached, restarting...');
            process.exit(1);
        }, 300000); // 5 minutes timeout

        return sock;
    } catch (err) {
        logger.error('Fatal error establishing WhatsApp connection:', err);
        throw err;
    } finally {
        isConnecting = false;
    }
}

async function startServer(sock) {
    const app = express();
    app.use(express.json());

    if (sock) {
        app.set('sock', sock);
    }

    // Health check endpoint
    app.get('/', (req, res) => {
        const currentSock = app.get('sock') || sock;
        let commandCount = 0;

        try {
            commandCount = commandLoader.getAllCommands().length;
        } catch (err) {
            // Commands not loaded yet
        }

        if (!currentSock) {
            res.send(`
                <html>
                    <head>
                        <title>WhatsApp Bot - Initializing</title>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <style>
                            body { 
                                font-family: Arial, sans-serif; 
                                text-align: center;
                                margin-top: 50px;
                                background-color: #f5f5f5;
                            }
                            h1 { color: #128C7E; }
                            .container {
                                max-width: 600px;
                                margin: 0 auto;
                                padding: 20px;
                                background-color: white;
                                border-radius: 10px;
                                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                            }
                            a.qr-button {
                                display: inline-block;
                                background-color: #128C7E;
                                color: white;
                                padding: 10px 20px;
                                border-radius: 5px;
                                text-decoration: none;
                                font-weight: bold;
                                margin-top: 20px;
                            }
                            .status-info {
                                margin-top: 20px;
                                color: #666;
                                font-size: 0.9em;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>WhatsApp Bot Initializing</h1>
                            <p>The WhatsApp bot is starting up. To connect, you need to scan the QR code.</p>
                            <a href="http://${req.headers.host.split(':')[0]}:5006" class="qr-button" target="_blank">View QR Code</a>
                            <div class="status-info">
                                <p>Status: Initializing<br>
                                Uptime: ${Math.floor(process.uptime())} seconds</p>
                            </div>
                        </div>
                    </body>
                </html>
            `);
        } else {
            res.json({
                status: 'connected',
                message: 'WhatsApp Bot is active',
                commands: commandCount,
                uptime: process.uptime()
            });
        }
    });

    const PORT = 5000;
    const server = app.listen(PORT, '0.0.0.0')
        .on('error', (err) => {
            logger.error('Failed to start HTTP server:', err);
            process.exit(1);
        });

    return server;
}

async function main() {
    let server = null;
    let sock = null;

    try {
        process.stdout.write('\x1Bc');
        logger.info('Starting API server first...');
        server = await startServer(null);
        logger.info('API server started on port 5000');

        try {
            sock = await startWhatsAppConnection();
        } catch (err) {
            logger.error('Initial connection failed:', err);
            process.exit(1);
        }

        // Handle connection updates with improved error handling
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                logger.info('Connection closed, checking reconnection possibility...');

                const shouldReconnect = await reconnectManager.handleReconnect(
                    lastDisconnect?.error,
                    lastDisconnect
                );

                if (shouldReconnect) {
                    try {
                        logger.info('Attempting to establish new connection...');
                        sock = await startWhatsAppConnection();
                    } catch (err) {
                        logger.error('Failed to establish new connection:', err);
                    }
                }
            } else if (connection === 'open') {
                logger.info('Connection established successfully');
                reconnectManager.reset();

                // Initialize command handlers with error protection
                const originalLevel = logger.level;
                logger.level = 'silent';

                try {
                    await commandLoader.loadCommandHandlers();
                    await commandModules.initializeModules(sock);

                    const expressApp = server._events.request;
                    if (expressApp && typeof expressApp.set === 'function') {
                        expressApp.set('sock', sock);
                        logger.info('Updated server with active WhatsApp connection');
                    }
                } catch (err) {
                    logger.error('Error during initialization:', err);
                } finally {
                    logger.level = originalLevel;
                }
            }
        });

        // Implement periodic memory cleanup
        const MEMORY_CLEANUP_INTERVAL = 3600000; // 1 hour
        setInterval(() => {
            try {
                if (global.gc) {
                    global.gc();
                    logger.info('Performed garbage collection');
                }

                const memoryUsage = process.memoryUsage();
                if (memoryUsage.heapUsed > 1024 * 1024 * 500) { // 500MB threshold
                    logger.warn('High memory usage detected, performing additional cleanup');
                    commandLoader.reloadCommands();
                }
            } catch (err) {
                logger.error('Memory cleanup error:', err);
            }
        }, MEMORY_CLEANUP_INTERVAL);

        // Implement Heroku keep-alive mechanism
        if (process.env.DYNO) {
            logger.info('Running on Heroku, setting up session management');

            // Ensure we have a SESSION_ID for Heroku - generate one if not provided
            if (!process.env.SESSION_ID) {
                process.env.SESSION_ID = `heroku_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
                logger.warn(`No SESSION_ID provided, generated temporary ID: ${process.env.SESSION_ID}`);
                logger.warn('This ID will change on restart. Set SESSION_ID in config vars for persistence.');
            } else {
                logger.info(`Using configured SESSION_ID: ${process.env.SESSION_ID}`);
            }

            // Check if keep-alive is enabled (default: true)
            const keepAliveEnabled = process.env.KEEP_ALIVE !== 'false';

            if (keepAliveEnabled && process.env.HEROKU_APP_NAME) {
                logger.info('Keep-alive ping enabled for Heroku');

                // Set up a self-ping every 25 minutes to prevent Heroku from sleeping
                // Only needed for free dynos, but harmless on paid ones
                const KEEP_ALIVE_INTERVAL = 25 * 60 * 1000; // 25 minutes

                const appUrl = process.env.APP_URL || `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`;
                logger.info(`Keep-alive URL set to: ${appUrl}`);

                setInterval(() => {
                    try {
                        // Use the built-in http module to avoid adding dependencies
                        const https = require('https');
                        https.get(appUrl, (res) => {
                            logger.debug(`Keep-alive ping sent. Status: ${res.statusCode}`);
                        }).on('error', (err) => {
                            logger.error('Keep-alive ping failed:', err.message);
                        });
                    } catch (pingErr) {
                        logger.error('Error sending keep-alive ping:', pingErr);
                    }
                }, KEEP_ALIVE_INTERVAL);
            } else {
                logger.info('Keep-alive ping disabled or HEROKU_APP_NAME not set');
            }

            // Also implement session backup on Heroku dyno cycling
            const { sessionManager } = require('./utils/sessionManager');

            // First backup on startup
            sessionManager.backupCredentials()
                .then(() => logger.info('Initial Heroku session backup complete'))
                .catch(err => logger.error('Initial Heroku backup failed:', err));

            // Schedule regular backups
            const backupIntervalMinutes = parseInt(process.env.BACKUP_INTERVAL || '15', 10);
            const backupIntervalMs = backupIntervalMinutes * 60 * 1000;
            logger.info(`Scheduling Heroku backups every ${backupIntervalMinutes} minutes`);

            setInterval(() => {
                sessionManager.backupCredentials()
                    .then(() => logger.debug('Scheduled Heroku backup complete'))
                    .catch(err => logger.error('Scheduled Heroku backup failed:', err));
            }, backupIntervalMs);
        }

    } catch (err) {
        logger.error('Fatal error starting bot:', err);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err);
    process.exit(1);
});

// Start the bot
main().catch(err => {
    logger.error('Fatal error starting bot:', err);
    process.exit(1);
});