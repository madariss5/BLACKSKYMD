/**
 * Terminal-Only QR Code Generator
 * Most reliable method for connecting to WhatsApp in restricted environments
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Constants - sharing auth directory with main app for seamless transition
const AUTH_DIR = './auth_info_baileys';
let isConnecting = false;
let retryCount = 0;

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
        
        console.log('\n▶️ Starting WhatsApp Terminal QR connection...\n');
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        
        // Create connection with optimized settings
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,  // This is the key setting for terminal QR
            browser: [`BLACKSKY-TERMINAL-${Date.now()}`, 'Chrome', '108.0.0'],
            version: [2, 2323, 4],
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            emitOwnEvents: false
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
                console.log('✅ You can now run the main bot application\n');
                await saveCreds();
                
                console.log('\nPress Ctrl+C to exit this process and start the main bot.\n');
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