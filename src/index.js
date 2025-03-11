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

    // Always serve on port 5000 for Replit compatibility
    const PORT = 5000;
    const server = app.listen(PORT, '0.0.0.0')
        .on('error', (err) => {
            console.error('Failed to start HTTP server:', err);
            process.exit(1);
        })
        .on('listening', () => {
            console.log(`Server is running on port ${PORT}`);
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
        sock.ev.process(async (events) => {
            // Process incoming messages
            if (events['messages.upsert']) {
                const upsert = events['messages.upsert'];
                console.log('Received message type:', upsert.type);
                
                // For debugging: log the entire event structure
                console.log('Full message event:', JSON.stringify(upsert, null, 2));
                
                // Process new messages - 'notify' is for new messages
                if (upsert.type === 'notify') {
                    for (const msg of upsert.messages) {
                        // Full message debug for first few messages (to avoid log flooding)
                        console.log('Message content:', JSON.stringify(msg, null, 2));
                        
                        if (!msg.message) {
                            console.log('Skipping message with no content');
                            continue; // Skip if no message content
                        }
                        
                        // Log the message details for debugging
                        logger.info(`Processing message from ${msg.key.remoteJid}`, {
                            messageType: Object.keys(msg.message || {})[0],
                            messageKeys: Object.keys(msg.message || {}),
                            fromMe: msg.key.fromMe,
                            isGroup: msg.key.remoteJid?.endsWith('@g.us')
                        });
                        
                        // Extract the text content for debug purposes
                        const msgText = msg.message?.conversation || 
                                       msg.message?.extendedTextMessage?.text ||
                                       msg.message?.imageMessage?.caption ||
                                       msg.message?.videoMessage?.caption || 
                                       "No text content";
                        console.log(`Message text: "${msgText}"`);
                        
                        try {
                            // Handle group messages via group handler
                            if (msg.key.remoteJid?.endsWith('@g.us')) {
                                await handleGroupMessage(sock, msg);
                            }
                            
                            // Process all messages through the main handler
                            await messageHandler(sock, msg);
                            
                            // Send acknowledgment for text messages explicitly
                            if (msgText && !msg.key.fromMe) {
                                console.log('Sending explicit welcome message...');
                                try {
                                    await sock.sendMessage(msg.key.remoteJid, {
                                        text: `I received your message: "${msgText}"\nType .help to see available commands.`
                                    });
                                } catch (sendErr) {
                                    console.error('Error sending welcome message:', sendErr);
                                }
                            }
                        } catch (err) {
                            logger.error('Error handling message:', {
                                error: err.message,
                                stack: err.stack,
                                messageId: msg.key?.id,
                                from: msg.key?.remoteJid
                            });
                        }
                    }
                } else {
                    console.log('Ignoring non-notify message type:', upsert.type);
                }
            }
            
            // Handle group participant updates
            if (events['group-participants.update']) {
                try {
                    await handleGroupParticipantsUpdate(sock, events['group-participants.update']);
                } catch (err) {
                    logger.error('Error handling group participants update:', err);
                }
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
        
        // Implement periodic memory cleanup to keep the bot running smoothly 24/7
        const MEMORY_CLEANUP_INTERVAL = 3600000; // 1 hour
        setInterval(() => {
            try {
                if (global.gc) {
                    global.gc();
                    logger.info('Performed garbage collection to free memory');
                }
                
                // Check for possible memory leaks
                const memoryUsage = process.memoryUsage();
                logger.info('Memory usage stats:', {
                    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
                    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`, 
                    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`
                });
                
                // If memory usage is too high, implement more aggressive cleanup
                if (memoryUsage.heapUsed > 1024 * 1024 * 500) { // 500MB threshold
                    logger.warn('High memory usage detected, performing additional cleanup');
                    // Clear command cache to free memory
                    commandLoader.reloadCommands();
                }
            } catch (memErr) {
                logger.error('Memory cleanup error:', memErr);
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