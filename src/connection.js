const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const { sessionManager } = require('./utils/sessionManager');
const config = require('./config/config');

async function startConnection() {
    const { state, saveCreds } = await useMultiFileAuthState(config.session.authDir);

    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        logger: logger,
        defaultQueryTimeoutMs: undefined
    });

    // Handle authentication
    sock.ev.on('creds.update', saveCreds);

    // Handle QR code and connection status
    sock.ev.on('connection.update', async ({ qr, connection, lastDisconnect }) => {
        if (qr) {
            logger.info('New QR code generated, please scan with WhatsApp');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            logger.info(`Connected to WhatsApp as ${config.owner.name}!`);

            // Send startup message
            const startupMessage = '𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻 successfully connected';
            await sock.sendMessage(config.owner.number, { 
                text: startupMessage 
            }).catch(err => logger.error('Failed to send startup message:', err));

            // Start credential backup scheduling
            await sessionManager.createBackupSchedule(sock);

            // Create initial backup
            await sessionManager.backupCredentials(sock);
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                logger.info('Connection closed, attempting to reconnect...');

                // Try to restore from backup if available
                await sessionManager.restoreFromBackup();
            }
        }
    });

    // Handle messages for credential backup
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const message of messages) {
            // Only process messages from the bot itself
            if (message.key.fromMe) {
                await sessionManager.handleCredentialsBackup(message);
            }
        }
    });

    return sock;
}

module.exports = { startConnection };