const express = require('express');
const { startConnection } = require('./connection');
const { messageHandler } = require('./handlers/messageHandler');
const { commandLoader } = require('./utils/commandLoader');
const { languageManager } = require('./utils/language');
const logger = require('./utils/logger');
const config = require('./config/config');

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

        // ALWAYS serve on port 5000
        const PORT = 5000;
        const HOST = '0.0.0.0';

        // Start HTTP server with proper error handling
        const server = app.listen(PORT, HOST, () => {
            logger.info(`Server is running on http://${HOST}:${PORT}`);
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                logger.error(`Port ${PORT} is already in use. Please ensure no other service is using this port.`);
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
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 403;
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