const express = require('express');
const { startConnection } = require('./connection');
const { messageHandler } = require('./handlers/messageHandler');
const { commandLoader } = require('./utils/commandLoader');
const logger = require('./utils/logger');
const config = require('./config/config');

async function startServer(sock) {
    const app = express();
    app.use(express.json());

    // Health check endpoint
    app.get('/', (req, res) => {
        res.json({
            status: sock ? 'connected' : 'disconnected',
            message: 'WhatsApp Bot is active',
            commands: commandLoader.getAllCommands().length,
            uptime: process.uptime()
        });
    });

    // Always serve on port 5000 
    const server = app.listen(5000, '0.0.0.0')
        .on('error', (err) => {
            console.error('Failed to start HTTP server:', err);
            process.exit(1);
        })
        .on('listening', () => {
            console.log('Server is running on port 5000');
        });

    return server;
}

async function main() {
    let server = null;
    let sock = null;

    try {
        // Load commands first
        console.log('Loading command configurations...');
        try {
            await commandLoader.loadCommandConfigs(); //Preserving this line from original
            await commandLoader.loadCommandHandlers();
            console.log(`Loaded ${commandLoader.getAllCommands().length} commands successfully`);
        } catch (err) {
            console.error('Error loading commands:', err);
            throw err;
        }

        // Start WhatsApp connection
        console.log('Initializing WhatsApp connection...');
        try {
            sock = await startConnection();
        } catch (err) {
            console.error('Fatal error establishing WhatsApp connection:', err);
            throw err;
        }

        // Start HTTP server
        server = await startServer(sock);

        // Listen for messages with enhanced error handling
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const m = messages[0];
            if (!m.message) return;

            try {
                await messageHandler(sock, m);
            } catch (err) {
                logger.error('Error handling message:', { //Preserving original logger here
                    error: err.message,
                    stack: err.stack,
                    messageId: m.key?.id,
                    from: m.key?.remoteJid
                });
            }
        });

        // Enhanced graceful shutdown
        const cleanup = async (signal) => {
            console.log(`Received ${signal} signal. Cleaning up...`);

            if (server) {
                await new Promise((resolve) => {
                    server.close(() => {
                        console.log('HTTP server closed');
                        resolve();
                    });
                });
            }

            if (sock) {
                try {
                    await sock.logout();
                    console.log('WhatsApp logout successful');
                } catch (err) {
                    console.error('Error during WhatsApp logout:', err);
                }
            }

            process.exit(0);
        };

        process.on('SIGTERM', () => cleanup('SIGTERM'));
        process.on('SIGINT', () => cleanup('SIGINT'));

    } catch (err) {
        console.error('Fatal error starting bot:', err);

        if (server) {
            try {
                await new Promise((resolve) => {
                    server.close(() => {
                        console.log('HTTP server closed due to fatal error');
                        resolve();
                    });
                });
            } catch (cleanupErr) {
                console.error('Error during server cleanup:', cleanupErr);
            }
        }

        process.exit(1);
    }
}

// Start the bot
main().catch(err => {
    console.error('Fatal error starting bot:', err);
    process.exit(1);
});