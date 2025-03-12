/**
 * 𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻 QR Terminal Display
 * Displays QR code in the terminal and logs it to console
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

// Auth directory
const AUTH_DIRECTORY = path.join(process.cwd(), 'auth_info');

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIRECTORY)) {
    fs.mkdirSync(AUTH_DIRECTORY, { recursive: true });
}

console.log('𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻 QR Terminal Connector');
console.log('=============================');
console.log('Connecting to WhatsApp servers...');
console.log('Watch this terminal for a QR code to appear.');
console.log('When it appears, scan it with your WhatsApp mobile app.');
console.log('=============================\n');

// Start WhatsApp connection
async function startWhatsAppConnection() {
    try {
        // Ensure auth directory is clean if having issues
        if (process.argv.includes('--clear-auth')) {
            console.log('Clearing auth directory...');
            if (fs.existsSync(AUTH_DIRECTORY)) {
                fs.rmSync(AUTH_DIRECTORY, { recursive: true, force: true });
                fs.mkdirSync(AUTH_DIRECTORY, { recursive: true });
            }
        }
        
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIRECTORY);
        
        // Create WhatsApp socket connection
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,  // This will print the QR in the terminal
            browser: ['𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻', 'Chrome', '100.0.0'],
            logger: pino({ level: 'error' }),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000
        });
        
        // Handle connection events
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                // We got a QR code, display it in terminal
                console.log('\n');
                console.log('QR CODE RECEIVED:');
                console.log('=================');
                qrcode.generate(qr, { small: true });
                console.log('=================');
                console.log('Scan this QR code with your WhatsApp app to log in');
                console.log('The QR code will expire after 20 seconds if not scanned');
                console.log('\n');
            }
            
            if (connection === 'open') {
                console.log('\n=============================');
                console.log('✓ CONNECTED SUCCESSFULLY!');
                console.log('Your WhatsApp bot is now online.');
                console.log('=============================\n');
                
                await saveCreds();
                
                console.log('Authentication credentials saved.');
                console.log('You can now start your main bot application.');
                
                // Optionally exit after successful connection
                if (process.argv.includes('--exit-on-connect')) {
                    console.log('Exiting as requested...');
                    process.exit(0);
                }
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log(`\nConnection closed! Status code: ${statusCode}`);
                console.log(`Reason: ${lastDisconnect?.error?.message || 'Unknown'}`);
                
                if (shouldReconnect) {
                    console.log('Attempting to reconnect...');
                    setTimeout(startWhatsAppConnection, 5000);
                } else {
                    console.log('Not reconnecting - logged out or authentication failed.');
                    
                    if (process.argv.includes('--force-reconnect')) {
                        console.log('Forcing reconnection as requested...');
                        setTimeout(startWhatsAppConnection, 10000);
                    }
                }
            }
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        return sock;
    } catch (err) {
        console.error('Error starting WhatsApp connection:', err);
        console.log('Retrying connection in 5 seconds...');
        setTimeout(startWhatsAppConnection, 5000);
        return null;
    }
}

// Start WhatsApp connection
startWhatsAppConnection()
    .then(() => {
        console.log('WhatsApp initialization complete');
    })
    .catch(err => {
        console.error('Failed to initialize WhatsApp:', err);
    });

// Handle process exit
process.on('SIGINT', () => {
    console.log('\nExiting WhatsApp QR Terminal...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nExiting WhatsApp QR Terminal...');
    process.exit(0);
});