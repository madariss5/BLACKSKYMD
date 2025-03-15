/**
 * Local WhatsApp Connection Script
 * This script is designed to be run on your local machine (not in Replit)
 * It will help you establish a connection and provide credentials for your bot
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Constants
const AUTH_DIR = './auth_info_local';
let isConnecting = false;
let retryCount = 0;

// Browser options for rotation if needed
const browserOptions = [
    ['Firefox', '115.0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0'],
    ['Chrome', '120.0.0.0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'],
    ['Edge', '120.0.0.0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'],
    ['Safari', '17.0', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'],
    ['Opera', '105.0.0.0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 OPR/105.0.0.0']
];

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

async function connectToWhatsApp() {
    if (isConnecting) {
        console.log('Connection attempt already in progress...');
        return;
    }
    
    try {
        isConnecting = true;
        
        // Clear existing auth state for a fresh start
        if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            fs.mkdirSync(AUTH_DIR, { recursive: true });
        }
        
        console.log('\n▶️ Starting WhatsApp Connection...\n');
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        
        // Select a browser option based on retry count
        const browserOption = browserOptions[retryCount % browserOptions.length];
        console.log(`🌐 Using ${browserOption[0]} browser fingerprint (attempt ${retryCount + 1})`);
        
        // Generate a unique device ID for this attempt
        const deviceId = `BLACKSKY-LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        // Create connection with optimized settings
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,  // This is the key setting for terminal QR
            browser: [deviceId, browserOption[0], browserOption[1]],
            version: [2, 2323, 4],
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            retryRequestDelayMs: 2000,
            emitOwnEvents: false,
            markOnlineOnConnect: false, // Avoid extra connections
            syncFullHistory: false, // Skip history sync for faster connection
            userAgent: browserOption[2] // Use user agent matching the browser fingerprint
        });
        
        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('\n📱 Please scan this QR code with your WhatsApp app:\n');
                // QR code is automatically printed to terminal due to printQRInTerminal: true
            }
            
            if (connection === 'open') {
                console.log('\n✅ Successfully connected to WhatsApp!\n');
                console.log('✅ Auth credentials saved to:', AUTH_DIR);
                console.log('✅ Now saving credentials for upload to your bot\n');
                
                // Create a zip file with the auth credentials
                try {
                    const archiver = require('archiver');
                    const output = fs.createWriteStream('./whatsapp-credentials.zip');
                    const archive = archiver('zip', {
                        zlib: { level: 9 } // Maximum compression
                    });
                    
                    archive.pipe(output);
                    archive.directory(AUTH_DIR, false);
                    await archive.finalize();
                    
                    console.log('✅ Credentials zip file created: whatsapp-credentials.zip');
                    console.log('✅ Upload this file to your Replit project and extract it to auth_info_baileys directory');
                } catch (err) {
                    console.log('⚠️ Could not create zip file. Please manually copy the auth_info_local directory to your bot.');
                }
                
                await saveCreds();
                console.log('\nPress Ctrl+C to exit.');
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log(`\n❌ Connection closed due to ${lastDisconnect?.error?.message || 'unknown reason'}`);
                
                if (shouldReconnect && retryCount < 3) {
                    retryCount++;
                    const delay = 5000 * retryCount;
                    console.log(`⏱️ Retrying in ${delay/1000} seconds... (Attempt ${retryCount}/3)`);
                    setTimeout(connectToWhatsApp, delay);
                } else {
                    if (statusCode === DisconnectReason.loggedOut) {
                        console.log('❌ Logged out from WhatsApp. Please try again with a fresh QR code.');
                    } else {
                        console.log('❌ Connection failed after multiple attempts.');
                    }
                    console.log('\nPress Ctrl+C to exit and try again.');
                }
            }
        });
        
        // Save credentials on update
        sock.ev.on('creds.update', saveCreds);
        
    } catch (err) {
        console.error('❌ Error in connection:', err);
        
        if (retryCount < 3) {
            retryCount++;
            const delay = 5000 * retryCount;
            console.log(`⏱️ Retrying in ${delay/1000} seconds... (Attempt ${retryCount}/3)`);
            setTimeout(connectToWhatsApp, delay);
        } else {
            console.log('❌ Maximum retry attempts reached. Please try again later.');
            console.log('\nPress Ctrl+C to exit and try again.');
        }
    } finally {
        isConnecting = false;
    }
}

// Start connection process
connectToWhatsApp();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    process.exit(0);
});

console.log(`
=============================================================
        LOCAL WHATSAPP CONNECTION HELPER
=============================================================

This script should be run on your local machine, not on Replit.

Steps to use:
1. Download this file to your local computer
2. Install Node.js if you don't have it already
3. Open a terminal/command prompt in the folder with this file
4. Run these commands:

   npm install @whiskeysockets/baileys qrcode-terminal archiver

5. Then run:

   node local-connection.js

6. Scan the QR code with WhatsApp
7. Upload the generated whatsapp-credentials.zip to your Replit
8. Extract the zip to the auth_info_baileys directory

Note: WhatsApp restricts connections from cloud environments like
Replit, which is why you need to run this locally first.
=============================================================
`);