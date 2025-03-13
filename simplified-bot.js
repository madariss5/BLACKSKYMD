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
        
        // Create socket connection
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true
        });
        
        // Track connection state
        let isConnected = false;
        let reconnectAttempt = 0;
        
        // Connection update handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'close') {
                console.log('Connection closed, attempting to reconnect...');
                if (lastDisconnect?.error instanceof Boom) {
                    const statusCode = lastDisconnect.error.output.statusCode;
                    console.log('Reconnecting due to status code:', statusCode);
                    
                    // Check if we need to clear credentials
                    if (statusCode === 440 || statusCode === 401) {
                        console.log('Clearing invalid credentials...');
                        try {
                            if (fs.existsSync(path.join(SESSION_DIR, 'creds.json'))) {
                                fs.unlinkSync(path.join(SESSION_DIR, 'creds.json'));
                                console.log('Credentials cleared successfully');
                            }
                        } catch (err) {
                            console.error('Error clearing credentials:', err);
                        }
                    }
                    
                    // Reconnect
                    setTimeout(() => {
                        console.log('Attempting reconnection...');
                        connectToWhatsApp();
                    }, 5000);
                }
            } else if (connection === 'open') {
                console.log('WhatsApp connection established!');
                isConnected = true;
                reconnectAttempt = 0;
                
                // Initialize message handler
                await handler.init();
                console.log('Message handler initialized');
                
                // Set up message event handler
                sock.ev.on('messages.upsert', async ({ messages, type }) => {
                    if (type === 'notify') {
                        for (const message of messages) {
                            // Skip our own messages
                            if (message.key.fromMe) continue;
                            
                            try {
                                await handler.messageHandler(sock, message);
                            } catch (err) {
                                console.error('Error handling message:', err);
                            }
                        }
                    }
                });
            }
        });
        
        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);
        
        return sock;
    } catch (err) {
        console.error('Error in WhatsApp connection:', err);
        setTimeout(() => {
            console.log('Retrying connection in 5 seconds...');
            connectToWhatsApp();
        }, 5000);
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