/**
 * Ultra Simple WhatsApp QR Generator
 * Simplified for maximum reliability in Replit
 */

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Auth directory
const AUTH_DIR = './auth_info';

// Ensure auth directory exists and is empty
if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
}
fs.mkdirSync(AUTH_DIR, { recursive: true });

console.clear();
console.log('\n=============================');
console.log('WhatsApp QR Code Generator');
console.log('=============================');
console.log('1. Wait for QR code to appear below');
console.log('2. Open WhatsApp on your phone');
console.log('3. Tap Menu or Settings and select Linked Devices');
console.log('4. Tap on "Link a Device"');
console.log('5. Point your phone at this screen to capture the QR code');
console.log('=============================\n');

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ['WhatsApp Bot', 'Chrome', '106.0.5249.168'],
        version: [2, 2323, 4],
        syncFullHistory: false,
        connectTimeoutMs: 60000
    });
    
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n========== SCAN THIS QR CODE ==========\n');
            qrcode.generate(qr, { small: true });
            console.log('\n========================================\n');
            console.log('QR Code refreshes every 20 seconds if not scanned');
        }
        
        if (connection === 'open') {
            console.log('\n✅ CONNECTED SUCCESSFULLY!\n');
            console.log('Your WhatsApp bot is now authenticated.');
            console.log('You can close this window and start your bot application.\n');
        }
        
        if (connection === 'close') {
            console.log('\nConnection closed. Attempting to reconnect...\n');
            connectToWhatsApp();
        }
    });
    
    sock.ev.on('creds.update', saveCreds);
}

// Start the connection
connectToWhatsApp().catch(err => console.log('Connection error:', err));

// Keep the process running
process.stdin.resume();

// Handle graceful exit
process.on('SIGINT', () => {
    console.log('\nExiting...');
    process.exit(0);
});