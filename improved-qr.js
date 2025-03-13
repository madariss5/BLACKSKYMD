/**
 * Improved WhatsApp QR Generator for BLACKSKY-MD
 * Optimized for better compatibility and reliability with WhatsApp
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const logger = pino({ level: 'info' });

// Auth directory - use the same one as bot-handler.js
const AUTH_DIR = './auth_info_qr';

// Make sure auth directory exists
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

console.clear();
console.log('\n=============================');
console.log('BLACKSKY-MD QR Code Generator');
console.log('=============================');
console.log('1. Wait for QR code to appear below');
console.log('2. Open WhatsApp on your phone');
console.log('3. Tap Menu or Settings and select Linked Devices');
console.log('4. Tap on "Link a Device"');
console.log('5. Point your phone at this screen to capture the QR code');
console.log('=============================\n');

async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: ['BLACKSKY-MD', 'Chrome', '121.0.0'],
            version: [2, 3000, 1019707846], // Use the latest version
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            logger: pino({ level: 'silent' }),
            emitOwnEvents: false,
            defaultQueryTimeoutMs: 60000,
            phoneNumber: process.env.BOT_NUMBER,
            getMessage: async () => {
                return { conversation: 'Hello!' };
            }
        });
        
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('\n========== SCAN THIS QR CODE ==========\n');
                qrcode.generate(qr, { small: true });
                console.log('\n========================================\n');
                console.log('QR Code refreshes every 20 seconds if not scanned');
                console.log('Make sure to scan it quickly with your phone!');
            }
            
            if (connection === 'open') {
                console.log('\n✅ CONNECTED SUCCESSFULLY!\n');
                console.log('Your BLACKSKY-MD bot is now authenticated.');
                console.log('You can close this window and start your bot application.');
                console.log('Credentials saved to:', AUTH_DIR);
                console.log('\nRestart your bot now to use the new connection!\n');
                process.exit(0);
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('\nConnection closed:', lastDisconnect?.error?.message || 'Unknown reason');
                if (shouldReconnect) {
                    console.log('Attempting to reconnect...\n');
                    setTimeout(connectToWhatsApp, 5000);
                } else {
                    console.log('Cannot reconnect - you have been logged out.\n');
                    // Clear auth data
                    if (fs.existsSync(AUTH_DIR)) {
                        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                        fs.mkdirSync(AUTH_DIR, { recursive: true });
                    }
                    setTimeout(connectToWhatsApp, 5000);
                }
            }
        });
        
        sock.ev.on('creds.update', saveCreds);
    } catch (err) {
        console.error('Connection error:', err);
        console.log('Retrying in 10 seconds...');
        setTimeout(connectToWhatsApp, 10000);
    }
}

// Start the connection
connectToWhatsApp();

// Keep the process running
process.stdin.resume();

// Handle graceful exit
process.on('SIGINT', () => {
    console.log('\nExiting...');
    process.exit(0);
});