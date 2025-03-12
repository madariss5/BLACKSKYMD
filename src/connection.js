const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const pino = require('pino');
const logger = require('./utils/logger');

let sock = null;
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_INTERVAL = 5000; // 5 seconds
const RECONNECT_INTERVAL = 3000; // 3 seconds

async function ensureAuthDir() {
    const authDir = path.join(process.cwd(), 'auth_info');
    try {
        if (!fs.existsSync(authDir)) {
            await fsPromises.mkdir(authDir, { recursive: true });
        }
        return authDir;
    } catch (err) {
        logger.error('Error creating auth directory:', err);
        throw err;
    }
}

async function displayQR(qr) {
    try {
        // Clear console and add spacing
        console.clear();
        console.log('\n');
        console.log('Please scan this QR code with WhatsApp:');
        console.log('\n');

        // Generate QR with custom size
        qrcode.generate(qr, { small: false });

        console.log('\nWaiting for you to scan the QR code...');
    } catch (err) {
        logger.error('Error displaying QR code:', err);
        process.exit(1);
    }
}

async function startConnection() {
    try {
        console.clear();
        const authDir = await ensureAuthDir();
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false, // Disable native QR printing
            browser: ['WhatsApp Bot', 'Firefox', '2.0.0'],
            logger: pino({ level: 'silent' }), // Minimize logging
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

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if(qr) {
                await displayQR(qr);
            }

            if (connection === 'open') {
                retryCount = 0;
                console.clear();
                console.log('✅ Connected to WhatsApp!\n');

                try {
                    await saveCreds();
                } catch (err) {
                    logger.error('Error saving session credentials:', err);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect && retryCount < MAX_RETRIES) {
                    retryCount++;
                    const delay = RETRY_INTERVAL * Math.pow(2, retryCount - 1);
                    console.log(`\nReconnecting... Attempt ${retryCount}/${MAX_RETRIES}`);

                    setTimeout(async () => {
                        try {
                            await startConnection();
                        } catch (err) {
                            logger.error('Error during reconnection:', err);
                        }
                    }, delay);
                } else if (retryCount >= MAX_RETRIES) {
                    console.log('\n❌ Max retry attempts reached. Please restart the bot manually.');
                    process.exit(1);
                } else {
                    console.log('\n❌ Connection closed permanently. User logged out.');
                    try {
                        if (fs.existsSync(authDir)) {
                            await fsPromises.rm(authDir, { recursive: true, force: true });
                        }
                    } catch (err) {
                        logger.error('Error cleaning up auth state:', err);
                    }
                    process.exit(1);
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

        // Handle messages
        sock.ev.on('messages.upsert', async (m) => {
            logger.debug('New message received:', m.type);
        });

        // Handle errors
        process.on('unhandledRejection', (err) => {
            logger.error('Unhandled promise rejection:', err);
        });

        return sock;
    } catch (err) {
        logger.error('Connection error:', err);
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = RETRY_INTERVAL * Math.pow(2, retryCount - 1);
            setTimeout(async () => {
                try {
                    await startConnection();
                } catch (err) {
                    logger.error('Error during retry:', err);
                }
            }, delay);
        } else {
            throw err;
        }
    }
}

module.exports = { startConnection };