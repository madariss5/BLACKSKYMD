const { startConnection } = require('./connection');
const { messageHandler } = require('./handlers/messageHandler');
const logger = require('./utils/logger');

async function startBot() {
    try {
        const sock = await startConnection();
        
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

    } catch (err) {
        logger.error('Failed to start bot:', err);
        process.exit(1);
    }
}

startBot();
