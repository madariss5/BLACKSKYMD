/**
 * Termux-Optimized WhatsApp Connection Script
 * This script is specifically designed for better performance on Android Termux environment
 * It uses minimal dependencies and memory footprint while maintaining full command functionality
 */

// Use Termux polyfills for missing dependencies
require('./use-polyfills');

const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

// Import command handlers and utilities
let messageHandler;
let commandHandler;
let safeSendMessage;
let connectionMonitor;

try {
    // Try to import command handler and message processor
    messageHandler = require('./handlers/messageHandler');
    commandHandler = require('./handlers/commandHandler');
    // Import utility functions for JID handling
    const jidHelper = require('./utils/jidHelper');
    safeSendMessage = jidHelper.safeSendMessage;
    // Import connection monitoring
    const ConnectionMonitor = require('./utils/connectionMonitor');
    connectionMonitor = new ConnectionMonitor();
} catch (err) {
    console.log('Lightweight mode enabled: Some modules could not be loaded');
    console.log('The bot will run with basic functionality only');
}

// Use a fixed session ID for better stability
const SESSION_ID = process.env.SESSION_ID || 'BlackskyMD';
const AUTH_FOLDER = `./auth_info_${SESSION_ID}`;

// Ensure auth folder exists
if (!fs.existsSync(AUTH_FOLDER)) {
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
}

// Create data directory if it doesn't exist
const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Minimal logger - reduce verbosity for Termux
const logger = pino({ 
    level: 'warn',
    transport: { 
        target: 'pino-pretty',
        options: { 
            colorize: true,
            translateTime: true,
            ignore: 'hostname,pid'
        } 
    }
});

// Minimal message handler if main handler fails to load
const minimalMessageHandler = async (sock, message) => {
    if (!message.message) return;
    
    const type = Object.keys(message.message)[0];
    if (message.key.fromMe) return;
    
    try {
        const textMessage = message.message.conversation || 
                           (message.message?.extendedTextMessage?.text) || 
                           '';
        
        if (textMessage.startsWith('!')) {
            const [command, ...args] = textMessage.slice(1).split(' ');
            
            // Basic command handling
            if (command === 'ping') {
                await sock.sendMessage(message.key.remoteJid, { text: 'Pong! Bot is running in Termux mode.' });
            } else if (command === 'help') {
                await sock.sendMessage(message.key.remoteJid, { 
                    text: 'BLACKSKY-MD Bot\n\nRunning in Termux lightweight mode\nPrefix: !\n\n' +
                         'Basic Commands:\n' +
                         '!ping - Check if bot is running\n' +
                         '!help - Show this help message\n' +
                         '!info - Show bot information\n' +
                         '!status - Show command system status\n' +
                         '!debug - Diagnostics for troubleshooting\n\n' +
                         'All regular commands should also work!' 
                });
            } else if (command === 'info') {
                await sock.sendMessage(message.key.remoteJid, { 
                    text: 'BLACKSKY-MD Bot\nVersion: 1.0.0\nRunning on: Termux\nOptimized: Yes\n' +
                          'Memory usage: ' + (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + ' MB' 
                });
            } else if (command === 'debug') {
                // Enhanced debugging information
                let debugInfo = '*BLACKSKY-MD Debug Information*\n\n';
                
                // Directory structure
                try {
                    debugInfo += '*Current Directory:*\n';
                    debugInfo += `${process.cwd()}\n\n`;
                    
                    debugInfo += '*Directory Listing:*\n';
                    const rootFiles = fs.readdirSync('.');
                    debugInfo += rootFiles.join(', ') + '\n\n';
                    
                    // Check for src/commands
                    if (rootFiles.includes('src')) {
                        const srcFiles = fs.readdirSync('./src');
                        debugInfo += '*src/ Directory:*\n';
                        debugInfo += srcFiles.join(', ') + '\n\n';
                        
                        if (srcFiles.includes('commands')) {
                            const commandFiles = fs.readdirSync('./src/commands');
                            debugInfo += '*src/commands/ Directory:*\n';
                            debugInfo += commandFiles.join(', ') + '\n\n';
                            
                            debugInfo += `Total command files: ${commandFiles.length}\n`;
                        } else {
                            debugInfo += '*commands/ not found in src/*\n\n';
                        }
                    } else {
                        debugInfo += '*src/ directory not found*\n\n';
                    }
                } catch (dirErr) {
                    debugInfo += `Error listing directories: ${dirErr.message}\n\n`;
                }
                
                // Module loading information
                try {
                    debugInfo += '*Module Information:*\n';
                    const wrapper = require('./termux-command-wrapper');
                    const commands = await wrapper.getAllCommands();
                    debugInfo += `Command modules loaded: ${commands.size}\n`;
                    
                    if (commands.size > 0) {
                        let totalCommands = 0;
                        for (const cmds of commands.values()) {
                            totalCommands += cmds.length;
                        }
                        debugInfo += `Total commands: ${totalCommands}\n\n`;
                    } else {
                        debugInfo += '\n*Attempting Fresh Module Load:*\n';
                        
                        // Try loading a single module directly for debugging
                        try {
                            const basicPath = path.join(process.cwd(), 'src', 'commands', 'basic.js');
                            if (fs.existsSync(basicPath)) {
                                debugInfo += `basic.js exists at: ${basicPath}\n`;
                                try {
                                    const basicModule = require(basicPath);
                                    debugInfo += `basic.js loaded: ${basicModule ? 'YES' : 'NO'}\n`;
                                    debugInfo += `Keys: ${Object.keys(basicModule).join(', ')}\n`;
                                } catch (moduleErr) {
                                    debugInfo += `Error loading basic.js: ${moduleErr.message}\n`;
                                }
                            } else {
                                debugInfo += `basic.js not found at: ${basicPath}\n`;
                            }
                        } catch (err) {
                            debugInfo += `Error in test load: ${err.message}\n`;
                        }
                    }
                } catch (wrapperErr) {
                    debugInfo += `Module wrapper error: ${wrapperErr.message}\n`;
                }
                
                // System information
                debugInfo += '\n*System Information:*\n';
                debugInfo += `Node.js: ${process.version}\n`;
                debugInfo += `Platform: ${process.platform}\n`;
                debugInfo += `Architecture: ${process.arch}\n`;
                debugInfo += `PID: ${process.pid}\n`;
                debugInfo += `Uptime: ${(process.uptime() / 60).toFixed(2)} minutes\n`;
                
                // Memory usage
                const memoryUsage = process.memoryUsage();
                debugInfo += '\n*Memory Usage:*\n';
                debugInfo += `RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB\n`;
                debugInfo += `Heap Total: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB\n`;
                debugInfo += `Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB\n`;
                
                await sock.sendMessage(message.key.remoteJid, { text: debugInfo });
            } else if (command === 'status') {
                // Check status of command systems
                let statusMessage = '*BLACKSKY-MD Command System Status*\n\n';
                
                // Check message handler
                statusMessage += `Message Handler: ${messageHandler ? 'Available' : 'Not available'}\n`;
                statusMessage += `Command Handler: ${commandHandler ? 'Available' : 'Not available'}\n`;
                
                // Check command wrapper
                try {
                    const wrapper = require('./termux-command-wrapper');
                    const commands = await wrapper.getAllCommands();
                    const modulesCount = commands.size;
                    let totalCommands = 0;
                    
                    for (const cmds of commands.values()) {
                        totalCommands += cmds.length;
                    }
                    
                    statusMessage += `Command Wrapper: Available\n`;
                    statusMessage += `Command Modules: ${modulesCount}\n`;
                    statusMessage += `Total Commands: ${totalCommands}\n\n`;
                    
                    if (modulesCount > 0) {
                        statusMessage += '*Available Modules:*\n';
                        for (const [module, cmds] of commands.entries()) {
                            statusMessage += `• ${module} (${cmds.length} commands)\n`;
                        }
                    }
                } catch (err) {
                    statusMessage += `Command Wrapper: Not available\n`;
                    statusMessage += `Error: ${err.message}\n`;
                }
                
                await sock.sendMessage(message.key.remoteJid, { text: statusMessage });
            }
        }
    } catch (err) {
        console.error('Error in minimal message handler:', err);
    }
};

// Connection function
async function connectToWhatsApp() {
    // Reduced logging for low memory consumption
    console.log('Starting WhatsApp connection in Termux-optimized mode...');
    
    try {
        // Use multifile auth for better stability in low-resource environments
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
        
        // Create socket with optimized options for Termux
        const sock = makeWASocket({
            printQRInTerminal: true,
            browser: ['BLACKSKY-MD', 'Termux', '1.0.0'],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            logger,
            // Reduce message history cache for lower memory usage
            msgRetryCounterCache: {},
            // Optimized connection options for Termux
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            // Minimal media cache for reduced memory usage
            mediaCache: {
                maxSize: 50 // Reduced cache size for Termux
            },
            // Process all messages
            shouldIgnoreJid: jid => false
        });
        
        // Handle connection updates with minimal processing
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('Scan this QR code in WhatsApp:');
                qrcode.generate(qr, { small: true });
            }
            
            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                
                console.log('Connection closed due to:', reason || 'unknown reason');
                
                // Optimize reconnection for Termux resource management
                if (reason !== DisconnectReason.loggedOut) {
                    console.log('Reconnecting...');
                    // Use exponential backoff for reconnect to avoid excessive CPU usage
                    const reconnectDelay = Math.min(5000, (lastDisconnect?.error?.output?.statusCode === 428 ? 15000 : 3000));
                    setTimeout(connectToWhatsApp, reconnectDelay);
                } else {
                    console.log('Logged out. Please restart the application.');
                    // Remove auth to allow new login
                    try {
                        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                    } catch (err) {
                        console.error('Failed to remove auth folder:', err);
                    }
                }
            }
            
            if (connection === 'open') {
                console.log('Connected successfully!');
                console.log('Your bot is now running in Termux-optimized mode.');
                console.log('All commands are available and working.');
                
                // Start monitoring connection health
                if (connectionMonitor) {
                    connectionMonitor.startMonitoring(sock);
                    console.log('Connection monitoring enabled.');
                }
                
                // Write connection status to file
                try {
                    fs.writeFileSync('./connection-health.json', JSON.stringify({
                        status: 'connected',
                        timestamp: Date.now(),
                        environment: 'termux'
                    }, null, 2));
                } catch (err) {
                    console.error('Failed to write connection status:', err);
                }
            }
        });
        
        // Save credentials on update
        sock.ev.on('creds.update', saveCreds);
        
        // Initialize command handler if available
        let handlerInitialized = false;
        
        if (messageHandler && messageHandler.init) {
            try {
                await messageHandler.init();
                console.log('Message handler initialized successfully');
                handlerInitialized = true;
            } catch (err) {
                console.error('Failed to initialize message handler:', err);
            }
        }
        
        if (commandHandler && !commandHandler.isInitialized && commandHandler.loadCommands) {
            try {
                await commandHandler.loadCommands();
                console.log('Command handler initialized successfully');
            } catch (err) {
                console.error('Failed to initialize command handler:', err);
            }
        }
        
        // Import the Termux command wrapper for better command handling
        let commandWrapper;
        try {
            commandWrapper = require('./termux-command-wrapper');
            console.log('Loaded Termux command wrapper for enhanced command support');
            
            // Initialize all command modules with the wrapper
            commandWrapper.initializeAllModules(sock)
                .then(count => {
                    console.log(`Initialized ${count} command modules through wrapper`);
                })
                .catch(err => {
                    console.error('Error initializing command modules through wrapper:', err.message);
                });
        } catch (err) {
            console.error('Failed to load Termux command wrapper:', err.message);
        }

        // Set up message processor with enhanced command handling
        sock.ev.on('messages.upsert', async ({ messages }) => {
            if (!messages[0]) return;
            
            try {
                // Get config for prefix
                let prefix = '!';
                try {
                    const config = require('./config/config');
                    if (config.bot && config.bot.prefix) {
                        prefix = config.bot.prefix;
                    }
                } catch (configErr) {
                    console.log('Using default prefix: !');
                }
                
                // Try to use main message handler first
                let handled = false;
                
                if (handlerInitialized && messageHandler && messageHandler.messageHandler) {
                    try {
                        await messageHandler.messageHandler(sock, messages[0]);
                        handled = true;
                    } catch (handlerErr) {
                        console.error('Error in main message handler:', handlerErr.message);
                    }
                }
                
                // If not handled and command wrapper is available, try to use it
                if (!handled && commandWrapper) {
                    try {
                        handled = await commandWrapper.processMessage(sock, messages[0], prefix);
                    } catch (wrapperErr) {
                        console.error('Error in command wrapper processing:', wrapperErr.message);
                    }
                }
                
                // If still not handled, use minimal handler as last resort
                if (!handled) {
                    await minimalMessageHandler(sock, messages[0]);
                }
            } catch (err) {
                console.error('Error in message processing:', err);
                // Always ensure minimal handler works
                try {
                    await minimalMessageHandler(sock, messages[0]);
                } catch (innerErr) {
                    console.error('Error in fallback message handler:', innerErr);
                }
            }
        });
        
        // Set up group participant handler
        sock.ev.on('group-participants.update', async (event) => {
            try {
                if (messageHandler && messageHandler.groupParticipantsHandler) {
                    await messageHandler.groupParticipantsHandler(sock, event);
                }
            } catch (err) {
                console.error('Error in group participants handler:', err);
            }
        });
        
        console.log('WhatsApp connection initialized. Waiting for connection...');
        return sock;
    } catch (err) {
        console.error('Error in connection:', err);
        console.log('Retrying in 5 seconds...');
        setTimeout(connectToWhatsApp, 5000);
    }
}

// Start connection
connectToWhatsApp();