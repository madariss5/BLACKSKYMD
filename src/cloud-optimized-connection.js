/**
 * Cloud-Optimized WhatsApp Connection
 * Specially designed for better stability in cloud environments like Replit
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs').promises;
const path = require('path');
const qrcode = require('qrcode');
const logger = require('./utils/logger');

// Track connection state
let isConnected = false;
let qrGenerated = false;
let connectionAttempts = 0;
const MAX_ATTEMPTS = 10;

// QR code callback functions
let qrCallbacks = [];

/**
 * Register a callback for QR code generation
 * @param {Function} callback Function to call with QR code
 */
function onQR(callback) {
    qrCallbacks.push(callback);
}

/**
 * Create a fresh session directory
 */
async function createFreshSession() {
    try {
        // Create a timestamp for uniqueness
        const timestamp = Date.now();
        const sessionDir = path.join(process.cwd(), `auth_info_${timestamp}`);
        
        // Create the directory
        await fs.mkdir(sessionDir, { recursive: true });
        
        // Return the new directory path
        return sessionDir;
    } catch (err) {
        logger.error(`Error creating fresh session: ${err.message}`);
        // Fallback to default directory if we can't create a new one
        return path.join(process.cwd(), 'auth_info_baileys');
    }
}

/**
 * Create optimized connection config for cloud environments
 * @returns {Object} Connection configuration
 */
function getConnectionConfig() {
    return {
        printQRInTerminal: false,
        browser: ['Safari (Mac)', 'Safari', '611.1.21.161.7'],
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        userDevicesCache: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 30000,
        patchMessageBeforeSending: true,
        fireInitQueries: false,
        retryRequestDelayMs: 250,
        logger: pino({ level: 'silent' })
    };
}

/**
 * Start a fresh WhatsApp connection
 * @returns {Promise<Object>} Connected socket
 */
async function connect() {
    connectionAttempts++;
    
    try {
        // Use a fresh session directory after multiple failed attempts
        const authDir = connectionAttempts > 3 
            ? await createFreshSession() 
            : path.join(process.cwd(), 'auth_info_baileys');
        
        logger.info(`Using auth directory: ${authDir} (attempt ${connectionAttempts})`);
        
        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        
        // Create connection config
        const config = getConnectionConfig();
        
        // Create socket with our configuration
        const sock = makeWASocket({
            ...config,
            auth: state
        });
        
        // Handle credential updates
        sock.ev.on('creds.update', async () => {
            await saveCreds();
        });
        
        // Handle connection updates
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // Handle QR code
            if (qr) {
                qrGenerated = true;
                
                // Generate QR in terminal
                console.log('\n▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄');
                console.log('█ BLACKSKY-MD WHATSAPP QR CODE █');
                console.log('▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀');
                console.log('\n1. Open WhatsApp on your phone');
                console.log('2. Tap Menu (settings) or Settings > Linked Devices');
                console.log('3. Tap on Link a Device');
                console.log('4. Point your phone camera to this QR code');
                
                // Log QR generation
                logger.info('🔄 New QR code generated. Scan it with WhatsApp on your phone.');
                
                // Convert to data URL and call registered callbacks
                qrcode.toDataURL(qr)
                    .then(qrImage => {
                        qrCallbacks.forEach(callback => callback(qrImage));
                    })
                    .catch(err => {
                        logger.error(`QR code generation error: ${err.message}`);
                    });
            }
            
            // Handle connection status changes
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                logger.info(`Connection closed with status code: ${statusCode || 'unknown'}`);
                
                // Different handling based on status code
                if (statusCode === 401 || statusCode === 403) {
                    // Auth issues - fresh session
                    logger.warn('Auth rejected, trying with fresh session next time');
                    connectionAttempts = 3; // Force fresh session next time
                } else if (statusCode === 440) {
                    // Session replacement
                    logger.warn('Session replaced, creating fresh session');
                    connectionAttempts = 3; // Force fresh session next time
                }
                
                // Reconnect with longer delay between attempts
                if (connectionAttempts < MAX_ATTEMPTS) {
                    const delay = Math.min(5000 * Math.pow(1.5, connectionAttempts - 1), 60000);
                    logger.info(`Reconnecting in ${Math.floor(delay/1000)} seconds (attempt ${connectionAttempts}/${MAX_ATTEMPTS})...`);
                    
                    setTimeout(() => {
                        connect().catch(err => {
                            logger.error(`Reconnection failed: ${err.message}`);
                        });
                    }, delay);
                } else {
                    logger.error(`Maximum connection attempts (${MAX_ATTEMPTS}) reached`);
                }
                
                isConnected = false;
            } else if (connection === 'open') {
                logger.info('✅ WhatsApp connection established successfully!');
                connectionAttempts = 0;
                isConnected = true;
            }
        });
        
        return sock;
    } catch (err) {
        logger.error(`Connection error: ${err.message}`);
        
        // Retry with delay if not too many attempts
        if (connectionAttempts < MAX_ATTEMPTS) {
            const delay = Math.min(5000 * Math.pow(1.5, connectionAttempts - 1), 60000);
            logger.info(`Retry after error in ${Math.floor(delay/1000)} seconds...`);
            
            return new Promise((resolve) => {
                setTimeout(async () => {
                    try {
                        const sock = await connect();
                        resolve(sock);
                    } catch (retryErr) {
                        logger.error(`Retry failed: ${retryErr.message}`);
                        resolve(null);
                    }
                }, delay);
            });
        }
        
        return null;
    }
}

module.exports = {
    connect,
    onQR,
    isConnected: () => isConnected,
    qrGenerated: () => qrGenerated
};