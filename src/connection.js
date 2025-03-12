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

// Global state
let sock = null;
let retryCount = 0;
let qrDisplayed = false;
let isConnected = false;

// Configuration constants
const isProduction = process.env.NODE_ENV === 'production';
const MAX_RETRIES = isProduction ? 999999 : 10;
const RETRY_INTERVAL_BASE = isProduction ? 5000 : 10000;
const MAX_RETRY_INTERVAL = isProduction ? 300000 : 60000;

async function startConnection() {
    try {
        // Clear console
        console.clear();
        console.log('Starting WhatsApp connection...\n');

        // Force remove auth_info
        const authDir = path.join(process.cwd(), 'auth_info');
        await fsPromises.rm(authDir, { recursive: true, force: true })
            .catch(() => console.log('No existing auth state to clean'));

        // Create fresh auth directory
        await fsPromises.mkdir(authDir, { recursive: true });
        console.log('Created fresh auth directory\n');

        // Set up auth state
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        console.log('Auth state initialized\n');

        // Create socket connection
        sock = makeWASocket({
            version: [2, 2323, 4],
            auth: state,
            printQRInTerminal: true,
            logger: logger,
            browser: ['WhatsApp-MD', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            qrTimeout: 40000,
            defaultQueryTimeoutMs: 20000,
            keepAliveIntervalMs: 5000,
            emitOwnEvents: false,
            markOnlineOnConnect: true
        });

        console.log('Socket created, waiting for QR code...\n');

        sock.ev.process(async (events) => {
            if (events['connection.update']) {
                const update = events['connection.update'];
                const { connection, lastDisconnect, qr } = update;

                // Debug QR code generation
                if (qr) {
                    console.log('QR Code received:', qr ? 'YES' : 'NO');
                    console.log('QR Code length:', qr ? qr.length : 0);
                    qrDisplayed = true;
                }

                if (connection === 'open') {
                    console.log('\nConnection established!');
                    isConnected = true;
                    qrDisplayed = false;
                    retryCount = 0;

                    // Initialize commands
                    await commandLoader.loadCommandHandlers();
                    logger.info('✅ Connected to WhatsApp');

                    // Notify owner
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
                            await sock.sendMessage(ownerNumber, { text: '✅ Bot is now connected and ready!' });
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
                        console.log(`\nReconnecting in ${delay/1000} seconds...`);
                        setTimeout(startConnection, delay);
                    } else {
                        throw new Error('Failed to connect after maximum retries');
                    }
                }
            }

            // Handle other events only when connected
            if (isConnected) {
                if (events['creds.update']) {
                    await saveCreds();
                }

                if (events['messages.upsert']) {
                    const upsert = events['messages.upsert'];
                    if (upsert.type === 'notify') {
                        for (const msg of upsert.messages) {
                            if (!msg.message) continue;

                            const isGroup = msg.key.remoteJid?.endsWith('@g.us');
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

                if (events['group-participants.update']) {
                    const update = events['group-participants.update'];
                    try {
                        await handleGroupParticipantsUpdate(sock, update);
                    } catch (err) {
                        logger.error('Group participants update error:', err);
                    }
                }
            }
        });

        return sock;
    } catch (err) {
        console.error('Connection error:', err);
        console.error('Stack trace:', err.stack);

        if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = Math.min(
                RETRY_INTERVAL_BASE * Math.pow(1.5, retryCount - 1),
                MAX_RETRY_INTERVAL
            );
            console.log(`\nRetrying connection in ${delay/1000} seconds...`);
            setTimeout(startConnection, delay);
        } else {
            throw new Error('Failed to connect after maximum retries');
        }
    }
}

module.exports = { startConnection };