/**
 * Simple QR Web Server for WhatsApp Bot
 * Displays QR code in a user-friendly web interface
 */

const express = require('express');
const http = require('http');
const qrcode = require('qrcode');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

// Create Express app
const app = express();
const server = http.createServer(app);
const PORT = 5007; // Changed to port 5007 to avoid conflicts

// QR code state
let latestQR = null;
let connectionStatus = 'disconnected';
let sock = null;

// Auth directory
const AUTH_DIRECTORY = path.join(process.cwd(), 'auth_info');

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIRECTORY)) {
    fs.mkdirSync(AUTH_DIRECTORY, { recursive: true });
}

// Serve static HTML page with QR code
app.get('/', (req, res) => {
    // Create a simple HTML page to display the QR
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>WhatsApp Bot QR Code</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="30">
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f0f4f7;
                margin: 0;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                text-align: center;
            }
            .container {
                background-color: white;
                border-radius: 15px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                padding: 30px;
                max-width: 500px;
                width: 100%;
            }
            h1 {
                color: #128C7E;
                margin-bottom: 5px;
            }
            h2 {
                color: #075E54;
                font-size: 1.2em;
                margin-top: 0;
            }
            .qr-container {
                background-color: white;
                padding: 20px;
                border-radius: 10px;
                margin: 20px auto;
                display: inline-block;
            }
            .status {
                font-weight: bold;
                padding: 10px;
                border-radius: 5px;
                margin: 15px 0;
            }
            .disconnected { background-color: #ffcccc; color: #d32f2f; }
            .connecting { background-color: #fff8e1; color: #ff8f00; }
            .connected { background-color: #e8f5e9; color: #2e7d32; }
            .refresh-button {
                background-color: #128C7E;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1em;
                margin-top: 10px;
            }
            .instructions {
                font-size: 0.9em;
                color: #666;
                margin-top: 20px;
                line-height: 1.5;
                text-align: left;
            }
            .instructions ol {
                margin-top: 10px;
                padding-left: 25px;
            }
            img {
                max-width: 100%;
                height: auto;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>BLACKSKY-MD</h1>
            <h2>WhatsApp QR Code Connection</h2>

            <div class="status ${connectionStatus}">
                Status: ${connectionStatus === 'connected' 
                        ? 'Connected ✓' 
                        : connectionStatus === 'connecting' 
                            ? 'Connecting...' 
                            : 'Waiting for QR Code...'}
            </div>

            <div class="qr-container">
                ${latestQR 
                    ? `<img src="${latestQR}" alt="WhatsApp QR Code" width="300" height="300">`
                    : `<p>Generating QR code... Please wait.</p><p>If no QR appears after 15 seconds, click refresh.</p>`
                }
            </div>

            <button class="refresh-button" onclick="location.reload()">Refresh</button>

            <div class="instructions">
                <strong>Instructions:</strong>
                <ol>
                    <li>Open WhatsApp on your phone</li>
                    <li>Tap Menu ⋮ or Settings ⚙ and select "Linked Devices"</li>
                    <li>Tap on "Link a Device"</li>
                    <li>Point your phone camera at this QR code to scan</li>
                </ol>
                <p><strong>Note:</strong> Page refreshes automatically every 30 seconds.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    res.send(html);
});

// Generate and display QR code
async function displayQR(qr) {
    try {
        // Generate QR code as data URL
        latestQR = await qrcode.toDataURL(qr);
        connectionStatus = 'connecting';
        console.log(`\nQR Code ready! Visit http://localhost:${PORT} to scan\n`);
    } catch (err) {
        console.error('Failed to generate QR code:', err);
    }
}

// Start WhatsApp connection
async function startConnection() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIRECTORY);

        // Create WhatsApp socket connection
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: ['WhatsApp Bot', 'Chrome', '100.0.0'],
            logger: pino({ level: 'silent' }),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000
        });

        // Handle connection events
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                await displayQR(qr);
            }

            if (connection === 'open') {
                connectionStatus = 'connected';
                latestQR = null; // Clear QR code once connected
                await saveCreds();
                console.log('\nConnection established successfully!\n');
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                connectionStatus = 'disconnected';
                console.log(`\nConnection closed due to ${lastDisconnect?.error?.message}\n`);

                if (shouldReconnect) {
                    console.log('Reconnecting...');
                    setTimeout(startConnection, 5000);
                } else {
                    console.log('Not reconnecting - user logged out');
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (err) {
        console.error('Error starting connection:', err);
        connectionStatus = 'disconnected';
        setTimeout(startConnection, 5000);
    }
}

// Start the server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\nQR Web Server running at http://localhost:${PORT}\n`);
    console.log('Use this URL to access the WhatsApp QR code scanning interface\n');
    startConnection();
});

module.exports = {
    displayQR,
    updateConnectionStatus: (status) => {
        connectionStatus = status;
    }
};