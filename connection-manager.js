/**
 * Advanced WhatsApp Connection Manager
 * Sequentially tries different browser fingerprints and connection methods
 * until one successfully establishes a connection
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Configuration - optimized for faster responses
const BASE_AUTH_FOLDER = './auth_info_manager';
const MAX_QR_ATTEMPTS = 10;  // Reduced for faster cycling through browsers
const CONNECTION_TIMEOUT = 30000; // Faster timeout for quicker response
const MAX_CONNECTION_ATTEMPTS = 3; // Reduced for faster browser cycling

// Browser configurations to try (in order)
const BROWSER_CONFIGS = [
    {
        name: 'Firefox',
        auth_folder: `${BASE_AUTH_FOLDER}_firefox`,
        fingerprint: ['Firefox', 'Linux', '110.0'],
        user_agent: 'Mozilla/5.0 (X11; Linux x86_64; rv:110.0) Gecko/20100101 Firefox/110.0'
    },
    {
        name: 'Safari',
        auth_folder: `${BASE_AUTH_FOLDER}_safari`,
        fingerprint: ['Safari', 'Mac OS', '16.4'],
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15'
    },
    {
        name: 'Chrome',
        auth_folder: `${BASE_AUTH_FOLDER}_chrome`,
        fingerprint: ['Chrome', 'Windows', '112.0.5615.49'],
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
    },
    {
        name: 'Edge',
        auth_folder: `${BASE_AUTH_FOLDER}_edge`,
        fingerprint: ['Edge', 'Windows', '112.0.1722.34'],
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36 Edg/112.0.1722.34'
    },
    {
        name: 'Opera',
        auth_folder: `${BASE_AUTH_FOLDER}_opera`,
        fingerprint: ['Opera', 'Linux', '96.0.4693.50'],
        user_agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 OPR/93.0.0.0'
    }
];

// State tracking
let currentBrowserIndex = 0;
let connectionAttempts = 0;
let qrAttempts = 0;
let isConnected = false;
let messageHandlerInitialized = false;

// Create folders if they don't exist
BROWSER_CONFIGS.forEach(config => {
    if (!fs.existsSync(config.auth_folder)) {
        fs.mkdirSync(config.auth_folder, { recursive: true });
    }
});

// Copy any existing credentials that might work
function copyExistingCredentials() {
    const possibleSources = [
        './auth_info', 
        './auth_info_baileys', 
        './auth_info_terminal',
        './auth_info_terminal_qr',
        './auth_info_firefox'
    ];
    
    for (const source of possibleSources) {
        if (fs.existsSync(source) && fs.lstatSync(source).isDirectory()) {
            const files = fs.readdirSync(source);
            
            if (files.length > 0 && files.includes('creds.json')) {
                console.log(`Found existing credentials in ${source}, copying to all browser auth folders...`);
                
                BROWSER_CONFIGS.forEach(config => {
                    try {
                        if (!fs.existsSync(config.auth_folder)) {
                            fs.mkdirSync(config.auth_folder, { recursive: true });
                        }
                        
                        files.forEach(file => {
                            try {
                                fs.copyFileSync(
                                    path.join(source, file),
                                    path.join(config.auth_folder, file)
                                );
                            } catch (err) {
                                // Ignore copy errors
                            }
                        });
                    } catch (err) {
                        // Ignore folder errors
                    }
                });
                
                return true;
            }
        }
    }
    
    return false;
}

// Initialize message handler once connected
async function initializeMessageHandler(sock) {
    if (messageHandlerInitialized) return true;
    
    try {
        const messageHandler = require('./src/simplified-message-handler');
        await messageHandler.init(sock);
        console.log('Message handler initialized! Bot is now ready to respond to commands.');
        console.log('Command modules have been loaded from both /commands and /src/commands folders.');
        console.log('Try sending ".help" to the bot to see available commands.');
        messageHandlerInitialized = true;
        return true;
    } catch (err) {
        console.error(`Error initializing message handler: ${err.message}`);
        console.error('The bot will work but won\'t respond to commands');
        return false;
    }
}

// Try connecting with the next browser configuration
async function tryNextBrowser() {
    // Reset if we've tried all browsers
    if (currentBrowserIndex >= BROWSER_CONFIGS.length) {
        console.log('Tried all browser configurations. Starting over with the first one...');
        currentBrowserIndex = 0;
    }
    
    const config = BROWSER_CONFIGS[currentBrowserIndex];
    console.log(`\nTrying connection with ${config.name} browser fingerprint (${currentBrowserIndex + 1}/${BROWSER_CONFIGS.length})`);
    
    connectionAttempts++;
    qrAttempts = 0;
    
    try {
        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(config.auth_folder);
        
        // Create socket with optimized configuration for faster responses
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: config.fingerprint,
            userAgent: config.user_agent,
            connectTimeoutMs: CONNECTION_TIMEOUT,
            defaultQueryTimeoutMs: 20000, // Faster query timeout
            syncFullHistory: false,       // Don't sync history (faster)
            markOnlineOnConnect: true,
            qrTimeout: 30000,            // Faster QR timeout
            fireInitQueries: false,      // Skip init queries for speed
            keepAliveIntervalMs: 10000,  // More frequent keepalive
            emitOwnEvents: false,        // Reduce event processing overhead
            retryRequestDelayMs: 250,    // Faster retry for failed requests
            transactionOpts: {
                maxCommitRetries: 1,     // Fewer retries for faster operation
                maxRetries: 2            // Reduce retries for failed messages
            },
            // Enhanced message patching for optimized delivery and better compatibility
            patchMessageBeforeSending: msg => {
                try {
                    // Add viewOnce mode to images if they're marked for it (but missing the flag)
                    if (msg.message?.imageMessage && msg.message.imageMessage.viewOnce === true) {
                        msg.message = {
                            viewOnceMessage: {
                                message: {
                                    ...msg.message
                                }
                            }
                        };
                    }
                    
                    // Add viewOnce mode to videos if they're marked for it (but missing the flag)
                    if (msg.message?.videoMessage && msg.message.videoMessage.viewOnce === true) {
                        msg.message = {
                            viewOnceMessage: {
                                message: {
                                    ...msg.message
                                }
                            }
                        };
                    }
                    
                    // Enhance message with appropriate metadata for better delivery success
                    if (msg.message) {
                        // Add proper messaging metadata for non-group messages
                        if (!msg.key.remoteJid.endsWith('@g.us') && !msg.message.protocolMessage) {
                            msg.message.messageContextInfo = {
                                deviceListMetadata: {},
                                deviceListMetadataVersion: 2
                            };
                        }
                    }
                    
                    // Ensure buttonId values are strings to prevent WhatsApp errors
                    if (msg.message?.buttonsMessage?.buttons) {
                        msg.message.buttonsMessage.buttons.forEach(button => {
                            if (button.buttonId && typeof button.buttonId !== 'string') {
                                button.buttonId = button.buttonId.toString();
                            }
                        });
                    }
                } catch (err) {
                    console.log("Error in message patch function:", err);
                    // Return original message on error
                }
                return msg;
            }
        });
        
        // Handle credential updates
        sock.ev.on('creds.update', async () => {
            await saveCreds();
            
            // Copy credentials to other folders for compatibility
            if (isConnected) {
                BROWSER_CONFIGS.forEach(browserConfig => {
                    if (browserConfig.auth_folder !== config.auth_folder) {
                        try {
                            const files = fs.readdirSync(config.auth_folder);
                            for (const file of files) {
                                fs.copyFileSync(
                                    path.join(config.auth_folder, file),
                                    path.join(browserConfig.auth_folder, file)
                                );
                            }
                        } catch (err) {
                            // Ignore copy errors
                        }
                    }
                });
                
                // Also copy to standard folders
                const standardFolders = ['./auth_info_baileys', './auth_info'];
                standardFolders.forEach(folder => {
                    try {
                        if (!fs.existsSync(folder)) {
                            fs.mkdirSync(folder, { recursive: true });
                        }
                        
                        const files = fs.readdirSync(config.auth_folder);
                        for (const file of files) {
                            fs.copyFileSync(
                                path.join(config.auth_folder, file),
                                path.join(folder, file)
                            );
                        }
                    } catch (err) {
                        // Ignore copy errors
                    }
                });
            }
        });
        
        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // Handle QR code
            if (qr) {
                qrAttempts++;
                
                // Clear terminal and display QR code
                console.clear();
                console.log('\n\n');
                console.log('▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄');
                console.log(`█ BLACKSKY-MD WHATSAPP QR (${config.name.toUpperCase()}) █`);
                console.log('▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀');
                console.log('\n1. Open WhatsApp on your phone');
                console.log('2. Tap Menu or Settings > Linked Devices');
                console.log('3. Tap on "Link a Device"');
                console.log('4. Point your phone camera to scan this QR code\n\n');
                
                // Try to use our custom QR resizer for better visibility if available
                try {
                    const qrResizer = require('./src/qr-resizer');
                    qrResizer.displayQRWithHeader(qr, {
                        headerText: `📱 Scan this QR code with your WhatsApp (browser: ${config.name})`,
                        footerText: `⚠️ Keep this window open - QR attempt ${qrAttempts}/${MAX_QR_ATTEMPTS}`,
                        small: true
                    });
                } catch (err) {
                    // Fallback to standard QR code if resizer not available
                    qrcode.generate(qr, { small: true });
                    console.log(`\n[QR code generated - attempt ${qrAttempts}/${MAX_QR_ATTEMPTS}]`);
                    console.log(`[Browser: ${config.name}, Connection attempt: ${connectionAttempts}]`);
                    console.log('\nWaiting for you to scan the QR code...');
                }
                
                // Try next browser if QR code isn't scanned after max attempts
                if (qrAttempts >= MAX_QR_ATTEMPTS) {
                    console.log(`Maximum QR attempts (${MAX_QR_ATTEMPTS}) reached with ${config.name}. Trying next browser...`);
                    currentBrowserIndex++;
                    setTimeout(() => {
                        tryNextBrowser();
                    }, 1000);
                }
            }
            
            // Handle connection status
            if (connection === 'open') {
                console.log(`\n✅ CONNECTED SUCCESSFULLY USING ${config.name.toUpperCase()} FINGERPRINT!\n`);
                console.log('Connection details:');
                console.log(`- Browser: ${config.fingerprint.join(', ')}`);
                console.log(`- Auth folder: ${config.auth_folder}`);
                
                isConnected = true;
                connectionAttempts = 0;
                qrAttempts = 0;
                
                // Initialize message handler
                await initializeMessageHandler(sock);
            }
            
            // Handle disconnection
            if (connection === 'close') {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorName = lastDisconnect?.error?.name || '';
                const errorMessage = lastDisconnect?.error?.message || '';
                
                console.log(`Connection closed with status code: ${statusCode || 'unknown'}`);
                console.log(`Error name: ${errorName}, Message: ${errorMessage}`);
                
                // Check for decryption errors - patterns we've seen in logs
                const isDecryptionError = 
                    errorMessage.includes('decrypt') || 
                    errorMessage.includes('encryption') || 
                    errorMessage.includes('decryption') ||
                    errorMessage.includes('failed to log in') ||
                    errorName.includes('DecryptionError') ||
                    (statusCode === 401 && errorMessage.includes('Connection Failure'));
                
                // Check for authentication state corruption issues
                const isAuthCorruption = 
                    errorName === 'NotFoundException' || 
                    errorMessage.includes('auth creds') || 
                    errorMessage.includes('authentication');
                
                if (isDecryptionError || isAuthCorruption) {
                    console.log('❌ Encryption/authentication error detected. Cleaning auth files...');
                    
                    try {
                        // Use our specialized connection fix utility
                        const connectionFix = require('./src/utils/connection-fix');
                        
                        // Fix the decryption error by cleaning auth files
                        connectionFix.clearAuthFiles(config.auth_folder);
                        
                        // If this is a persistent issue, try a full cleanup
                        if (connectionAttempts > 2) {
                            console.log('Persistent connection issue detected. Performing full auth cleanup...');
                            connectionFix.cleanAllAuthFolders();
                        }
                    } catch (fixErr) {
                        console.error(`Failed to run connection fix: ${fixErr.message}`);
                        
                        // Fallback to basic cleanup if the utility fails
                        try {
                            const fs = require('fs');
                            const path = require('path');
                            
                            if (fs.existsSync(config.auth_folder)) {
                                const files = fs.readdirSync(config.auth_folder);
                                for (const file of files) {
                                    try {
                                        fs.unlinkSync(path.join(config.auth_folder, file));
                                        console.log(`Deleted ${file} from ${config.auth_folder}`);
                                    } catch (err) {
                                        console.log(`Failed to delete ${file}: ${err.message}`);
                                    }
                                }
                            }
                        } catch (err) {
                            console.error(`Error during basic cleanup: ${err.message}`);
                        }
                    }
                    
                    // Try with a fresh session using the next browser
                    console.log('Switching to next browser with fresh session...');
                    currentBrowserIndex++;
                    setTimeout(() => {
                        tryNextBrowser();
                    }, 2000);
                }
                // Handle traditional disconnect reasons
                else if (statusCode === DisconnectReason.loggedOut) {
                    console.log('Logged out from WhatsApp. Trying with different browser...');
                    currentBrowserIndex++;
                    setTimeout(() => {
                        tryNextBrowser();
                    }, 2000);
                } else if (statusCode === 428) {
                    // Connection closed too many times, switch to the next browser
                    console.log('Connection closed too many times. Trying next browser...');
                    currentBrowserIndex++;
                    setTimeout(() => {
                        tryNextBrowser();
                    }, 2000);
                } else {
                    // Standard reconnection with the same browser
                    const delay = Math.min(5000 * Math.pow(1.5, connectionAttempts % 5), 30000);
                    console.log(`Reconnecting with same browser in ${Math.floor(delay/1000)} seconds...`);
                    
                    setTimeout(() => {
                        if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
                            // Too many attempts with this browser, try the next one
                            console.log(`Too many connection attempts with ${config.name}. Trying next browser...`);
                            currentBrowserIndex++;
                            tryNextBrowser();
                        } else {
                            // Retry with the same browser
                            tryNextBrowser();
                        }
                    }, delay);
                }
            }
        });
        
        return sock;
    } catch (err) {
        console.error(`Error connecting with ${config.name}: ${err.message}`);
        
        // Try the next browser after a short delay
        currentBrowserIndex++;
        setTimeout(() => {
            tryNextBrowser();
        }, 2000);
        
        return null;
    }
}

// Display banner
console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║    BLACKSKY-MD ADVANCED CONNECTION MANAGER        ║
║                                                   ║
║  • Automatic browser fingerprinting selection     ║
║  • Tries multiple connection methods sequentially  ║
║  • Optimized for cloud environments               ║
║  • Automatic reconnection and recovery            ║
║                                                   ║
║  Wait for the QR code to appear and scan it       ║
║  with your WhatsApp mobile app                    ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
`);

// Copy existing credentials first
copyExistingCredentials();

// Start connection sequence
tryNextBrowser().catch(err => {
    console.error('Fatal error:');
    console.error(err);
});

// Memory optimization and management
const memoryLimit = 800 * 1024 * 1024; // 800MB threshold
const memoryCheckInterval = 30 * 60 * 1000; // Check every 30 minutes

/**
 * Optimize memory usage to prevent out-of-memory crashes
 */
function optimizeMemory() {
    try {
        // Get current memory usage
        const memUsage = process.memoryUsage();
        
        // Convert to MB for easier reading
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
        const rssMB = Math.round(memUsage.rss / 1024 / 1024);
        
        console.log(`Memory usage: ${heapUsedMB}MB used of ${heapTotalMB}MB heap. RSS: ${rssMB}MB`);
        
        // If memory usage exceeds our threshold, perform cleanup
        if (memUsage.heapUsed > memoryLimit) {
            console.log("Memory usage high, performing garbage collection");
            
            // Force garbage collection if possible
            if (global.gc) {
                global.gc();
                console.log("Forced garbage collection completed");
            } else {
                console.log("No global garbage collection available. Consider running with --expose-gc");
            }
            
            // Reset message cache to free up memory
            try {
                const jidHelper = require('./src/utils/jidHelper');
                if (jidHelper && jidHelper.resetMessageStats) {
                    jidHelper.resetMessageStats();
                    console.log("Message cache cleared");
                }
            } catch (err) {
                console.log("Failed to reset message cache:", err.message);
            }
        }
    } catch (err) {
        console.error("Error during memory optimization:", err);
    }
}

// Set up periodic memory checks
setInterval(optimizeMemory, memoryCheckInterval);

// Handle process termination
process.on('SIGINT', () => {
    console.log('Process terminated by user');
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    
    // Perform memory optimization in case it's a memory-related issue
    optimizeMemory();
    
    // Continue running to maintain connection
    console.log('Bot will continue running despite the error');
});