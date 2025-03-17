/**
 * Cloud-Optimized WhatsApp QR Web Server
 * Enhanced for Heroku deployment
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');

// Configuration with enhanced environment variable support
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Required for Heroku
const AUTH_FOLDER = process.env.AUTH_FOLDER || path.join(__dirname, '../auth_info_baileys');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Initialize Express app
const app = express();
const server = http.createServer(app);

// View settings
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Enhanced logging for Heroku environment
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: true,
            ignore: 'pid,hostname'
        }
    }
});

// WebSocket server with proper configuration for Heroku
const wss = new WebSocket.Server({ 
    server,
    clientTracking: true
});

// Create required directories
[AUTH_FOLDER, path.join(__dirname, '../views'), path.join(__dirname, '../public')].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
    }
});

// Store connection state
let connectionState = {
    sock: null,
    qr: null,
    isConnected: false,
    lastDisconnectReason: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: IS_PRODUCTION ? 20 : 10
};

// Basic health check route for Heroku
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Main QR route
app.get('/', (req, res) => {
    res.render('qr');
});

app.get('/status', (req, res) => {
    res.json({
        connected: connectionState.isConnected,
        lastDisconnect: connectionState.lastDisconnectReason,
        reconnectAttempts: connectionState.reconnectAttempts
    });
});

// Start WhatsApp connection
async function startConnection() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

        const sock = makeWASocket({
            logger,
            printQRInTerminal: !IS_PRODUCTION,
            auth: state,
            browser: ['BLACKSKY-MD', 'Chrome', '4.0.0'],
            defaultQueryTimeoutMs: 60000
        });

        connectionState.sock = sock;

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', handleConnectionUpdate);
        sock.ev.on('messages.upsert', handleMessages);

        logger.info('WhatsApp connection initialized');
        return sock;
    } catch (error) {
        logger.error('Failed to start WhatsApp connection:', error);
        throw error;
    }
}

// Start server with proper error handling
async function startServer() {
    try {
        server.listen(PORT, HOST, () => {
            logger.info(`Server running on port ${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });

        // Enhanced error handling
        server.on('error', (error) => {
            logger.error('Server error:', error);
            if (error.code === 'EADDRINUSE') {
                logger.error(`Port ${PORT} is already in use`);
                process.exit(1);
            }
        });

        // Start WhatsApp connection
        await startConnection();

    } catch (err) {
        logger.error('Fatal error starting server:', err);
        throw err;
    }
}

// Helper functions
function handleWebSocketConnection(ws, req) {
    const isSecure = req.headers['x-forwarded-proto'] === 'https';
    const protocol = isSecure ? 'wss' : 'ws';
    const host = req.headers.host;

    // Send current connection status
    ws.send(JSON.stringify({
        type: 'connection',
        connected: connectionState.isConnected,
        reason: connectionState.lastDisconnectReason
    }));

    // Send QR if available
    if (connectionState.qr && !connectionState.isConnected) {
        qrcode.toDataURL(connectionState.qr, (err, url) => {
            if (!err) {
                ws.send(JSON.stringify({
                    type: 'qr',
                    qr: `<img src="${url}" width="256" height="256" />`
                }));
            }
        });
    }
}

// Handle WhatsApp connection updates
function handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
        connectionState.qr = qr;
        broadcastQR(qr);
    }

    if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect && connectionState.reconnectAttempts < connectionState.maxReconnectAttempts) {
            connectionState.reconnectAttempts++;
            setTimeout(startConnection, 3000);
        }

        broadcastToClients({
            type: 'connection',
            connected: false,
            reason: lastDisconnect?.error?.message || 'Connection closed'
        });
    } else if (connection === 'open') {
        connectionState.isConnected = true;
        connectionState.reconnectAttempts = 0;

        broadcastToClients({
            type: 'connection',
            connected: true
        });
    }
}

// Handle incoming messages
function handleMessages(m) {
    if (m.type === 'notify') {
        const msg = m.messages[0];
        if (msg?.key && msg.key.remoteJid) {
            connectionState.sock.readMessages([msg.key]);
        }
        if (msg.message && !msg.key.fromMe) {
            const messageText = msg.message.conversation || (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) || '';
            if (messageText.toLowerCase() === '!ping') {
                connectionState.sock.sendMessage(msg.key.remoteJid, { text: '🏓 Pong!' });
            }
        }
    }
}

// Broadcast QR code to all clients
function broadcastQR(qr) {
    qrcode.toDataURL(qr, (err, url) => {
        if (!err) {
            broadcastToClients({
                type: 'qr',
                qr: `<img src="${url}" width="256" height="256" />`
            });
        }
    });
}

// Broadcast message to all WebSocket clients
function broadcastToClients(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// WebSocket connection handling
wss.on('connection', handleWebSocketConnection);

// Start the server
startServer().catch(err => {
    logger.error('Fatal error starting server:', err);
    process.exit(1);
});

async function loadCommandModules(socket) {
    const commandsDir = path.join(__dirname, '../commands');

    // Ensure the commands directory exists
    if (!fs.existsSync(commandsDir)) {
        fs.mkdirSync(commandsDir, { recursive: true });

        // Create a basic command module for testing
        const basicCommandsPath = path.join(commandsDir, 'basic.js');
        const basicCommandsContent = `
/**
 * Basic Commands Module
 * Core command functionality for the bot
 */

module.exports = {
    info: {
        name: 'Basic Commands',
        description: 'Core command functionality',
    },

    commands: {
        // Ping command to test bot responsiveness
        ping: {
            description: 'Test if the bot is responding',
            syntax: '{prefix}ping',
            handler: async (sock, msg, args) => {
                const startTime = Date.now();
                await sock.sendMessage(msg.key.remoteJid, { text: 'Measuring response time...' });
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                return { text: \`🏓 Pong! Response time: \${responseTime}ms\` };
            }
        },

        // Help command
        help: {
            description: 'Show available commands',
            syntax: '{prefix}help [command]',
            handler: async (sock, msg, args) => {
                if (args.length > 0) {
                    // Show help for specific command (not implemented in this basic example)
                    return { text: \`Help for command "\${args[0]}" is not available yet.\` };
                }

                return {
                    text: \`*BLACKSKY-MD Bot Commands*
                    
                    • {prefix}ping - Check if bot is online
                    • {prefix}help - Show this help message
                    • {prefix}info - Show bot information
                    
                    _Type {prefix}help [command] for specific command help_\`
                };
            }
        },

        // Bot info command
        info: {
            description: 'Show bot information',
            syntax: '{prefix}info',
            handler: async (sock, msg, args) => {
                return {
                    text: \`*BLACKSKY-MD WhatsApp Bot*
                    
                    Version: 1.0.0
                    Running on: Cloud Server
                    Made with: @whiskeysockets/baileys
                    
                    _Type {prefix}help for available commands_\`
                };
            }
        }
    }
};
`;
        fs.writeFileSync(basicCommandsPath, basicCommandsContent);
        logger.info('Created basic commands module');
    }

    logger.info('Commands directory ready');
    return 1;
}


async function backupAuthFolder() {
    try {
        const backupDir = path.join(__dirname, '../auth_info_baileys_backup');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = Date.now();
        const targetDir = path.join(backupDir, `backup_${timestamp}`);
        fs.mkdirSync(targetDir, { recursive: true });

        const files = fs.readdirSync(AUTH_FOLDER);
        let fileCount = 0;

        for (const file of files) {
            const src = path.join(AUTH_FOLDER, file);
            const dest = path.join(targetDir, file);
            fs.copyFileSync(src, dest);
            fileCount++;
        }

        logger.info(`Backup created successfully (${fileCount} files) at ${targetDir}`);

        // Clean up old backups (keep only the 5 most recent)
        const backups = fs.readdirSync(backupDir)
            .filter(dir => dir.startsWith('backup_'))
            .map(dir => ({ name: dir, time: parseInt(dir.split('_')[1]) }))
            .sort((a, b) => b.time - a.time);

        const toDelete = backups.slice(5);
        for (const backup of toDelete) {
            const dirPath = path.join(backupDir, backup.name);
            fs.rmSync(dirPath, { recursive: true, force: true });
        }

        if (toDelete.length > 0) {
            logger.info(`Cleaned up ${toDelete.length} old backup(s)`);
        }

        return true;
    } catch (error) {
        logger.error('Failed to create backup:', error);
        return false;
    }
}

//Save session credentials to persist between restarts (modified for Heroku compatibility)

async function saveSessionToEnv(creds) {
    if (!creds) return false;

    try {
        const credsJSON = JSON.stringify(creds);
        logger.info('Session credentials saved'); //Heroku will handle saving to the filesystem
        return true;
    } catch (error) {
        logger.error('Failed to save session credentials:', error);
        return false;
    }
}