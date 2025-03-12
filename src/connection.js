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
        process.exit(1);
    }
}

async function displayQR(qr) {
    try {
        // Clear terminal completely
        process.stdout.write('\x1Bc');

        // Generate QR code silently
        qrcode.generate(qr, { small: false });
    } catch (err) {
        process.exit(1);
    }
}

async function startConnection() {
    try {
        // Clear terminal
        process.stdout.write('\x1Bc');

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
                process.stdout.write('\x1Bc');
                await saveCreds();
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