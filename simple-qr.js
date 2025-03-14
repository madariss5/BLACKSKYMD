/**
 * Ultra Simple WhatsApp QR Generator
 * Simplified for maximum reliability in Replit
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

// Constants
const PORT = 5000;  // Use port 5000 which is open on Replit
const AUTH_DIR = './auth_info_simple';

// Create auth directory if it doesn't exist
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
} else {
    // Clear auth directory to force new QR code
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Global state
let qrText = '';
let webQR = '';

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
    startConnection();
});

// Connect to WhatsApp
async function connectToWhatsApp() {
    try {
        // Clear session first
        console.log('[Auth] Preparing fresh session');
        
        // Get auth state
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        
        // Connect to WhatsApp with minimal settings for reliable QR code generation
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: ['BLACKSKY-MD', 'Chrome', '110.0.0'],
            version: [2, 2323, 4],
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
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
                await saveCreds();
                process.exit(0); // Exit once connected
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`\n[Connection] Connection closed due to ${lastDisconnect?.error?.output?.payload?.message || 'unknown reason'}`);
                
                if (shouldReconnect) {
                    console.log('[Connection] Reconnecting...');
                    startConnection();
                } else {
                    console.log('[Connection] Not reconnecting - logged out');
                    process.exit(1);
                }
            }
        });
        
        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);
        
        return sock;
    } catch (error) {
        console.log('[Error]', error);
        setTimeout(startConnection, 10000);
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