const express = require('express');
const { startConnection } = require('./connection');
const { messageHandler } = require('./handlers/messageHandler');
const { commandLoader } = require('./utils/commandLoader');
const { languageManager } = require('./utils/language');
const logger = require('./utils/logger');
const config = require('./config/config');
const { DisconnectReason } = require('@whiskeysockets/baileys');

async function startBot() {
    try {
        // Load translations first
        await languageManager.loadTranslations();

        // Load commands
        await commandLoader.loadCommandConfigs();
        await commandLoader.loadCommandHandlers();

        // Start WhatsApp connection
        const sock = await startConnection();

        // Setup Express server
        const app = express();

        // Basic middleware
        app.use(express.json());

        // Health check endpoint
        app.get('/', (req, res) => {
            res.json({
                status: 'running',
                message: languageManager.getText('system.bot_active'),
                commands: commandLoader.getAllCommands().length,
                language: config.bot.language
            });
        });

        // ALWAYS serve the app on port 5000
        const server = app.listen(5000, '0.0.0.0', () => {
            logger.info(`Server is running on http://0.0.0.0:5000`);
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                logger.error(`Port ${5000} is already in use. Please ensure no other service is using this port.`);
                process.exit(1);
            } else {
                logger.error('Failed to start HTTP server:', err);
                process.exit(1);
            }
        });

        // Listen for messages
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const m = messages[0];
            if (!m.message) return;

            try {
                await messageHandler(sock, m);
            } catch (err) {
                logger.error('Error handling message:', err);
            }
        });

        // Listen for connection updates
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    logger.info('Connection closed, attempting to reconnect...');
                    startBot();
                }
            }
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            logger.info('SIGTERM received. Closing server...');
            server.close(() => {
                logger.info('Server closed. Exiting process.');
                process.exit(0);
            });
        });

    } catch (err) {
        logger.error('Failed to start bot:', err);
        process.exit(1);
    }
}

// Start the bot
startBot().catch(err => {
    logger.error('Fatal error starting bot:', err);
    process.exit(1);
});