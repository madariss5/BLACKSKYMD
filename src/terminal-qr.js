/**
 * Terminal-Only QR Code Generator with Web Status
 * Enhanced version with web monitoring and detailed logging
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Initialize Express
const app = express();
const port = 5000;

// Constants
const AUTH_DIR = './auth_info_terminal';
let isConnecting = false;
let retryCount = 0;
let connectionStatus = 'idle';
let lastError = null;
let currentQR = null;

// Browser rotation options
const browserOptions = [
    ['Firefox', '115.0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0'],
    ['Chrome', '120.0.0.0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'],
    ['Safari', '17.0', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15']
];

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Setup Express routes
app.get('/', (req, res) => {
    res.json({
        status: connectionStatus,
        lastError: lastError,
        retryCount,
        hasQR: !!currentQR
    });
});

app.get('/status', (req, res) => {
    res.json({
        status: connectionStatus,
        lastError: lastError,
        retryAttempt: retryCount + 1,
        maxRetries: 3
    });
});

// Start Express server
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`\n[Server] Status monitor running on port ${port}`);
    console.log(`[Server] View connection status at http://localhost:${port}\n`);
});

async function connectToWhatsApp() {
    if (isConnecting) {
        console.log('[Connection] Attempt already in progress...');
        return;
    }

    try {
        isConnecting = true;
        connectionStatus = 'connecting';

        // Clear existing auth state for a fresh start
        if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            fs.mkdirSync(AUTH_DIR, { recursive: true });
        }

        console.log('\n▶️ Starting WhatsApp Terminal QR connection...\n');
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

        // Select browser option
        const browserOption = browserOptions[retryCount % browserOptions.length];
        console.log(`🌐 Using ${browserOption[0]} browser fingerprint (attempt ${retryCount + 1})`);

        // Generate device ID
        const deviceId = `BLACKSKY-TERMINAL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        // Create connection
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: [deviceId, browserOption[0], browserOption[1]],
            version: [2, 2323, 4],
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            retryRequestDelayMs: 2000,
            emitOwnEvents: false,
            logger: require('pino')({ level: 'debug' }),
            syncFullHistory: false,
            userAgent: browserOption[2]
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('\n📱 Please scan this QR code with your WhatsApp app:\n');
                currentQR = qr;
                connectionStatus = 'awaiting_scan';
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'open') {
                console.log('\n✅ Successfully connected to WhatsApp!\n');
                console.log('✅ Auth credentials saved to:', AUTH_DIR);
                console.log('✅ You can now run the main bot application\n');
                connectionStatus = 'connected';
                currentQR = null;
                await saveCreds();

                console.log('\nPress Ctrl+C to exit this process and start the main bot.\n');
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                const errorMessage = lastDisconnect?.error?.message || 'unknown reason';
                console.log(`\n❌ Connection closed due to ${errorMessage}`);
                lastError = `${errorMessage} (Code: ${statusCode})`;
                connectionStatus = 'disconnected';

                if (shouldReconnect && retryCount < 3) {
                    retryCount++;
                    const delay = 5000 * retryCount;
                    console.log(`⏱️ Retrying in ${delay/1000} seconds... (Attempt ${retryCount}/3)`);
                    setTimeout(connectToWhatsApp, delay);
                } else {
                    if (statusCode === DisconnectReason.loggedOut) {
                        connectionStatus = 'logged_out';
                        console.log('❌ Logged out from WhatsApp. Please try again with a fresh QR code.');
                    } else {
                        connectionStatus = 'failed';
                        console.log('❌ Connection failed after multiple attempts.');
                    }
                    console.log('\nPress Ctrl+C to exit and try again.');
                }
            }
        });

        // Save credentials on update
        sock.ev.on('creds.update', saveCreds);

    } catch (err) {
        console.error('❌ Error in connection:', err);
        lastError = err.message;
        connectionStatus = 'error';

        if (retryCount < 3) {
            retryCount++;
            const delay = 5000 * retryCount;
            console.log(`⏱️ Retrying in ${delay/1000} seconds... (Attempt ${retryCount}/3)`);
            setTimeout(connectToWhatsApp, delay);
        } else {
            console.log('❌ Maximum retry attempts reached. Please try again later.');
            console.log('\nPress Ctrl+C to exit and try again.');
        }
    } finally {
        isConnecting = false;
    }
}

// Start connection process
connectToWhatsApp();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});