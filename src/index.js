const express = require('express');
const { startConnection } = require('./connection');
const { messageHandler } = require('./handlers/messageHandler');
const { commandLoader } = require('./utils/commandLoader');
const { languageManager } = require('./utils/language');
const logger = require('./utils/logger');
const config = require('./config/config');
const { DisconnectReason } = require('@whiskeysockets/baileys');

async function findAvailablePort(startPort, maxAttempts = 10) {
    const net = require('net');

    function isPortAvailable(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.once('error', () => resolve(false));
            server.once('listening', () => {
                server.close(() => resolve(true));
            });
            server.listen(port, '0.0.0.0');
        });
    }

    for (let port = startPort; port < startPort + maxAttempts; port++) {
        if (await isPortAvailable(port)) {
            return port;
        }
    }
    throw new Error(`No available ports found between ${startPort} and ${startPort + maxAttempts - 1}`);
}

async function startBot() {
    let server = null;
    let sock = null;

    try {
        logger.info('Starting WhatsApp Bot...');

        // Check required environment variables
        const { isValid, missingVars } = config.validateConfig();
        if (!isValid) {
            logger.warn(`Missing required environment variables: ${missingVars.join(', ')}`);
            logger.info('Bot will start but some features may be limited until variables are set');
        }

        // Load translations first
        logger.info('Loading translations...');
        await languageManager.loadTranslations();
        logger.info('Translations loaded successfully');

        // Load commands with error handling
        logger.info('Loading command configurations...');
        try {
            await commandLoader.loadCommandConfigs();
            await commandLoader.loadCommandHandlers();
            logger.info(`Loaded ${commandLoader.getAllCommands().length} commands successfully`);
        } catch (err) {
            logger.error('Error loading commands:', err);
            throw err;
        }

        // Start WhatsApp connection with enhanced error handling
        logger.info('Initializing WhatsApp connection...');
        try {
            sock = await startConnection();
        } catch (err) {
            logger.error('Fatal error establishing WhatsApp connection:', err);
            throw err;
        }

        // Setup Express server with better error handling
        const app = express();
        app.use(express.json());

        // Health check endpoint
        app.get('/', (req, res) => {
            res.json({
                status: sock ? 'connected' : 'disconnected',
                message: languageManager.getText('system.bot_active'),
                commands: commandLoader.getAllCommands().length,
                language: config.bot.language,
                uptime: process.uptime(),
                missingConfig: missingVars
            });
        });

        // Find available port starting from 5000
        const PORT = await findAvailablePort(5000);

        // Create server with proper error handling
        server = app.listen(PORT, '0.0.0.0')
            .on('error', (err) => {
                logger.error('Failed to start HTTP server:', err);
                process.exit(1);
            })
            .on('listening', () => {
                logger.info(`Server is running on http://0.0.0.0:${PORT}`);
            });

        // Listen for messages with enhanced error handling
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const m = messages[0];
            if (!m.message) return;

            try {
                await messageHandler(sock, m);
            } catch (err) {
                logger.error('Error handling message:', {
                    error: err.message,
                    stack: err.stack,
                    messageId: m.key?.id,
                    from: m.key?.remoteJid
                });
            }
        });

        // Enhanced graceful shutdown
        const cleanup = async (signal) => {
            logger.info(`Received ${signal} signal. Cleaning up...`);

            // Close server first
            if (server) {
                await new Promise((resolve) => {
                    server.close(() => {
                        logger.info('HTTP server closed');
                        resolve();
                    });
                });
            }

            // Cleanup WhatsApp connection
            if (sock) {
                try {
                    await sock.logout();
                    logger.info('WhatsApp logout successful');
                } catch (err) {
                    logger.error('Error during WhatsApp logout:', err);
                }
            }

            process.exit(0);
        };

        process.on('SIGTERM', () => cleanup('SIGTERM'));
        process.on('SIGINT', () => cleanup('SIGINT'));

    } catch (err) {
        logger.error('Fatal error starting bot:', {
            error: err.message,
            stack: err.stack
        });

        // Attempt cleanup if server was created
        if (server) {
            try {
                await new Promise((resolve) => {
                    server.close(() => {
                        logger.info('HTTP server closed due to fatal error');
                        resolve();
                    });
                });
            } catch (cleanupErr) {
                logger.error('Error during server cleanup:', cleanupErr);
            }
        }

        process.exit(1);
    }
}

// Start the bot with error handling
startBot().catch(err => {
    logger.error('Fatal error starting bot:', {
        error: err.message,
        stack: err.stack
    });
    process.exit(1);
});