/**
 * Firefox Connection Method for WhatsApp Bot
 * This script uses Firefox browser fingerprinting as an alternative connection method
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

// Configuration
const AUTH_FOLDER = './auth_info_firefox';
const LOGS_FOLDER = './logs';
const CONNECTION_TIMEOUT = 60000; // 60 seconds
const RECONNECT_INTERVAL = 3000; // 3 seconds
const MAX_QR_ATTEMPTS = 10;

// Ensure folders exist
[AUTH_FOLDER, LOGS_FOLDER].forEach(folder => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }
});

// Create logger
const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: true
        }
    }
}, pino.destination(path.join(LOGS_FOLDER, 'firefox-connection.log')));

// Copy existing auth files if available
function copyExistingAuth() {
    const sources = ['./auth_info_baileys', './auth_info_terminal', './auth_info_qr', './auth_info_safari'];
    
    for (const source of sources) {
        if (fs.existsSync(source) && fs.lstatSync(source).isDirectory()) {
            const files = fs.readdirSync(source);
            
            if (files.length > 0) {
                logger.info(`Found existing auth files in ${source}, copying to ${AUTH_FOLDER}`);
                
                if (!fs.existsSync(AUTH_FOLDER)) {
                    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
                }
                
                files.forEach(file => {
                    try {
                        fs.copyFileSync(
                            path.join(source, file),
                            path.join(AUTH_FOLDER, file)
                        );
                    } catch (err) {
                        logger.warn(`Failed to copy ${file}: ${err.message}`);
                    }
                });
                
                return true;
            }
        }
    }
    
    return false;
}

// Start WhatsApp connection
async function connectToWhatsApp() {
    // Check for existing auth and copy if available
    copyExistingAuth();
    
    // Load auth state
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    
    // Fetch latest version
    const { version } = await fetchLatestBaileysVersion();
    logger.info(`Using WA version: ${version.join('.')}`);
    
    // Connection configuration with Firefox fingerprint
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger,
        browser: ['Firefox', 'Linux', '20.0.1'],
        connectTimeoutMs: CONNECTION_TIMEOUT,
        qrTimeout: 60000,
        defaultQueryTimeoutMs: 60000,
        retryRequestDelayMs: 500
    });
    
    // Track QR code generation
    let qrAttempts = 0;
    
    // Connection update handler
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // Display QR code
        if (qr) {
            qrAttempts++;
            logger.info(`QR Code generated (attempt ${qrAttempts})`);
            qrcode.generate(qr, { small: true });
            
            if (qrAttempts >= MAX_QR_ATTEMPTS) {
                logger.warn(`Maximum QR code attempts (${MAX_QR_ATTEMPTS}) reached.`);
                logger.info('Consider using another connection method like safari-connect.js');
                logger.info('Trying alternative browser fingerprint...');
                
                // Exit this process and let the outer script retry with different browser
                process.exit(2);
            }
        }
        
        // Handle connection status
        if (connection === 'open') {
            logger.info('Connected to WhatsApp!');
            
            // Copy auth files to other directories for compatibility
            const targetDirs = ['./auth_info_baileys', './auth_info_terminal', './auth_info_qr'];
            for (const dir of targetDirs) {
                try {
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    
                    const files = fs.readdirSync(AUTH_FOLDER);
                    for (const file of files) {
                        fs.copyFileSync(
                            path.join(AUTH_FOLDER, file),
                            path.join(dir, file)
                        );
                    }
                    logger.info(`Copied credentials to ${dir} for compatibility`);
                } catch (err) {
                    logger.error(`Failed to copy credentials to ${dir}: ${err.message}`);
                }
            }
        }
        
        // Handle disconnection
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            logger.info(`Connection closed due to ${lastDisconnect?.error?.message || 'unknown reason'}`);
            
            if (shouldReconnect) {
                logger.info(`Reconnecting in ${RECONNECT_INTERVAL / 1000} seconds...`);
                setTimeout(() => {
                    logger.info('Reconnecting...');
                    connectToWhatsApp();
                }, RECONNECT_INTERVAL);
            } else {
                logger.info('Logged out, not reconnecting.');
            }
        }
    });
    
    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);
    
    return sock;
}

// Start the connection
connectToWhatsApp().catch(err => {
    logger.error('Fatal error connecting to WhatsApp:');
    logger.error(err);
    process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
    logger.info('Process terminated by user');
    process.exit(0);
});

console.log(`
╭───────────────────────────────────────────────╮
│                                               │
│    Firefox Connection Method for WhatsApp     │
│    Alternative for cloud environments         │
│                                               │
│    • Using Firefox browser fingerprint        │
│    • Enhanced connection stability            │
│    • Automatic credential backup              │
│                                               │
│    Scan the QR code when it appears           │
│                                               │
╰───────────────────────────────────────────────╯
`);