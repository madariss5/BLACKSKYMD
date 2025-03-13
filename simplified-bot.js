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

// Basic HTTP route
app.get('/', (req, res) => {
    res.send('WhatsApp Bot Server is running');
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
                                    
                                    // Debug incoming messages
                                    console.log(`Received message:`, JSON.stringify({
                                        jid: message.key.remoteJid,
                                        fromMe: message.key.fromMe,
                                        id: message.key.id,
                                        content: message.message?.conversation || 
                                               message.message?.extendedTextMessage?.text || 
                                               'Media or other content'
                                    }, null, 2));
                                    
                                    // Process with maximum error protection
                                    setTimeout(() => {
                                        try {
                                            handler.messageHandler(sock, message)
                                                .catch(err => console.error('Async message handler error:', err));
                                        } catch (syncErr) {
                                            console.error('Sync message handler error:', syncErr);
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

// Start the bot
async function start() {
    try {
        console.log('Starting WhatsApp Bot...');
        
        // Start HTTP server
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server started on port ${PORT}`);
            
            // Initialize WhatsApp connection
            connectToWhatsApp();
        });
        
        server.on('error', (err) => {
            console.error('Server error:', err);
        });
    } catch (err) {
        console.error('Failed to start application:', err);
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