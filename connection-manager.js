/**
 * Advanced WhatsApp Connection Manager
 * Enhanced for 24/7 uptime and stability
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const ConnectionMonitor = require('./src/utils/connectionMonitor');
const pino = require('pino');

// Configuration 
const BASE_AUTH_FOLDER = './auth_info_manager';
const MAX_QR_ATTEMPTS = 5;
const CONNECTION_TIMEOUT = 60000;
const KEEP_ALIVE_INTERVAL = 10000;
const MEMORY_CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes
const MEMORY_THRESHOLD = 800 * 1024 * 1024; // 800MB

// Enhanced browser configurations with rotating user agents
const BROWSER_CONFIGS = [
    {
        name: 'Firefox',
        auth_folder: `${BASE_AUTH_FOLDER}_firefox`,
        fingerprint: ['Firefox', 'Linux', '115.0'],
        user_agent: 'Mozilla/5.0 (X11; Linux x86_64; rv:115.0) Gecko/20100101 Firefox/115.0'
    },
    {
        name: 'Chrome',
        auth_folder: `${BASE_AUTH_FOLDER}_chrome`,
        fingerprint: ['Chrome', 'Windows', '120.0.0.0'],
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    {
        name: 'Safari',
        auth_folder: `${BASE_AUTH_FOLDER}_safari`,
        fingerprint: ['Safari', 'Mac OS', '17.0'],
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    }
];

// Connection state
let currentBrowserIndex = 0;
let connectionAttempts = 0;
let qrAttempts = 0;
let isConnected = false;
let messageHandlerInitialized = false;
let connectionMonitor = null;
let currentSocket = null;
let keepAliveInterval = null;

// Initialize connection monitor
function initConnectionMonitor(sock) {
    connectionMonitor = new ConnectionMonitor({
        checkIntervalMs: 30000,
        maxReconnectAttempts: 10,
        reconnectBackoffMs: 5000,
        autoReconnect: true,
        notifyDiscoveredIssues: true
    });

    connectionMonitor.startMonitoring(sock);
}

// Keep-alive mechanism
function startKeepAlive(sock) {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
    }

    keepAliveInterval = setInterval(async () => {
        try {
            // Send keep-alive signal
            if (sock?.ws?.readyState === sock?.ws?.OPEN) {
                sock.ws.send('KeepAlive');
            }

            // Check connection health
            const health = await connectionMonitor?.checkHealth();
            if (health?.healthScore < 50) {
                console.log('[KeepAlive] Poor connection health detected, initiating recovery...');
                await handleConnectionRecovery(sock);
            }
        } catch (err) {
            console.error('[KeepAlive] Error:', err.message);
        }
    }, KEEP_ALIVE_INTERVAL);
}

// Memory optimization
function optimizeMemory() {
    try {
        const memUsage = process.memoryUsage();
        const heapUsed = memUsage.heapUsed;

        if (heapUsed > MEMORY_THRESHOLD) {
            console.log('[Memory] High memory usage detected, performing cleanup...');

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            // Clear message caches
            if (currentSocket?.store) {
                currentSocket.store.messages.clear();
                currentSocket.store.chats.clear();
            }
        }
    } catch (err) {
        console.error('[Memory] Optimization error:', err.message);
    }
}

// Enhanced connection recovery
async function handleConnectionRecovery(sock) {
    try {
        console.log('[Recovery] Initiating connection recovery...');

        // Stop existing monitoring
        connectionMonitor?.stopMonitoring();

        // Clear intervals
        if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
        }

        // Attempt graceful logout
        try {
            await sock?.logout();
        } catch (err) {
            // Ignore logout errors
        }

        // Initialize fresh connection
        currentSocket = await initializeConnection();

        if (currentSocket) {
            console.log('[Recovery] Connection recovered successfully');
            initConnectionMonitor(currentSocket);
            startKeepAlive(currentSocket);
        }
    } catch (err) {
        console.error('[Recovery] Error during recovery:', err.message);
        // Try next browser profile
        currentBrowserIndex = (currentBrowserIndex + 1) % BROWSER_CONFIGS.length;
        setTimeout(() => tryNextBrowser(), 5000);
    }
}

// Initialize connection with enhanced error handling
async function initializeConnection() {
    const config = BROWSER_CONFIGS[currentBrowserIndex];
    console.log(`\n[Connection] Attempting connection with ${config.name} profile...`);

    try {
        const { state, saveCreds } = await useMultiFileAuthState(config.auth_folder);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: config.fingerprint,
            version: [2, 2323, 4],
            connectTimeoutMs: CONNECTION_TIMEOUT,
            keepAliveIntervalMs: KEEP_ALIVE_INTERVAL,
            retryRequestDelayMs: 2000,
            markOnlineOnConnect: true,
            userAgent: config.user_agent,
            logger: pino({ level: 'silent' }),
            defaultQueryTimeoutMs: 60000,
            emitOwnEvents: false
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                handleQRCode(qr, config);
            }

            if (connection === 'open') {
                handleSuccessfulConnection(sock, saveCreds);
            }

            if (connection === 'close') {
                handleDisconnection(sock, lastDisconnect);
            }
        });

        // Handle creds update
        sock.ev.on('creds.update', saveCreds);

        return sock;
    } catch (err) {
        console.error('[Connection] Error:', err.message);
        return null;
    }
}

// Handle QR code generation
function handleQRCode(qr, config) {
    qrAttempts++;
    console.clear();
    console.log('\n=== BLACKSKY-MD WHATSAPP QR ===');
    console.log(`Browser: ${config.name} (Attempt ${qrAttempts}/${MAX_QR_ATTEMPTS})`);
    qrcode.generate(qr, { small: true });

    if (qrAttempts >= MAX_QR_ATTEMPTS) {
        console.log('[QR] Max attempts reached, trying next browser...');
        currentBrowserIndex = (currentBrowserIndex + 1) % BROWSER_CONFIGS.length;
        qrAttempts = 0;
        setTimeout(() => tryNextBrowser(), 2000);
    }
}

// Handle successful connection
async function handleSuccessfulConnection(sock, saveCreds) {
    console.log('\n✅ Connected successfully!');
    isConnected = true;
    currentSocket = sock;

    // Initialize monitoring
    initConnectionMonitor(sock);
    startKeepAlive(sock);

    // Save credentials
    await saveCreds();

    // Initialize message handler
    try {
        if (!messageHandlerInitialized) {
            const messageHandler = require('./src/simplified-message-handler');
            await messageHandler.init(sock);
            messageHandlerInitialized = true;
            console.log('✅ Message handler initialized');
        }
    } catch (err) {
        console.error('[Handler] Error:', err.message);
    }
}

// Handle disconnection
async function handleDisconnection(sock, lastDisconnect) {
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    console.log(`[Disconnection] Status code: ${statusCode}`);

    if (statusCode === DisconnectReason.loggedOut) {
        console.log('[Auth] Logged out, switching profile...');
        currentBrowserIndex = (currentBrowserIndex + 1) % BROWSER_CONFIGS.length;
        setTimeout(() => tryNextBrowser(), 5000);
    } else {
        // Attempt recovery
        await handleConnectionRecovery(sock);
    }
}

// Start connection process
async function startConnection() {
    // Set up memory optimization interval
    setInterval(optimizeMemory, MEMORY_CHECK_INTERVAL);

    // Initialize connection
    currentSocket = await initializeConnection();

    if (!currentSocket) {
        console.log('[Startup] Initial connection failed, retrying...');
        setTimeout(() => tryNextBrowser(), 5000);
    }
}


// Try connecting with the next browser configuration
async function tryNextBrowser() {
    // Reset if we've tried all browsers
    if (currentBrowserIndex >= BROWSER_CONFIGS.length) {
        console.log('Tried all browser configurations. Starting over with the first one...');
        currentBrowserIndex = 0;
    }

    currentSocket = await initializeConnection();
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
startConnection().catch(err => {
    console.error('Fatal error:');
    console.error(err);
});


// Handle process termination
process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, cleaning up...');
    connectionMonitor?.stopMonitoring();
    clearInterval(keepAliveInterval);

    try {
        await currentSocket?.logout();
    } catch (err) {
        // Ignore logout errors
    }

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

module.exports = { startConnection };