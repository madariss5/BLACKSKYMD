/**
 * Replit-Optimized WhatsApp QR Code Generator
 * Designed for maximum compatibility with WhatsApp's latest security
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const qrcodeWeb = require('qrcode');
const path = require('path');
const { backupCredentials, restoreAuthFiles } = require('./src/utils/credentialsBackup');

// Constants
const PORT = 5000;
const AUTH_DIR = './auth_info_replit';
const BROWSER_ID = `BLACKSKY-REPLIT-${Date.now().toString().slice(-6)}`;
const QR_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 5;
const RETRY_INTERVAL = 10000;

// Global variables
let qr = null;
let sock = null;
let connectionStatus = 'disconnected';
let qrGenerationCount = 0;
let retryCount = 0;
let qrTimeout = null;
let webQRcode = null;

// Clean auth state
if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
}
fs.mkdirSync(AUTH_DIR, { recursive: true });

// Express routes for QR display
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Connection - Replit Optimized</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="refresh" content="30">
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    text-align: center; 
                    margin: 0;
                    padding: 20px;
                    background-color: #f0f2f5;
                }
                h1 { 
                    color: #128C7E; 
                    font-size: 24px;
                    margin-bottom: 5px;
                }
                h2 {
                    color: #666;
                    font-size: 16px;
                    font-weight: normal;
                    margin-top: 0;
                }
                .qr-container {
                    background-color: white;
                    border-radius: 10px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    padding: 20px;
                    max-width: 500px;
                    margin: 20px auto;
                }
                .qr-code {
                    padding: 20px;
                    display: flex;
                    justify-content: center;
                }
                .qr-code img {
                    max-width: 300px;
                    height: auto;
                }
                .button {
                    background-color: #128C7E;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-top: 10px;
                    font-size: 14px;
                }
                .status {
                    margin: 20px 0;
                    padding: 10px;
                    border-radius: 5px;
                }
                .status.connecting { background-color: #FFF3CD; color: #856404; }
                .status.connected { background-color: #D4EDDA; color: #155724; }
                .status.disconnected { background-color: #F8D7DA; color: #721C24; }
                .instructions {
                    background-color: #f8f9fa;
                    border-radius: 5px;
                    padding: 15px;
                    text-align: left;
                    margin-top: 20px;
                }
                .instructions ol { padding-left: 20px; }
                .instructions li { margin-bottom: 5px; }
                .loader {
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #128C7E;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    animation: spin 1s linear infinite;
                    margin: 20px auto;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .pulsing {
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
                .connection-info {
                    margin-top: 20px;
                    font-size: 12px;
                    color: #666;
                }
                .counter {
                    padding: 3px 8px;
                    background-color: #128C7E;
                    color: white;
                    border-radius: 10px;
                    font-size: 12px;
                    display: inline-block;
                    margin-left: 5px;
                }
            </style>
        </head>
        <body>
            <h1>BLACKSKY-MD WhatsApp Bot</h1>
            <h2>Replit-Optimized QR Code Generator</h2>
            
            <div class="qr-container">
                <div class="status ${connectionStatus}">
                    Status: ${connectionStatus.toUpperCase()} 
                    ${connectionStatus === 'connecting' ? '<span class="counter">Attempt ' + (retryCount + 1) + '/' + MAX_RETRIES + '</span>' : ''}
                </div>
                
                <div class="qr-code">
                    ${webQRcode 
                        ? `<img src="${webQRcode}" alt="WhatsApp QR Code" />`
                        : connectionStatus === 'connecting' 
                            ? '<div class="loader"></div><p class="pulsing">Generating QR code...</p>' 
                            : connectionStatus === 'connected' 
                                ? '<p>✅ Successfully connected to WhatsApp!</p>' 
                                : '<p>Waiting to connect to WhatsApp servers...</p>'
                    }
                </div>
                
                <button class="button" onclick="location.reload()">Refresh QR Code</button>
                
                <div class="connection-info">
                    <p>Browser ID: ${BROWSER_ID}</p>
                    <p>QR Code Count: ${qrGenerationCount}</p>
                    <p>Last Updated: ${new Date().toLocaleString()}</p>
                </div>
            </div>
            
            <div class="instructions">
                <h3>How to connect your WhatsApp:</h3>
                <ol>
                    <li>Open WhatsApp on your phone</li>
                    <li>Tap on Settings (three dots) → Linked Devices</li>
                    <li>Tap on "Link a Device"</li>
                    <li>When the camera opens, point it at this screen to scan the QR code</li>
                </ol>
                <p><strong>Note:</strong> The QR code refreshes every 30 seconds. If scanning fails, click the Refresh button.</p>
                <p><strong>Important:</strong> Once connected, you will need to restart the main bot to use your new connection.</p>
            </div>
        </body>
        </html>
    `);
});

// Start connection with improved error handling
async function startConnection() {
    try {
        // Reset QR info
        qr = null;
        webQRcode = null;
        
        console.log('\n[REPLIT-QR] Starting WhatsApp connection session...');
        console.log('[REPLIT-QR] Browser ID:', BROWSER_ID);
        
        // Setup authentication state
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        
        // Create socket with special configuration for Replit
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: [BROWSER_ID, 'Chrome', '110.0.0'],
            version: [2, 2323, 4],
            connectTimeoutMs: 60000,
            logger: pino({ level: 'silent' }),
            markOnlineOnConnect: false,
            keepAliveIntervalMs: 10000,
            syncFullHistory: false,
            retryRequestDelayMs: 1000,
            transactionOpts: {
                maxCommitRetries: 5,
                delayBetweenTriesMs: 1000
            }
        });
        
        connectionStatus = 'connecting';
        console.log('[REPLIT-QR] Created WhatsApp socket connection');
        
        // Handle connection state changes
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr: receivedQr } = update;
            
            // Handle QR code updates
            if (receivedQr) {
                qr = receivedQr;
                qrGenerationCount++;
                console.log(`\n[REPLIT-QR] New QR code generated (${qrGenerationCount}):`);
                
                // Display QR code in terminal
                qrcode.generate(receivedQr, { small: true });
                
                try {
                    // Generate QR code for web
                    webQRcode = await qrcodeWeb.toDataURL(receivedQr);
                    console.log('[REPLIT-QR] QR code updated for web interface');
                } catch (err) {
                    console.error('[REPLIT-QR] Error generating web QR code:', err.message);
                }
                
                // Set QR timeout to refresh connection
                clearTimeout(qrTimeout);
                qrTimeout = setTimeout(() => {
                    console.log('[REPLIT-QR] QR code expired, refreshing connection...');
                    if (sock) {
                        sock.end();
                        sock = null;
                    }
                    startConnection();
                }, QR_TIMEOUT);
            }
            
            // Handle connection state
            if (connection) {
                console.log('[REPLIT-QR] Connection state:', connection);
                connectionStatus = connection;
                
                if (connection === 'open') {
                    console.log('\n[REPLIT-QR] ✅ SUCCESSFULLY CONNECTED!');
                    
                    // Clear QR timeout
                    clearTimeout(qrTimeout);
                    
                    // Get connected user details
                    try {
                        const user = sock.user;
                        console.log('[REPLIT-QR] Connected as:', user.name || user.id.split(':')[0]);
                    } catch (e) {
                        console.log('[REPLIT-QR] Could not get user details:', e.message);
                    }
                    
                    // Backup credentials
                    try {
                        await saveCreds();
                        console.log('[REPLIT-QR] Session credentials saved locally');
                        
                        // Backup to custom backup system
                        if (sock.authState && sock.authState.creds) {
                            const backupFile = await backupCredentials(sock.authState.creds);
                            console.log('[REPLIT-QR] Created backup at:', backupFile);
                        }
                    } catch (err) {
                        console.error('[REPLIT-QR] Error saving credentials:', err.message);
                    }
                    
                    console.log('\n[REPLIT-QR] You can now run the main bot with:');
                    console.log('node src/index.js\n');
                    
                    // Exit after successful connection and backup
                    setTimeout(() => {
                        console.log('[REPLIT-QR] Session successfully established. Exiting QR generator...');
                        process.exit(0);
                    }, 5000);
                }
            }
            
            // Handle disconnection
            if (connection === 'close') {
                clearTimeout(qrTimeout);
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldRetry = statusCode !== DisconnectReason.loggedOut;
                
                console.log(`[REPLIT-QR] Connection closed with status: ${statusCode}`);
                connectionStatus = 'disconnected';
                
                // Map common error codes to explanations
                const errorDescriptions = {
                    401: 'Authentication failed - session expired',
                    403: 'Access forbidden - possibly IP blocked',
                    408: 'Connection timeout - server too slow to respond',
                    429: 'Too many requests - rate limited',
                    440: 'Session expired - need new login',
                    500: 'Server error - WhatsApp servers having issues',
                    501: 'Not implemented - feature not supported',
                    502: 'Bad gateway - connection issue with WhatsApp',
                    503: 'Service unavailable - WhatsApp servers down',
                    504: 'Gateway timeout - connection to WhatsApp timed out'
                };
                
                if (errorDescriptions[statusCode]) {
                    console.log(`[REPLIT-QR] Error explanation: ${errorDescriptions[statusCode]}`);
                }
                
                if (shouldRetry && retryCount < MAX_RETRIES) {
                    retryCount++;
                    const delay = RETRY_INTERVAL * retryCount;
                    console.log(`[REPLIT-QR] Retry attempt ${retryCount}/${MAX_RETRIES} in ${delay/1000} seconds...`);
                    
                    setTimeout(() => {
                        if (sock) {
                            sock.end();
                            sock = null;
                        }
                        startConnection();
                    }, delay);
                } else if (!shouldRetry) {
                    console.log('[REPLIT-QR] User logged out, not reconnecting');
                } else {
                    console.log('[REPLIT-QR] Maximum retry attempts reached');
                }
            }
        });
        
        // Handle credentials update
        sock.ev.on('creds.update', async (updatedCreds) => {
            await saveCreds();
            console.log('[REPLIT-QR] Credentials updated and saved');
        });
        
    } catch (error) {
        console.error('[REPLIT-QR] Connection error:', error);
        console.error('[REPLIT-QR] Stack trace:', error.stack);
        connectionStatus = 'disconnected';
        
        setTimeout(() => {
            console.log('[REPLIT-QR] Restarting connection after error...');
            startConnection();
        }, 5000);
    }
}

// Start server and connection
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[REPLIT-QR] Web interface running at http://localhost:${PORT}`);
    console.log('[REPLIT-QR] Starting WhatsApp connection...');
    
    // First try to restore credentials from backup
    restoreAuthFiles().then(restored => {
        if (restored) {
            console.log('[REPLIT-QR] Successfully restored credentials from backup');
        } else {
            console.log('[REPLIT-QR] No valid backup found, starting fresh connection');
        }
        
        // Start WhatsApp connection
        startConnection();
    });
});