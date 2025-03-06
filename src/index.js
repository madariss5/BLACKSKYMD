const express = require('express');
const { startConnection } = require('./connection');
const { messageHandler } = require('./handlers/messageHandler');
const { commandLoader } = require('./utils/commandLoader');
const logger = require('./utils/logger');

async function startBot() {
    try {
        // Load commands first
        await commandLoader.loadCommandConfigs();
        await commandLoader.loadCommandHandlers();

        // Start WhatsApp connection
        const sock = await startConnection();

        // Setup Express server only after WhatsApp connection
        const app = express();
        app.get('/', (req, res) => {
            res.json({
                status: 'running',
                message: 'WhatsApp bot is active',
                commands: commandLoader.getAllCommands().length
            });
        });

        // Start HTTP server with proper error handling
        const server = app.listen(process.env.PORT || 5000, '0.0.0.0', () => {
            logger.info(`HTTP server listening on port ${process.env.PORT || 5000}`);
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                logger.error('Port is already in use. Make sure no other instance is running.');
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
                    logger.info('Connection closed, reconnecting...');
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

startBot();