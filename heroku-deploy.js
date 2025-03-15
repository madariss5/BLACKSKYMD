/**
 * Heroku Deployment Script for BLACKSKY-MD
 * This version is optimized for Heroku environments where filesystem changes aren't persistent
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, isJidBroadcast } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const express = require('express');
const qrcode = require('qrcode');
const http = require('http');
const app = express();
const server = http.createServer(app);

// Constants
const PORT = process.env.PORT || 5000;
const AUTH_DIR = './auth_info_baileys';
const SESSION_PATH = './baileys_store.json';
let messageHandler = null;

// Session state
let sock = null;
let qrCodeDataURL = null;
let connectionStatus = 'disconnected';
let startTime = Date.now();
let sessionData = null;

// Add reconnection control
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_INTERVAL = 5000;

// Try to load message handler
try {
    const { messageHandler: handler } = require('./src/handlers/messageHandler');
    messageHandler = handler;
} catch (err) {
    console.log('Warning: Message handler not loaded yet');
}


/**
 * Initialize WhatsApp connection with improved error handling
 */
async function connectToWhatsApp() {
    try {
        // Ensure auth directory exists
        if (!fs.existsSync(AUTH_DIR)) {
            fs.mkdirSync(AUTH_DIR, { recursive: true });
        }

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

        // Create WhatsApp socket with optimized settings for Heroku
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: ['BLACKSKY-MD', 'Chrome', '116.0.0'],
            logger: pino({ level: 'error' }),
            markOnlineOnConnect: false,
            connectTimeoutMs: 60000,
            qrTimeout: 40000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            emitOwnEvents: false,
            version: [2, 2323, 4],
            getMessage: async () => {
                return { conversation: 'hello' };
            }
        });

        // Handle connection events
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            console.log('Connection update:', update);

            if (qr) {
                qrCodeDataURL = await qrcode.toDataURL(qr);
                console.log('New QR code generated');
                reconnectAttempts = 0;
            }

            if (connection) {
                connectionStatus = connection;
                console.log('Connection status:', connection);
            }

            if (connection === 'open') {
                console.log('Connection established successfully');
                reconnectAttempts = 0;

                // Save credentials
                try {
                    await saveCreds();
                    console.log('Credentials saved successfully');
                } catch (err) {
                    console.error('Error saving credentials:', err);
                }

                // Initialize message handler
                if (messageHandler) {
                    sock.ev.on('messages.upsert', async ({ messages, type }) => {
                        if (type === 'notify') {
                            for (const message of messages) {
                                try {
                                    await messageHandler(sock, message);
                                } catch (err) {
                                    console.error('Error handling message:', err);
                                }
                            }
                        }
                    });
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`Connection closed with status code: ${statusCode}`);

                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('Not reconnecting - logged out');
                    // Clear auth files on logout
                    try {
                        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                        console.log('Auth directory cleared');
                    } catch (err) {
                        console.error('Error clearing auth directory:', err);
                    }
                } else if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 300000);
                    console.log(`Attempting to reconnect in ${delay/1000} seconds... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                    setTimeout(connectToWhatsApp, delay);
                } else {
                    console.log('Maximum reconnection attempts reached');
                }
            }
        });

        // Handle credential updates
        sock.ev.on('creds.update', async () => {
            try {
                await saveCreds();
                console.log('Credentials updated successfully');
            } catch (err) {
                console.error('Error updating credentials:', err);
            }
        });

        return sock;
    } catch (error) {
        console.error('Connection error:', error);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 300000);
            console.log(`Retrying connection in ${delay/1000} seconds...`);
            setTimeout(connectToWhatsApp, delay);
        }
    }
}

/**
 * Get formatted uptime string
 */
function getUptime() {
    const uptime = Date.now() - startTime;
    const seconds = Math.floor(uptime / 1000) % 60;
    const minutes = Math.floor(uptime / (1000 * 60)) % 60;
    const hours = Math.floor(uptime / (1000 * 60 * 60)) % 24;
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));

    let uptimeString = '';
    if (days > 0) uptimeString += `${days}d `;
    if (hours > 0) uptimeString += `${hours}h `;
    if (minutes > 0) uptimeString += `${minutes}m `;
    uptimeString += `${seconds}s`;

    return uptimeString;
}

// Set up Express endpoints
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>BLACKSKY WhatsApp Bot - Heroku</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                    line-height: 1.6;
                }
                .status {
                    display: inline-block;
                    padding: 5px 10px;
                    border-radius: 4px;
                    font-weight: bold;
                }
                .connecting { background: #FFF3CD; color: #856404; }
                .connected { background: #D4EDDA; color: #155724; }
                .disconnected { background: #F8D7DA; color: #721C24; }
            </style>
        </head>
        <body>
            <h1>BLACKSKY WhatsApp Bot</h1>
            <div>
                <p><strong>Status:</strong> <span class="status ${connectionStatus}">${connectionStatus.toUpperCase()}</span></p>
                <p><strong>Uptime:</strong> ${getUptime()}</p>
                ${qrCodeDataURL 
                    ? `<p>Scan this QR code with WhatsApp:</p><img src="${qrCodeDataURL}" alt="WhatsApp QR Code" />`
                    : connectionStatus === 'connected' 
                        ? '<p>Bot is connected to WhatsApp</p>'
                        : '<p>Waiting for connection...</p>'
                }
            </div>
        </body>
        </html>
    `);
});

// Start the server and bot
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    connectToWhatsApp();
});