const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const { messageHandler } = require('./handlers/messageHandler');
const { commandLoader } = require('./utils/commandLoader');
const { handleGroupMessage } = require('./handlers/groupMessageHandler');
const { handleGroupParticipantsUpdate } = require('./handlers/groupParticipantHandler');

let sock = null;
let retryCount = 0;
const isProduction = process.env.NODE_ENV === 'production';
const MAX_RETRIES = isProduction ? 999999 : 10;
const RETRY_INTERVAL_BASE = isProduction ? 5000 : 10000;
const MAX_RETRY_INTERVAL = isProduction ? 300000 : 60000;

let isConnected = false;
let qrDisplayed = false;

async function validateSession() {
    try {
        const credentialsPath = path.join(process.cwd(), 'auth_info/creds.json');
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
        const authDir = path.join(process.cwd(), 'auth_info');
        await fsPromises.rm(authDir, { recursive: true, force: true });
        await fsPromises.mkdir(authDir, { recursive: true });
    } catch (err) {
        logger.error('Clean auth state error:', err);
    }
}

async function startConnection() {
    try {
        // Initialize command loader first
        const commandsInitialized = await commandLoader.loadCommandHandlers();
        if (!commandsInitialized) {
            throw new Error('Failed to initialize commands');
        }

        // Reset flags
        qrDisplayed = false;
        const isValidSession = await validateSession();

        if (!isValidSession && retryCount > 0) {
            await cleanAuthState();
        }

        const authDir = path.join(process.cwd(), 'auth_info');
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        // Create socket connection
        sock = makeWASocket({
            version: [2, 2323, 4],
            auth: state,
            printQRInTerminal: false,
            logger: logger,
            browser: ['WhatsApp-MD', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            qrTimeout: 40000,
            defaultQueryTimeoutMs: 20000,
            keepAliveIntervalMs: 5000,
            emitOwnEvents: false,
            markOnlineOnConnect: true
        });

        sock.ev.process(async (events) => {
            // Handle connection state updates
            if (events['connection.update']) {
                const update = events['connection.update'];
                const { connection, lastDisconnect, qr } = update;

                if (qr && !qrDisplayed) {
                    qrDisplayed = true;

                    // Completely disable logging and clear console
                    const originalLogLevel = logger.level;
                    logger.level = 'silent';
                    console.clear();

                    // Display QR code with minimal decoration
                    console.log('\n=== WhatsApp QR Code ===\n');
                    qrcode.generate(qr, { small: true }, (qrcode) => {
                        console.log(qrcode);
                        console.log('\nScan this QR code with WhatsApp\n');
                    });

                    // Restore logging after delay
                    setTimeout(() => {
                        logger.level = originalLogLevel;
                    }, 1000);
                }

                if (connection === 'open') {
                    isConnected = true;
                    qrDisplayed = false;
                    retryCount = 0;
                    console.clear();
                    logger.info('✅ Successfully connected to WhatsApp!');

                    // Notify owner if set
                    try {
                        let ownerNumber = process.env.OWNER_NUMBER;
                        if (ownerNumber) {
                            if (!ownerNumber.includes('@s.whatsapp.net')) {
                                ownerNumber = ownerNumber.replace(/[^\d]/g, '');
                                if (!ownerNumber.startsWith('1') && !ownerNumber.startsWith('91')) {
                                    ownerNumber = '1' + ownerNumber;
                                }
                                ownerNumber = `${ownerNumber}@s.whatsapp.net`;
                            }
                            await sock.sendMessage(ownerNumber, { text: 'Bot is now connected and ready!' });
                        }
                    } catch (err) {
                        logger.error('Failed to send owner notification:', err.message);
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
                            logger.error('Maximum retry attempts reached. Please restart the bot.');
                            process.exit(1);
                        }
                    }
                }
            }

            // Handle credentials update
            if (events['creds.update']) {
                await saveCreds();
            }

            // Handle incoming messages
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
                                    text: '❌ Sorry, there was an error processing your message. Please try again.' 
                                });
                            } catch (notifyErr) {
                                logger.error('Failed to send error notification:', notifyErr);
                            }
                        }
                    }
                }
            }

            // Handle group participant updates
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
            throw new Error('Failed to connect after maximum retries');
        }
    }
}

module.exports = { startConnection };