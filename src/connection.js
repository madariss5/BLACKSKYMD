const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const pino = require('pino');
const logger = require('./utils/logger');
const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);

let sock = null;
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_INTERVAL = 5000;
const RECONNECT_INTERVAL = 3000;
let latestQR = null;
let qrPort = 5006; // Start with a high port number

// Set up Express server for QR code display
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>WhatsApp QR Code</title>
                <style>
                    body { 
                        display: flex; 
                        flex-direction: column;
                        align-items: center; 
                        justify-content: center; 
                        height: 100vh; 
                        margin: 0;
                        font-family: Arial, sans-serif;
                        background: #f0f2f5;
                    }
                    #qrcode {
                        padding: 20px;
                        background: white;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    h2 {
                        color: #333;
                        margin-bottom: 20px;
                    }
                    .status {
                        margin-top: 20px;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <h2>Scan QR Code with WhatsApp</h2>
                <div id="qrcode">
                    ${latestQR ? `<img src="${latestQR}" alt="QR Code"/>` : 'Waiting for QR Code...'}
                </div>
                <p class="status">Please scan the QR code with WhatsApp to connect</p>
                <script>
                    // Auto-refresh the page every 5 seconds if no QR code is present
                    if (!document.querySelector('#qrcode img')) {
                        setTimeout(() => location.reload(), 5000);
                    }
                </script>
            </body>
        </html>
    `);
});

async function ensureAuthDir() {
    try {
        const authDir = path.join(process.cwd(), 'auth_info');
        if (!fs.existsSync(authDir)) {
            await fsPromises.mkdir(authDir, { recursive: true });
        }
        return authDir;
    } catch (err) {
        process.exit(1);
    }
}

async function displayQR(qr) {
    try {
        // Generate QR code as data URL
        latestQR = await qrcode.toDataURL(qr);
        console.log(`\nQR Code ready! Visit http://localhost:${qrPort} to scan\n`);
    } catch (err) {
        console.error('Failed to generate QR code:', err);
        process.exit(1);
    }
}

async function startConnection() {
    try {
        // Start Express server
        server.listen(qrPort, '0.0.0.0', () => {
            console.log(`\nQR Code server running at http://localhost:${qrPort}\n`);
        });

        const authDir = await ensureAuthDir();
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: ['WhatsApp Bot', 'Firefox', '2.0.0'],
            logger: pino({ level: 'silent' }),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            emitOwnEvents: true,
            retryRequestDelayMs: 2000,
            version: [2, 2323, 4],
            patchMessageBeforeSending: false,
            getMessage: async () => {
                return { conversation: 'hello' };
            },
            markOnlineOnConnect: false,
            syncFullHistory: false,
            userDevicesCache: false,
            transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
            ws: {
                connectTimeoutMs: 30000,
                keepAliveIntervalMs: 25000,
                retryOnServerClose: true,
                retryOnTimeout: true,
                retryCount: 5
            }
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if(qr) {
                await displayQR(qr);
            }

            if (connection === 'open') {
                retryCount = 0;
                latestQR = null; // Clear QR code once connected
                await saveCreds();
                logger.restoreLogging();
                console.log('\nConnection established successfully!\n');
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect && retryCount < MAX_RETRIES) {
                    retryCount++;
                    const delay = RETRY_INTERVAL * Math.pow(2, retryCount - 1);
                    setTimeout(async () => {
                        try {
                            await startConnection();
                        } catch (err) {
                            process.exit(1);
                        }
                    }, delay);
                } else {
                    process.exit(1);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        return sock;
    } catch (err) {
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = RETRY_INTERVAL * Math.pow(2, retryCount - 1);
            setTimeout(async () => {
                try {
                    await startConnection();
                } catch (err) {
                    process.exit(1);
                }
            }, delay);
        } else {
            process.exit(1);
        }
    }
}

module.exports = { startConnection };