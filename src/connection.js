const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const path = require('path');
const fs = require('fs').promises;
const { messageHandler } = require('./handlers/messageHandler');
const { commandLoader } = require('./utils/commandLoader');

let sock = null;
let retryCount = 0;
const MAX_RETRIES = 10;
const RETRY_INTERVAL = 10000;
const AUTH_DIR = path.join(process.cwd(), 'auth_info');
let isConnected = false;
let qrDisplayed = false;

async function validateSession() {
    try {
        const credentialsPath = path.join(AUTH_DIR, 'creds.json');
        const exists = await fs.access(credentialsPath)
            .then(() => true)
            .catch(() => false);

        if (!exists) return false;

        const creds = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
        return !!creds?.me?.id;
    } catch (err) {
        logger.error('Session validation error:', err);
        return false;
    }
}

async function cleanAuthState() {
    try {
        await fs.rm(AUTH_DIR, { recursive: true, force: true });
        await fs.mkdir(AUTH_DIR, { recursive: true, mode: 0o700 });
    } catch (err) {
        logger.error('Clean auth state error:', err);
    }
}

async function sendCredsFile(sock, ownerNumber) {
    try {
        const credsPath = path.join(AUTH_DIR, 'creds.json');
        const credsExists = await fs.access(credsPath).then(() => true).catch(() => false);

        if (credsExists) {
            await sock.sendMessage(ownerNumber, {
                document: { url: credsPath },
                fileName: 'creds.json',
                mimetype: 'application/json',
                caption: 'Backup of credentials file'
            });
            logger.info('Credentials file sent successfully');
        }
    } catch (err) {
        logger.error('Failed to send creds file:', err.message);
    }
}

async function startConnection() {
    try {
        await commandLoader.loadCommandHandlers();
        await fs.mkdir(AUTH_DIR, { recursive: true, mode: 0o700 });

        const { version } = await fetchLatestBaileysVersion();
        const isValidSession = await validateSession();

        if (!isValidSession && retryCount > 0) {
            await cleanAuthState();
        }

        let state, saveCreds;
        try {
            const auth = await useMultiFileAuthState(AUTH_DIR);
            state = auth.state;
            saveCreds = auth.saveCreds;
        } catch (authErr) {
            logger.error('Auth state error:', authErr);
            await cleanAuthState();
            const auth = await useMultiFileAuthState(AUTH_DIR);
            state = auth.state;
            saveCreds = auth.saveCreds;
        }

        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: logger,
            browser: ['WhatsApp-MD', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            qrTimeout: 40000,
            defaultQueryTimeoutMs: 20000,
            keepAliveIntervalMs: 30000, // Increased keep-alive interval
            retryRequestDelayMs: 3000,
            emitOwnEvents: true,
            maxRetries: 5,
            markOnlineOnConnect: true,
            fireInitQueries: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            msgRetryCounterCache: {
                max: 1000,
                ttl: 60000
            },
            patchMessageBeforeSending: (message) => {
                return message;
            },
            // Added connection recovery options
            options: {
                timeout: 30000,
                noAckTimeout: 60000,
                retryOnNetworkError: true,
                retryOnStreamError: true,
                maxRetryAttempts: 5
            }
        });

        // Handle connection events using process
        sock.ev.process(async (events) => {
            // Handle connection updates
            if (events['connection.update']) {
                const update = events['connection.update'];
                const { connection, lastDisconnect, qr } = update;

                if (qr && !qrDisplayed) {
                    qrDisplayed = true;
                    process.stdout.write('\x1Bc');
                    qrcode.generate(qr, {
                        small: true,
                        scale: 1
                    }, (qrcode) => {
                        console.log(qrcode);
                    });
                    console.log('📱 Scan the QR code above with WhatsApp to start the bot');
                    console.log('⏳ QR code will refresh in 60 seconds if not scanned\n');
                }

                if (connection === 'open' && !isConnected) {
                    isConnected = true;
                    qrDisplayed = false;
                    retryCount = 0;
                    process.stdout.write('\x1Bc');
                    console.log('✅ Successfully connected to WhatsApp!\n');

                    try {
                        let ownerNumber = process.env.OWNER_NUMBER;
                        if (!ownerNumber) {
                            logger.warn('OWNER_NUMBER environment variable is not set');
                            return;
                        }

                        if (!ownerNumber.includes('@s.whatsapp.net')) {
                            ownerNumber = ownerNumber.replace(/[^\d]/g, '');
                            if (!ownerNumber.startsWith('1') && !ownerNumber.startsWith('91')) {
                                ownerNumber = '1' + ownerNumber;
                            }
                            ownerNumber = `${ownerNumber}@s.whatsapp.net`;
                        }

                        await sock.sendMessage(ownerNumber, { text: 'Bot is now connected!' });
                        logger.info('Connection notification sent successfully');
                        await sendCredsFile(sock, ownerNumber);
                    } catch (err) {
                        logger.error('Failed to send connection notification:', err.message);
                    }
                }

                if (connection === 'close') {
                    isConnected = false;
                    qrDisplayed = false;
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut &&
                        statusCode !== DisconnectReason.forbidden;

                    // Log detailed disconnect information
                    logger.info(`Connection closed. Status code: ${statusCode}`);
                    logger.info(`Last disconnect reason: ${JSON.stringify(lastDisconnect?.error || {})}`);

                    if (shouldReconnect && retryCount < MAX_RETRIES) {
                        retryCount++;
                        const delay = Math.min(RETRY_INTERVAL * Math.pow(1.5, retryCount - 1), 300000);

                        if (statusCode === DisconnectReason.connectionClosed) {
                            const isValid = await validateSession();
                            if (!isValid) {
                                await cleanAuthState();
                                console.log('\n❌ Session invalid. A new QR code will be generated.\n');
                            }
                        }

                        logger.info(`🔄 Reconnecting in ${Math.floor(delay / 1000)} seconds...`);
                        setTimeout(startConnection, delay);
                    } else {
                        if (!shouldReconnect) {
                            console.log('\n❌ Session expired. A new QR code will be generated.\n');
                            await cleanAuthState();
                            startConnection();
                        } else {
                            console.log('\n❌ Maximum retry attempts reached. Please restart the bot.\n');
                            process.exit(1);
                        }
                    }
                }
            }

            // Handle credential updates
            if (events['creds.update']) {
                await saveCreds();
            }

            // Handle messages with improved error handling
            if (events['messages.upsert']) {
                const upsert = events['messages.upsert'];
                if (upsert.type === 'notify') {
                    for (const msg of upsert.messages) {
                        if (!msg.message) continue;
                        try {
                            await messageHandler(sock, msg);
                        } catch (err) {
                            logger.error('Message handling error:', err);
                        }
                    }
                }
            }
        });

        // Cleanup function with improved error handling
        const cleanup = async (signal) => {
            if (sock) {
                try {
                    logger.info(`Received ${signal}, cleaning up...`);
                    await sock.logout();
                    await sock.end();
                    await cleanAuthState();
                    logger.info('Cleanup completed');
                } catch (err) {
                    logger.error('Cleanup error:', err);
                }
            }
            process.exit(0);
        };

        // Handle process termination
        process.on('SIGTERM', () => cleanup('SIGTERM'));
        process.on('SIGINT', () => cleanup('SIGINT'));

        return sock;
    } catch (err) {
        logger.error('Connection error:', err);
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = Math.min(RETRY_INTERVAL * Math.pow(1.5, retryCount - 1), 300000);
            setTimeout(startConnection, delay);
        } else {
            throw err;
        }
    }
}

module.exports = { startConnection };