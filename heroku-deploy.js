/**
 * Heroku Deployment Script for BLACKSKY-MD
 * This version is optimized for Heroku environments where filesystem changes aren't persistent
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
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
const AUTH_DIR = process.env.AUTH_DIR || './auth_info_baileys';
let sock = null;
let qrCodeDataURL = null;
let connectionStatus = 'disconnected';
let startTime = Date.now();

// Enhanced reconnection control
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10; // Increased from 5
const BASE_RECONNECT_INTERVAL = 5000;
const MAX_RECONNECT_INTERVAL = 300000; // 5 minutes

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

        // Create WhatsApp socket with optimized settings
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: ['BLACKSKY-MD', 'Chrome', '1.0.0'],
            logger: pino({ 
                level: 'warn',
                transport: {
                    target: 'pino-pretty',
                    options: {
                        colorize: true
                    }
                }
            }),
            markOnlineOnConnect: false,
            connectTimeoutMs: 60000,
            qrTimeout: 40000,
            defaultQueryTimeoutMs: 30000,
            keepAliveIntervalMs: 15000,
            emitOwnEvents: true,
            syncFullHistory: false,
            retryRequestDelayMs: 2000,
            version: [2, 2323, 4],
            // Added browser configurations to help prevent 405 errors
            browserDescription: ["BLACKSKY-MD", "Chrome", "1.0.0"],
            connectCooldownMs: 4000,
            linkPreviewImageThumbnailWidth: 192
        });

        // Handle connection events
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            console.log('Connection update:', JSON.stringify(update, null, 2));

            if (qr) {
                qrCodeDataURL = await qrcode.toDataURL(qr);
                console.log('New QR code generated');
                reconnectAttempts = 0; // Reset attempts on new QR
            }

            if (connection) {
                connectionStatus = connection;
                console.log('Connection status:', connection);
            }

            if (connection === 'open') {
                console.log('Connection established successfully');
                reconnectAttempts = 0;
                try {
                    await saveCreds();
                    console.log('Credentials saved successfully');
                } catch (err) {
                    console.error('Error saving credentials:', err);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`Connection closed with status code: ${statusCode}`);

                // Handle specific error codes
                if (statusCode === 405) {
                    console.log('Authentication failure (405) - clearing auth and retrying');
                    try {
                        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                        reconnectAttempts = 0; // Reset attempts for fresh auth
                    } catch (err) {
                        console.error('Error clearing auth directory:', err);
                    }
                }

                if (statusCode === DisconnectReason.loggedOut || 
                    statusCode === DisconnectReason.connectionClosed ||
                    statusCode === DisconnectReason.connectionLost ||
                    statusCode === 405) {

                    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                        reconnectAttempts++;
                        // Exponential backoff with jitter
                        const delay = Math.min(
                            BASE_RECONNECT_INTERVAL * Math.pow(1.5, reconnectAttempts - 1) * (1 + Math.random() * 0.1),
                            MAX_RECONNECT_INTERVAL
                        );
                        console.log(`Attempting to reconnect in ${Math.floor(delay/1000)} seconds... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                        setTimeout(connectToWhatsApp, delay);
                    } else {
                        console.log('Maximum reconnection attempts reached - restarting process');
                        process.exit(1); // Let the process manager restart
                    }
                }
            }
        });

        // Enhanced error handling for creds updates
        sock.ev.on('creds.update', async () => {
            try {
                await saveCreds();
                console.log('Credentials updated successfully');
            } catch (err) {
                console.error('Failed to save credentials:', err);
            }
        });

        return sock;
    } catch (error) {
        console.error('Connection error:', error);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = Math.min(
                BASE_RECONNECT_INTERVAL * Math.pow(1.5, reconnectAttempts - 1),
                MAX_RECONNECT_INTERVAL
            );
            console.log(`Retrying connection in ${Math.floor(delay/1000)} seconds...`);
            setTimeout(connectToWhatsApp, delay);
        } else {
            console.log('Maximum reconnection attempts reached - restarting process');
            process.exit(1);
        }
    }
}

// Create status page
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>BLACKSKY WhatsApp Bot - Heroku</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="refresh" content="30">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                    line-height: 1.6;
                    background: #f5f5f5;
                }
                .container {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
                img {
                    max-width: 100%;
                    height: auto;
                }
            </style>
        </head>
        <body>
            <div class="container">
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
            </div>
        </body>
        </html>
    `);
});

// Get formatted uptime string
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

// Start the server and bot
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    connectToWhatsApp();
});