const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const { messageHandler } = require('./handlers/messageHandler');
const { commandLoader } = require('./utils/commandLoader');
const { handleGroupMessage } = require('./handlers/groupMessageHandler');
const { handleGroupParticipantsUpdate } = require('./handlers/groupParticipantHandler');
const { sessionManager } = require('./utils/sessionManager');

let sock = null;
let retryCount = 0;
const isProduction = process.env.NODE_ENV === 'production';
const isHeroku = !!process.env.DYNO;

const MAX_RETRIES = isProduction ? 999999 : 10;
const RETRY_INTERVAL_BASE = isProduction ? 5000 : 10000;
const MAX_RETRY_INTERVAL = isProduction ? 300000 : 60000;
const STREAM_ERROR_COOLDOWN = isProduction ? 30000 : 15000;
const RESTART_COOLDOWN = isProduction ? 60000 : 30000;
const MAX_STREAM_ATTEMPTS = isProduction ? 20 : 10;

const AUTH_DIR = path.join(process.cwd(), 'auth_info');

let isConnected = false;
let qrDisplayed = false;
let connectionAttempts = 0;
let streamRetryCount = 0;
let lastRestartTime = 0;
let lastLogTime = 0;

async function validateSession() {
    try {
        const credentialsPath = path.join(AUTH_DIR, 'creds.json');
        const exists = await fsPromises.access(credentialsPath)
            .then(() => true)
            .catch(() => false);

        if (!exists) {
            logger.info('No credentials found, new session will be created');
            return false;
        }

        const creds = JSON.parse(await fsPromises.readFile(credentialsPath, 'utf8'));
        return !!creds?.me?.id;
    } catch (err) {
        logger.error('Session validation error:', err);
        return false;
    }
}

async function cleanAuthState() {
    try {
        await fsPromises.rm(AUTH_DIR, { recursive: true, force: true });
        await fsPromises.mkdir(AUTH_DIR, { recursive: true, mode: 0o700 });
    } catch (err) {
        logger.error('Clean auth state error:', err);
    }
}

async function startConnection() {
    try {
        qrDisplayed = false;

        // Initialize command loader first (which also initializes fs)
        const commandsInitialized = await commandLoader.loadCommandHandlers();
        if (!commandsInitialized) {
            throw new Error('Failed to initialize commands');
        }

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
            keepAliveIntervalMs: 5000,
            retryRequestDelayMs: 500,
            emitOwnEvents: false,
            maxRetries: 15,
            markOnlineOnConnect: true,
            syncFullHistory: false
        });

        sock.ev.process(async (events) => {
            if (events['connection.update']) {
                const update = events['connection.update'];
                const { connection, lastDisconnect, qr } = update;

                if (qr && !qrDisplayed) {
                    qrDisplayed = true;

                    // Disable logging completely
                    const originalLogLevel = logger.level;
                    logger.level = 'silent';

                    // Clear console and show minimal output
                    process.stdout.write('\x1Bc');
                    console.log('\n=== WhatsApp QR Code ===\n');

                    qrcode.generate(qr, { small: true, margin: 0 }, (qrcode) => {
                        console.log(qrcode);
                        console.log('\nPlease scan this QR code with WhatsApp\n');
                    });

                    // Restore logging after QR display
                    setTimeout(() => {
                        logger.level = originalLogLevel;
                    }, 1000);
                }

                if (connection === 'open' && !isConnected) {
                    isConnected = true;
                    qrDisplayed = false;
                    retryCount = 0;
                    streamRetryCount = 0;
                    console.clear();
                    console.log('✅ Successfully connected to WhatsApp!\n');

                    try {
                        if (!global.connectionNotified) {
                            global.connectionNotified = true;
                            let ownerNumber = process.env.OWNER_NUMBER;
                            if (ownerNumber) {
                                try {
                                    if (!ownerNumber.includes('@s.whatsapp.net')) {
                                        ownerNumber = ownerNumber.replace(/[^\d]/g, '');
                                        if (!ownerNumber.startsWith('1') && !ownerNumber.startsWith('91')) {
                                            ownerNumber = '1' + ownerNumber;
                                        }
                                        ownerNumber = `${ownerNumber}@s.whatsapp.net`;
                                    }
                                    await sock.sendMessage(ownerNumber, { text: 'Bot is now connected!' });
                                } catch (notifyErr) {
                                    logger.error('Failed to send owner notification:', notifyErr.message);
                                }
                            }
                        }
                    } catch (err) {
                        logger.error('Failed to handle connection:', err.message);
                    }
                }

                if (connection === 'close') {
                    isConnected = false;
                    qrDisplayed = false;
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut &&
                        statusCode !== DisconnectReason.forbidden;

                    if (shouldReconnect && retryCount < MAX_RETRIES) {
                        retryCount++;
                        const delay = Math.min(
                            RETRY_INTERVAL_BASE * Math.pow(1.5, retryCount - 1),
                            MAX_RETRY_INTERVAL
                        );
                        setTimeout(startConnection, delay);
                    } else {
                        if (!shouldReconnect) {
                            await cleanAuthState();
                            startConnection();
                        } else {
                            console.log('\n❌ Maximum retry attempts reached. Please restart the bot.\n');
                            process.exit(1);
                        }
                    }
                }
            }

            if (events['creds.update']) {
                await saveCreds();
            }

            if (events['messages.upsert']) {
                const upsert = events['messages.upsert'];
                if (upsert.type === 'notify') {
                    for (const msg of upsert.messages) {
                        if (!msg.message) continue;

                        const remoteJid = msg.key.remoteJid || 'unknown';
                        const isGroup = remoteJid.endsWith('@g.us');

                        try {
                            if (isGroup) {
                                await handleGroupMessage(sock, msg);
                            }
                            await messageHandler(sock, msg);
                        } catch (err) {
                            logger.error('Message handling error:', err);
                            try {
                                await sock.sendMessage(msg.key.remoteJid, { 
                                    text: '❌ Sorry, there was an error processing your message. Please try again later.'
                                });
                            } catch (notifyErr) {
                                logger.error('Failed to send error notification:', notifyErr);
                            }
                        }
                    }
                }
            }

            if (events['group-participants.update']) {
                const update = events['group-participants.update'];
                try {
                    await handleGroupParticipantsUpdate(sock, update);
                } catch (err) {
                    logger.error('Group participants update error:', err);
                }
            }
        });

        return sock;
    } catch (err) {
        logger.error('Connection error:', err);
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = Math.min(
                RETRY_INTERVAL_BASE * Math.pow(1.5, retryCount - 1),
                MAX_RETRY_INTERVAL
            );
            setTimeout(startConnection, delay);
        } else {
            throw err;
        }
    }
}

module.exports = { startConnection };