const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const { sessionManager } = require('./utils/sessionManager');

async function startConnection() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        logger: logger,
        defaultQueryTimeoutMs: undefined
    });

    // Handle authentication
    sock.ev.on('creds.update', saveCreds);

    // Handle QR code and connection status
    sock.ev.on('connection.update', ({ qr, connection, lastDisconnect }) => {
        if (qr) {
            logger.info('New QR code generated, please scan with WhatsApp');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            logger.info('Connected to WhatsApp!');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                logger.info('Connection closed, attempting to reconnect...');
            }
        }
    });

    return sock;
}

module.exports = { startConnection };