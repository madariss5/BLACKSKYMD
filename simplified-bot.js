/**
 * Simplified WhatsApp Bot
 * Designed for maximum reliability 
 */

// External modules
const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');

// Express for web server
const express = require('express');
const app = express();

// Constants
const PORT = process.env.PORT || 5000;
const SESSION_DIR = './auth_info_qr';

// Track bot statistics
const botStats = {
    startTime: Date.now(),
    messagesReceived: 0,
    commandsProcessed: 0,
    errors: 0,
    lastMessage: null,
    lastCommand: null,
    lastError: null,
    status: 'initializing' // initializing, connecting, connected, disconnected, error
};

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Root endpoint with status dashboard
app.get('/', (req, res) => {
    const uptime = Math.floor((Date.now() - botStats.startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    
    res.send(`
        <html>
            <head>
                <title>WhatsApp Bot Status</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                    .status { padding: 10px; border-radius: 5px; margin-bottom: 10px; }
                    .connected { background-color: #d4edda; color: #155724; }
                    .disconnected { background-color: #f8d7da; color: #721c24; }
                    .connecting { background-color: #fff3cd; color: #856404; }
                    .initializing { background-color: #d1ecf1; color: #0c5460; }
                    .error { background-color: #f8d7da; color: #721c24; }
                    .stat-container { display: flex; flex-wrap: wrap; gap: 20px; }
                    .stat-box { flex: 1; min-width: 200px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
                </style>
            </head>
            <body>
                <h1>WhatsApp Bot Status</h1>
                <div class="status ${botStats.status}">
                    <strong>Status:</strong> ${botStats.status.charAt(0).toUpperCase() + botStats.status.slice(1)}
                </div>
                
                <div class="stat-container">
                    <div class="stat-box">
                        <h3>Uptime</h3>
                        <p>${hours}h ${minutes}m ${seconds}s</p>
                    </div>
                    <div class="stat-box">
                        <h3>Messages</h3>
                        <p>${botStats.messagesReceived} received</p>
                    </div>
                    <div class="stat-box">
                        <h3>Commands</h3>
                        <p>${botStats.commandsProcessed} processed</p>
                    </div>
                    <div class="stat-box">
                        <h3>Errors</h3>
                        <p>${botStats.errors} occurred</p>
                    </div>
                </div>
                
                <h3>Last Activity</h3>
                <div class="stat-container">
                    <div class="stat-box">
                        <h4>Last Message</h4>
                        <p>${botStats.lastMessage || 'None yet'}</p>
                    </div>
                    <div class="stat-box">
                        <h4>Last Command</h4>
                        <p>${botStats.lastCommand || 'None yet'}</p>
                    </div>
                </div>
                
                ${botStats.lastError ? `
                <h3>Last Error</h3>
                <div class="stat-box">
                    <p>${botStats.lastError}</p>
                </div>
                ` : ''}
                
                <p><small>Generated at ${new Date().toLocaleString()}</small></p>
            </body>
        </html>
    `);
});

// Heartbeat endpoint
app.get('/heartbeat', (req, res) => {
    res.json({
        status: botStats.status,
        uptime: Math.floor((Date.now() - botStats.startTime) / 1000),
        stats: {
            messagesReceived: botStats.messagesReceived,
            commandsProcessed: botStats.commandsProcessed,
            errors: botStats.errors
        },
        timestamp: Date.now()
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    // Calculate memory usage
    const memoryUsage = process.memoryUsage();
    
    res.json({
        status: botStats.status,
        uptime: Math.floor((Date.now() - botStats.startTime) / 1000),
        memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            external: Math.round(memoryUsage.external / 1024 / 1024)
        },
        timestamp: Date.now()
    });
});

// Load our ultra minimal handler
const handler = require('./src/handlers/ultra-minimal-handler');

// Save session data
const saveCreds = (creds) => {
    try {
        fs.writeFileSync(
            path.join(SESSION_DIR, 'creds.json'),
            JSON.stringify(creds, null, 2)
        );
    } catch (err) {
        console.error('Error saving credentials:', err);
    }
};

// Initialize WhatsApp connection
async function connectToWhatsApp() {
    try {
        // Ensure auth directory exists
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }
        
        // Get authentication state
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        
        // Create socket connection with better timeout and keepalive settings
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            keepAliveIntervalMs: 30000, // Send a ping every 30 seconds
            connectTimeoutMs: 60000,    // Wait up to 60 seconds for connection
            defaultQueryTimeoutMs: 30000, // Default timeout for queries
            emitOwnEvents: false,       // Don't process our own messages
            browser: ['BLACKSKY-MD', 'Chrome', '104.0.0.0'], // Standard browser signature
            markOnlineOnConnect: true,  // Mark as online when connected
            syncFullHistory: false      // Don't sync full history to save resources
        });
        
        // Track connection state
        let isConnected = false;
        let reconnectAttempt = 0;
        let connectionLock = false; // Prevent multiple reconnection attempts
        let messageHandlerInitialized = false;
        
        // Set up automatic reconnection after network errors
        const reconnectAfterNetworkError = () => {
            // Prevent multiple reconnection attempts
            if (connectionLock) return;
            connectionLock = true;
            
            // Incremental backoff for reconnection attempts
            const delaySeconds = Math.min(30, Math.pow(2, reconnectAttempt));
            reconnectAttempt++;
            
            console.log(`Reconnecting in ${delaySeconds} seconds (attempt ${reconnectAttempt})...`);
            setTimeout(() => {
                console.log('Attempting reconnection...');
                connectionLock = false;
                connectToWhatsApp();
            }, delaySeconds * 1000);
        };
        
        // Connection update handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // Update bot status based on connection state
            if (connection) {
                botStats.status = connection; // connecting, open, close
            }
            
            if (connection === 'close') {
                console.log('Connection closed, analyzing reason...');
                
                let shouldReconnect = true;
                let clearCredentials = false;
                
                if (lastDisconnect?.error instanceof Boom) {
                    const statusCode = lastDisconnect.error.output.statusCode;
                    const reason = lastDisconnect.error.output.payload.error;
                    console.log(`Disconnected with status code ${statusCode} (${reason})`);
                    
                    // Handle specific error codes
                    if (statusCode === 440 || statusCode === 401) {
                        console.log('Session ended or invalid, clearing credentials...');
                        clearCredentials = true;
                    } else if (statusCode === 428) {
                        console.log('Connection closed due to another connection opened');
                    } else if (statusCode === 503) {
                        console.log('Server error, waiting before reconnect');
                    }
                } else if (lastDisconnect?.error) {
                    // Handle network errors
                    if (lastDisconnect.error.message?.includes('network')) {
                        console.log('Network error detected, will retry');
                    }
                }
                
                // Clear credentials if needed
                if (clearCredentials) {
                    try {
                        const credsPath = path.join(SESSION_DIR, 'creds.json');
                        if (fs.existsSync(credsPath)) {
                            // Backup the creds file before deleting it
                            const backupDir = path.join(SESSION_DIR, 'backup');
                            if (!fs.existsSync(backupDir)) {
                                fs.mkdirSync(backupDir, { recursive: true });
                            }
                            
                            const timestamp = new Date().toISOString().replace(/:/g, '-');
                            const backupPath = path.join(backupDir, `creds-${timestamp}.json`);
                            fs.copyFileSync(credsPath, backupPath);
                            console.log(`Backed up credentials to ${backupPath}`);
                            
                            // Now delete the original
                            fs.unlinkSync(credsPath);
                            console.log('Credentials cleared successfully');
                        }
                    } catch (err) {
                        console.error('Error handling credentials:', err);
                    }
                }
                
                // Reconnect if needed
                if (shouldReconnect) {
                    reconnectAfterNetworkError();
                }
            } else if (connection === 'open') {
                console.log('🟢 WhatsApp connection established!');
                isConnected = true;
                reconnectAttempt = 0;
                
                try {
                    // Initialize message handler if not already initialized
                    if (!messageHandlerInitialized) {
                        await handler.init();
                        console.log('Ultra minimal message handler initialized');
                        messageHandlerInitialized = true;
                        
                        // Send a self-test message after a short delay
                        setTimeout(async () => {
                            try {
                                const selfJid = sock.user.id;
                                console.log(`Attempting to send test message to self: ${selfJid}`);
                                
                                // Check available commands
                                const commandList = Array.from(handler.commands.keys());
                                const commandCountMsg = `Available commands: ${commandList.length}`;
                                console.log(commandCountMsg);
                                console.log('Command list:', commandList.join(', '));
                                
                                // Send self-test message with command info
                                await sock.sendMessage(selfJid, { 
                                    text: `🧪 Bot Self-Test: The bot is online with ${commandList.length} commands loaded.\n\nAvailable commands: ${commandList.slice(0, 10).join(', ')}${commandList.length > 10 ? '...' : ''}` 
                                });
                                console.log('Self-test message sent successfully');
                            } catch (testErr) {
                                console.error('Failed to send self-test message:', testErr);
                            }
                        }, 5000);
                    }
                    
                    // Extra safety: wrap the event handler setup
                    try {
                        // Define a safer message processor function
                        const safeMessageProcessor = ({ messages, type }) => {
                            if (type === 'notify') {
                                // Process each message individually to prevent batch failures
                                if (!Array.isArray(messages)) {
                                    console.warn('Expected messages array but got:', typeof messages);
                                    return;
                                }
                                
                                // Process each message in isolation
                                for (const message of messages) {
                                    // Skip processing invalid messages or our own messages
                                    if (!message || !message.key) continue;
                                    if (message.key.fromMe) continue;
                                    
                                    // Update bot statistics
                                    botStats.messagesReceived++;
                                    
                                    // Get message content for stats
                                    const content = message.message?.conversation || 
                                                  message.message?.extendedTextMessage?.text || 
                                                  'Media or other content';
                                    
                                    // Save last message info (with privacy in mind)
                                    botStats.lastMessage = `${content.substring(0, 30)}${content.length > 30 ? '...' : ''} (from ${message.key.remoteJid})`;
                                    
                                    // Check if this is a command and update stats
                                    if (content && (content.startsWith('!') || content.startsWith('.'))) {
                                        botStats.commandsProcessed++;
                                        const command = content.slice(1).trim().split(' ')[0].toLowerCase();
                                        botStats.lastCommand = `!${command} (from ${message.key.remoteJid})`;
                                    }
                                    
                                    // Debug incoming messages
                                    console.log(`Received message:`, JSON.stringify({
                                        jid: message.key.remoteJid,
                                        fromMe: message.key.fromMe,
                                        id: message.key.id,
                                        content: content
                                    }, null, 2));
                                    
                                    // Process with maximum error protection
                                    setTimeout(() => {
                                        try {
                                            handler.messageHandler(sock, message)
                                                .then(() => console.log('Message handled successfully'))
                                                .catch(err => {
                                                    console.error('Async message handler error:', err);
                                                    // Try to notify the user about the error
                                                    try {
                                                        sock.sendMessage(message.key.remoteJid, { 
                                                            text: '❌ Something went wrong processing your request. Please try again.'
                                                        }).catch(() => {});
                                                    } catch (_) {
                                                        // Ignore nested errors
                                                    }
                                                });
                                        } catch (syncErr) {
                                            console.error('Sync message handler error:', syncErr);
                                            // Try to notify the user about the error
                                            try {
                                                sock.sendMessage(message.key.remoteJid, { 
                                                    text: '❌ Something went wrong processing your request. Please try again.'
                                                }).catch(() => {});
                                            } catch (_) {
                                                // Ignore nested errors
                                            }
                                        }
                                    }, 0);
                                }
                            }
                        };
                        
                        // First safely remove any existing handlers
                        try {
                            sock.ev.off('messages.upsert');
                        } catch (removeErr) {
                            console.warn('Could not remove existing handlers, continuing:', removeErr.message);
                        }
                        
                        // Now register our safe handler
                        sock.ev.on('messages.upsert', safeMessageProcessor);
                        console.log('Secure message event handler registered successfully');
                    } catch (handlerSetupErr) {
                        console.error('Failed to set up primary handler, trying fallback:', handlerSetupErr);
                        
                        // Emergency fallback - absolute minimal handler
                        try {
                            const emergencyHandler = (update) => {
                                try {
                                    if (update && update.messages && Array.isArray(update.messages)) {
                                        for (const msg of update.messages) {
                                            if (msg && msg.message && msg.key && !msg.key.fromMe) {
                                                const text = msg.message.conversation || 
                                                         msg.message.extendedTextMessage?.text;
                                                
                                                if (text === '!ping' && msg.key.remoteJid) {
                                                    sock.sendMessage(msg.key.remoteJid, { 
                                                        text: '🆘 Emergency Pong (Fallback Mode)' 
                                                    }).catch(() => {});
                                                }
                                            }
                                        }
                                    }
                                } catch (_) {
                                    // Silently continue on any errors
                                }
                            };
                            
                            sock.ev.on('messages.upsert', emergencyHandler);
                            console.log('Emergency fallback handler registered');
                        } catch (emergencyErr) {
                            console.error('CRITICAL: Even emergency handler failed:', emergencyErr);
                        }
                    }
                    
                    console.log('Message event handler registered successfully');
                } catch (err) {
                    console.error('Error setting up message handler:', err);
                }
            } else if (connection === 'connecting') {
                console.log('Connecting to WhatsApp...');
            }
            
            // Show QR code update if we have one
            if (qr) {
                console.log('New QR code received');
            }
        });
        
        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);
        
        // Handle group participants update
        sock.ev.on('group-participants.update', async (update) => {
            try {
                const { id, participants, action } = update;
                console.log(`Group update: ${action} in ${id}`);
                
                // We could implement group-specific logic here if needed
            } catch (err) {
                console.error('Error handling group update:', err);
            }
        });
        
        // Handle in-coming calls
        sock.ev.on('call', async (calls) => {
            for (const call of calls) {
                try {
                    console.log(`Received call from ${call.from}`);
                    // We could implement call handling logic here
                } catch (err) {
                    console.error('Error handling call:', err);
                }
            }
        });
        
        return sock;
    } catch (err) {
        console.error('Fatal error in WhatsApp connection:', err);
        // Try to reconnect after error
        setTimeout(() => {
            console.log('Retrying connection after fatal error...');
            connectToWhatsApp();
        }, 10000); // Longer delay after fatal error
    }
}

// Periodic health check function
async function performHealthCheck() {
    try {
        console.log('🔍 Performing periodic health check...');
        
        // Check memory usage
        const memoryUsage = process.memoryUsage();
        console.log('📊 Memory Usage:', {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
        });
        
        // Check handler status
        try {
            const handlerPath = './src/handlers/ultra-minimal-handler.js';
            const handler = require(handlerPath);
            console.log(`✅ Command handler loaded with ${handler.commands?.size || 0} commands`);
            
            // List a few random commands as a health check
            if (handler.commands?.size > 0) {
                const commandKeys = Array.from(handler.commands.keys());
                const sampleSize = Math.min(5, commandKeys.length);
                const randomSample = [];
                
                for (let i = 0; i < sampleSize; i++) {
                    const randomIndex = Math.floor(Math.random() * commandKeys.length);
                    randomSample.push(commandKeys[randomIndex]);
                    commandKeys.splice(randomIndex, 1);
                }
                
                console.log(`📋 Random command sample: ${randomSample.join(', ')}`);
            }
        } catch (handlerErr) {
            console.error('❌ Command handler check failed:', handlerErr);
        }
        
        // Check uptime
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        console.log(`⏱️ Bot uptime: ${hours}h ${minutes}m ${seconds}s`);
        
        // Schedule next health check
        setTimeout(performHealthCheck, 30 * 60 * 1000); // Run every 30 minutes
    } catch (err) {
        console.error('❌ Health check failed:', err);
        // Schedule another check even if this one failed
        setTimeout(performHealthCheck, 30 * 60 * 1000);
    }
}

// Start the bot
async function start() {
    try {
        console.log('🚀 Starting WhatsApp Bot...');
        
        // Start HTTP server
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ Server started on port ${PORT}`);
            
            // Initialize WhatsApp connection
            connectToWhatsApp();
            
            // Schedule first health check after 5 minutes
            setTimeout(performHealthCheck, 5 * 60 * 1000);
        });
        
        server.on('error', (err) => {
            console.error('❌ Server error:', err);
        });
    } catch (err) {
        console.error('❌ Failed to start application:', err);
    }
}

// Handle errors
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception - continuing if possible:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection - continuing if possible:', err);
});

// Start application
start();

module.exports = { start, connectToWhatsApp };