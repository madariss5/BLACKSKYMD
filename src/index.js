/**
 * BLACKSKY-MD WhatsApp Bot (Main Handler)
 * This file only handles the message processing, the connection is managed by qr-web-server.js
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const handler = require('./handlers/ultra-minimal-handler');
const logger = require('./utils/logger');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

// Constants
const AUTH_DIRECTORY = path.join(process.cwd(), 'auth_info');
const BROWSER_ID = `BLACKSKY-REPLIT-${Date.now().toString().slice(-6)}`;

// Global state
let sock = null;
let connectionAttempts = 0;
const MAX_RETRIES = 10;
const INITIAL_RETRY_DELAY = 3000;

// Start WhatsApp connection
async function startConnection() {
    try {
        // Initialize handler
        await handler.init();
        logger.info('Command handler initialized');

        // Wait a bit before connecting to ensure QR server has finished its initialization
        // This helps prevent conflicts
        if (connectionAttempts === 0) {
            logger.info('Waiting for QR Web Server to initialize first...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Check if auth directory exists
        if (!fs.existsSync(AUTH_DIRECTORY)) {
            logger.info('Auth directory not found, creating...');
            fs.mkdirSync(AUTH_DIRECTORY, { recursive: true });
        }

        // Setup authentication state
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIRECTORY);
        logger.info('Auth state loaded');

        // Create socket with Replit-optimized settings
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false, // Don't print QR in terminal, QR web server does that
            browser: [BROWSER_ID, 'Firefox', '110.0.0'], // Use different browser signature from QR server
            version: [2, 2323, 4],
            logger: pino({ level: 'silent' }),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            markOnlineOnConnect: false,
            syncFullHistory: false
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            logger.info('📡 CONNECTION UPDATE:', update?.connection || 'No connection data');

            if (connection === 'open') {
                logger.info('🎉 CONNECTION OPENED SUCCESSFULLY!');
                connectionAttempts = 0; // Reset attempts on successful connection
                try {
                    const user = sock.user;
                    logger.info('👤 Connected as:', user.name || user.verifiedName || user.id.split(':')[0]);
                } catch (e) {
                    logger.error('⚠️ Could not get user details:', e.message);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                logger.info(`\n🔴 CONNECTION CLOSED:
- Status Code: ${statusCode || 'Unknown'}
- Should Reconnect: ${shouldReconnect ? 'Yes' : 'No'}
`);

                if (shouldReconnect && connectionAttempts < MAX_RETRIES) {
                    connectionAttempts++;
                    const retryDelay = Math.min(INITIAL_RETRY_DELAY * Math.pow(1.5, connectionAttempts-1), 60000);
                    logger.info(`🔄 Reconnection attempt ${connectionAttempts}/${MAX_RETRIES} in ${retryDelay/1000} seconds...`);
                    setTimeout(startConnection, retryDelay);
                } else if (connectionAttempts >= MAX_RETRIES) {
                    logger.error(`⛔ Maximum reconnection attempts (${MAX_RETRIES}) reached. Giving up.`);
                    logger.info('Please restart the workflow manually if you need to reconnect.');
                } else {
                    logger.info('⛔ Not reconnecting - logged out');
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

        // Wire up message handler
        sock.ev.on('messages.upsert', async (m) => {
            if (m.type === 'notify') {
                try {
                    await handler.messageHandler(sock, m.messages[0]);
                } catch (err) {
                    logger.error('Message handling error:', err);
                }
            }
        });

        return sock;
    } catch (error) {
        logger.error('Connection error:', error);
        
        if (connectionAttempts < MAX_RETRIES) {
            connectionAttempts++;
            const retryDelay = Math.min(INITIAL_RETRY_DELAY * Math.pow(1.5, connectionAttempts-1), 60000);
            logger.info(`🔄 Reconnection attempt ${connectionAttempts}/${MAX_RETRIES} in ${retryDelay/1000} seconds...`);
            setTimeout(startConnection, retryDelay);
        } else {
            logger.error(`⛔ Maximum reconnection attempts (${MAX_RETRIES}) reached. Giving up.`);
            logger.info('Please restart the workflow manually if you need to reconnect.');
        }
    }
}

// Start the WhatsApp connection
startConnection();