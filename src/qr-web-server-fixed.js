/**
 * WhatsApp QR Web Server and Connection Manager
 * Enhanced with session replacement protection
 */

const connection = require('./connection');
const logger = require('./utils/logger');
const path = require('path');
const fs = require('fs').promises;
const messageHandlerModule = require('./handlers/messageHandler');

// Reference to active WhatsApp socket
let sock = null;

/**
 * Start the WhatsApp connection and web server
 */
async function startServer() {
    try {
        // Initialize web server (for QR code display)
        await connection.initServer();
        
        // Initialize handler
        await messageHandlerModule.init();
        
        // Get the WhatsApp connection
        sock = await connection.startConnection();
        
        // Set up message handler
        if (sock) {
            sock.ev.on('messages.upsert', async (m) => {
                if (m.type === 'notify') {
                    try {
                        for (const msg of m.messages) {
                            await messageHandlerModule.messageHandler(sock, msg);
                        }
                    } catch (err) {
                        logger.error(`Error handling message: ${err.message}`);
                    }
                }
            });
        }
        
        // Set up process exit handler for cleanup
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, cleaning up...');
            await connection.cleanup();
            process.exit(0);
        });
        
        return sock;
    } catch (err) {
        logger.error(`Error starting server: ${err.message}`);
        return null;
    }
}

// Start the server
startServer().catch(err => {
    logger.error(`Fatal error starting server: ${err.message}`);
});

module.exports = { startServer };