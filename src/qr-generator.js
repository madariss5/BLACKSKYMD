/**
 * Replit-Optimized WhatsApp QR Generator
 * Specially crafted for handling connection issues in restricted environments
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const app = express();
const server = http.createServer(app);
const qrcodeWeb = require('qrcode');

// Constants - use a separate auth directory from the main app
const PORT = 5003;  // Changed to 5003 to avoid conflict with other workflows
const AUTH_DIR = './auth_info_baileys_qr';

// Create auth directory if it doesn't exist
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Global state
let qrText = '';
let webQR = '';
let isConnecting = false;
let connectionLock = false;
let retryCount = 0;
const MAX_RETRIES = 5;
let reconnectTimer = null;

// Serve QR code via simple web server
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Bot QR Code</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="refresh" content="30">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                }
                h1 { color: #128C7E; }
                .qr-container {
                    margin: 30px auto;
                    padding: 20px;
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                    max-width: 350px;
                }
                .qr-code {
                    margin: 20px auto;
                }
                .qr-code img {
                    max-width: 100%;
                    height: auto;
                }
                .instructions {
                    margin-top: 20px;
                    text-align: left;
                    padding: 15px;
                    background: #f9f9f9;
                    border-radius: 5px;
                }
                .refresh-btn {
                    background-color: #128C7E;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    margin-top: 20px;
                    cursor: pointer;
                }
                .waiting {
                    color: #666;
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            </style>
        </head>
        <body>
            <h1>WhatsApp Bot QR Code</h1>
            <div class="qr-container">
                <div class="qr-code">
                    ${webQR ? 
                        `<img src="${webQR}" alt="WhatsApp QR Code">` : 
                        `<p class="waiting">Waiting for QR code... Please wait.</p>`
                    }
                </div>
                <button class="refresh-btn" onclick="location.reload()">Refresh QR Code</button>
            </div>
            <div class="instructions">
                <h3>How to Connect:</h3>
                <ol>
                    <li>Open WhatsApp on your phone</li>
                    <li>Go to Settings → Linked Devices</li>
                    <li>Tap on "Link a Device"</li>
                    <li>Scan the QR code above with your phone</li>
                </ol>
                <p>The page will refresh automatically every 30 seconds.</p>
            </div>
            ${webQR ? 
                `<p>If you can't scan this QR code, please check the terminal window for a text-based QR code.</p>` : 
                `<p>QR code is being generated. Please wait or refresh in a few seconds.</p>`
            }
        </body>
        </html>
    `);
});

// Start web server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] QR web server running at http://localhost:${PORT}`);
    // Clear session for fresh start
    clearSession();
    // Add a slight delay before connecting
    setTimeout(startConnection, 1000);
});

// Define browser rotation options globally
const browserOptions = [
    ['Firefox', '115.0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0'],
    ['Chrome', '120.0.0.0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'],
    ['Edge', '120.0.0.0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'],
    ['Safari', '17.0', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'],
    ['Opera', '105.0.0.0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 OPR/105.0.0.0']
];

// Connect to WhatsApp
async function connectToWhatsApp() {
    if (isConnecting || connectionLock) {
        console.log('[Connection] Connection attempt already in progress, skipping...');
        return null;
    }

    try {
        isConnecting = true;
        connectionLock = true;

        // Get auth state - don't clear existing auth unless necessary
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        
        // Select a browser option based on retry count
        const browserOption = browserOptions[retryCount % browserOptions.length];
        console.log(`[Connection] Using ${browserOption[0]} browser fingerprint (attempt ${retryCount + 1})`);
        
        // Generate a unique device ID for this attempt
        const deviceId = `BLACKSKY-MD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        // Connect to WhatsApp with enhanced settings for restricted environments
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: [deviceId, browserOption[0], browserOption[1]],
            version: [2, 2323, 4],
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            retryRequestDelayMs: 2000,
            emitOwnEvents: false,
            customUploadHosts: [], // Use default hosts for more compatibility
            transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
            markOnlineOnConnect: false,
            qrTimeout: 60000,
            syncFullHistory: false,
            userAgent: browserOption[2] // Use user agent matching the browser fingerprint
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Handle QR code updates
            if (qr) {
                qrText = qr;
                console.log('\n[QR] New QR code received. Displaying in terminal and web...\n');

                // Show QR in terminal
                qrcode.generate(qr, { small: true });

                // Generate QR for web
                try {
                    webQR = await qrcodeWeb.toDataURL(qr);
                    console.log(`[QR] QR code updated on web interface: http://localhost:${PORT}`);
                } catch (error) {
                    console.log('[QR] Error generating web QR:', error.message);
                }
            }

            // Handle connection state changes
            if (connection === 'open') {
                console.log('\n[Connection] Successfully connected to WhatsApp!\n');
                retryCount = 0;
                isConnecting = false;
                connectionLock = false;
                clearReconnectTimer();
                
                // Save credentials for this session
                await saveCreds();
                
                // Copy credentials to main app auth directory for seamless transition
                try {
                    const mainAuthDir = './auth_info_baileys';
                    // Ensure main auth directory exists
                    if (!fs.existsSync(mainAuthDir)) {
                        fs.mkdirSync(mainAuthDir, { recursive: true });
                    }
                    
                    // Copy all credential files
                    const files = fs.readdirSync(AUTH_DIR);
                    for (const file of files) {
                        const srcPath = path.join(AUTH_DIR, file);
                        const destPath = path.join(mainAuthDir, file);
                        fs.copyFileSync(srcPath, destPath);
                    }
                    
                    console.log('\n✅ Credentials successfully copied to main application\n');
                    console.log('✅ You can now restart the main bot application\n');
                } catch (err) {
                    console.error('❌ Failed to copy credentials to main app:', err);
                }
                
                console.log('Press Ctrl+C to close this process and return to the main bot');
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
                console.log(`\n[Connection] Connection closed due to ${errorMessage} (Status code: ${statusCode})`);

                // Special handling for common cloud environment errors
                const isConnectionFailure = errorMessage.includes('Connection Failure');
                
                // In Replit, we often see 405 status codes which require special handling
                if (statusCode === 405 || isConnectionFailure) {
                    console.log('[Connection] Cloud environment restriction detected (405 error)');
                    
                    // For 405 errors, use a completely different browser fingerprint on each retry
                    // This has been shown to work around Replit restrictions in some cases
                    if (retryCount < 5) {
                        retryCount++;
                        
                        // Using global browserOptions array defined above
                        
                        // Get a browser option based on retry count
                        const browserOption = browserOptions[retryCount % browserOptions.length];
                        console.log(`[Connection] Trying with ${browserOption[0]} browser fingerprint (attempt ${retryCount})`);
                        
                        // Use a shorter retry delay for 405 errors
                        const retryDelay = 5000;
                        console.log(`[Connection] Retrying in ${retryDelay/1000} seconds`);
                        
                        // Clear session before retry with a new browser fingerprint
                        clearSession();
                        
                        clearReconnectTimer();
                        reconnectTimer = setTimeout(() => {
                            isConnecting = false;
                            connectionLock = false;
                            startConnection();
                        }, retryDelay);
                    } else {
                        console.log('[Connection] Max 405-specific retries reached');
                        clearSession();
                        // Exit with a specific code for 405 errors
                        process.exit(3);
                    }
                }
                // Standard handling for regular disconnects
                else if (statusCode === DisconnectReason.loggedOut || 
                    statusCode === DisconnectReason.connectionClosed ||
                    statusCode === DisconnectReason.connectionLost ||
                    statusCode === DisconnectReason.connectionReplaced ||
                    statusCode === DisconnectReason.timedOut) {

                    if (retryCount >= MAX_RETRIES) {
                        console.log('[Connection] Max retries reached, clearing session and restarting...');
                        clearSession();
                        process.exit(1);
                        return;
                    }

                    retryCount++;
                    const retryDelay = Math.min(5000 * Math.pow(2, retryCount - 1), 300000);
                    console.log(`[Connection] Retry attempt ${retryCount}/${MAX_RETRIES} in ${retryDelay/1000} seconds`);

                    clearReconnectTimer();
                    reconnectTimer = setTimeout(() => {
                        isConnecting = false;
                        connectionLock = false;
                        startConnection();
                    }, retryDelay);
                } else {
                    console.log('[Connection] Not reconnecting - non-recoverable error');
                    process.exit(1);
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

        return sock;
    } catch (error) {
        console.log('[Error]', error);

        if (retryCount < MAX_RETRIES) {
            retryCount++;
            const retryDelay = Math.min(5000 * Math.pow(2, retryCount - 1), 300000);
            console.log(`[Connection] Retry attempt ${retryCount}/${MAX_RETRIES} in ${retryDelay/1000} seconds`);

            clearReconnectTimer();
            reconnectTimer = setTimeout(() => {
                isConnecting = false;
                connectionLock = false;
                startConnection();
            }, retryDelay);
        } else {
            console.log('[Connection] Max retries reached');
            process.exit(1);
        }
    } finally {
        isConnecting = false;
        connectionLock = false;
    }
}

function clearReconnectTimer() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}

function clearSession() {
    try {
        if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            fs.mkdirSync(AUTH_DIR, { recursive: true });
            console.log('[Auth] Session cleared successfully');
        }
    } catch (err) {
        console.error('[Auth] Error clearing session:', err);
    }
}

// Start connection with retry logic
function startConnection() {
    console.log('[Connection] Starting WhatsApp connection...');
    connectToWhatsApp().catch(err => {
        console.log('[Connection] Error connecting to WhatsApp:', err);
        setTimeout(startConnection, 10000);
    });
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('Received SIGINT, cleaning up...');
    clearReconnectTimer();
    clearSession();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, cleaning up...');
    clearReconnectTimer();
    clearSession();
    process.exit(0);
});