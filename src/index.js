const express = require('express');
const { startConnection } = require('./connection');
const { messageHandler } = require('./handlers/messageHandler');
const { commandLoader } = require('./utils/commandLoader');
const commandModules = require('./commands/index');
const logger = require('./utils/logger');
const config = require('./config/config');

async function startServer(sock) {
    const app = express();
    app.use(express.json());
    
    // Store the sock instance for later use
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
            // If we're initializing, show a link to the QR code
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

    // Debug endpoint to check command loading
    app.get('/debug/commands', (req, res) => {
        const stats = commandLoader.getCommandStats();
        const commands = commandLoader.getAllCommands();
        const commandsByCategory = {};

        // Group commands by category
        commands.forEach(cmd => {
            if (!commandsByCategory[cmd.category]) {
                commandsByCategory[cmd.category] = [];
            }
            commandsByCategory[cmd.category].push(cmd.name);
        });

        res.json({
            total: commands.length,
            stats,
            categories: Object.keys(commandsByCategory).map(category => ({
                name: category,
                commandCount: commandsByCategory[category].length,
                commands: commandsByCategory[category]
            }))
        });
    });

    // Advanced debug endpoint to check command loading errors
    app.get('/debug/command-modules', async (req, res) => {
        try {
            const commandsPath = require('path').join(__dirname, 'commands');
            const files = require('fs').readdirSync(commandsPath);

            const moduleStatus = [];

            for (const file of files) {
                if (!file.endsWith('.js') || file === 'index.js') continue;

                try {
                    // Try to require the module directly for diagnostic purposes
                    const modulePath = require('path').join(commandsPath, file);
                    delete require.cache[require.resolve(modulePath)]; // Clear cache
                    const moduleData = require(modulePath);

                    moduleStatus.push({
                        file,
                        loaded: true,
                        hasCommands: !!moduleData.commands,
                        commandCount: moduleData.commands ? Object.keys(moduleData.commands).length : 0,
                        category: moduleData.category || file.replace('.js', ''),
                        hasInit: typeof moduleData.init === 'function',
                        error: null
                    });
                } catch (err) {
                    moduleStatus.push({
                        file,
                        loaded: false,
                        hasCommands: false,
                        commandCount: 0,
                        category: file.replace('.js', ''),
                        hasInit: false,
                        error: {
                            message: err.message,
                            stack: err.stack
                        }
                    });
                }
            }

            res.json({
                totalModules: moduleStatus.length,
                moduleStatus
            });
        } catch (err) {
            res.status(500).json({
                error: err.message,
                stack: err.stack
            });
        }
    });

    // Use port 5000 for the API server (separate from QR code server)
    const PORT = 5000;
    const server = app.listen(PORT, '0.0.0.0')
        .on('error', (err) => {
            console.error('Failed to start HTTP server:', err);
            process.exit(1);
        });

    return server;
}

async function main() {
    let server = null;
    let sock = null;

    try {
        // Clear console first
        process.stdout.write('\x1Bc');
        
        // Start the API server immediately to make port 5000 available
        console.log('Starting API server first...');
        server = await startServer(null); // Pass null for sock for now
        console.log('API server started on port 5000');
        
        // Start WhatsApp connection to show QR code
        try {
            sock = await startConnection();
        } catch (err) {
            console.error('Fatal error establishing WhatsApp connection:', err);
            throw err;
        }

        // Only load commands after successful connection
        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;

            if (connection === 'open') {
                // Silence the logger temporarily
                const originalLevel = logger.level;
                logger.level = 'silent';

                try {
                    await commandLoader.loadCommandHandlers();
                    await commandModules.initializeModules(sock);
                    
                    // Update the express app with the sock instance
                    // We can directly access the app via server
                    const expressApp = server._events.request;
                    if (expressApp && typeof expressApp.set === 'function') {
                        expressApp.set('sock', sock);
                        console.log('Updated server with active WhatsApp connection');
                    } else {
                        console.log('Unable to update server with sock instance');
                    }
                } catch (err) {
                    console.error('Error during initialization:', err);
                } finally {
                    // Restore logger level
                    logger.level = originalLevel;
                }
            }
        });

        // Enhanced graceful shutdown
        const cleanup = async (signal) => {
            console.log(`\nReceived ${signal} signal. Cleaning up...`);

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
        process.exit(1);
    }
}

// Start the bot
main().catch(err => {
    console.error('Fatal error starting bot:', err);
    process.exit(1);
});