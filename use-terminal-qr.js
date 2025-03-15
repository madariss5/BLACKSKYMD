/**
 * Terminal QR Quick Access
 * Directly launches the most reliable connection method
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Settings
const AUTH_DIR = './auth_info_terminal';
let connectionAttempts = 0;
const MAX_RETRIES = 3;
const browserOptions = [
    ['Firefox', '115.0'],
    ['Chrome', '120.0.0.0'],
    ['Edge', '120.0.0.0'],
    ['Safari', '17.0'],
    ['Opera', '105.0.0.0']
];

// Create auth directory if it doesn't exist
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Clear auth state if needed
async function clearAuthState() {
    if (fs.existsSync(AUTH_DIR)) {
        const files = fs.readdirSync(AUTH_DIR);
        for (const file of files) {
            fs.unlinkSync(path.join(AUTH_DIR, file));
        }
        console.log('🧹 Auth state cleared');
    }
}

// Function to start WhatsApp connection
async function startWhatsAppConnection() {
    console.log('▶️ Starting WhatsApp Terminal QR connection...');
    
    // Get browser fingerprint based on attempt number
    const browser = browserOptions[connectionAttempts % browserOptions.length];
    console.log(`🌐 Using ${browser[0]} browser fingerprint (attempt ${connectionAttempts + 1}/${MAX_RETRIES})`);
    
    // Get auth state
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    
    // Create a unique device ID
    const deviceId = `BLACKSKY-TERMINAL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Create socket
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: [deviceId, browser[0], browser[1]],
        syncFullHistory: false
    });
    
    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // If QR code is received
        if (qr) {
            console.log('\n📱 SCAN THIS QR CODE WITH YOUR PHONE:');
            qrcode.generate(qr, { small: true });
            console.log('\n⏳ Waiting for you to scan the QR code...');
        }
        
        // If connected successfully
        if (connection === 'open') {
            console.log('✅ SUCCESSFULLY CONNECTED TO WHATSAPP!');
            
            // Copy auth files to main directory
            try {
                const mainAuthDir = './auth_info_baileys';
                if (!fs.existsSync(mainAuthDir)) {
                    fs.mkdirSync(mainAuthDir, { recursive: true });
                }
                
                const files = fs.readdirSync(AUTH_DIR);
                for (const file of files) {
                    fs.copyFileSync(
                        path.join(AUTH_DIR, file),
                        path.join(mainAuthDir, file)
                    );
                }
                
                console.log('📋 Copied authentication files to main directory');
                console.log('🎉 Your bot is now ready to use!');
            } catch (err) {
                console.error('❌ Error copying auth files:', err);
            }
        }
        
        // If disconnected
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
            
            console.log(`❌ Connection closed due to ${errorMessage}`);
            
            // Check if 405 error (common in cloud environments)
            if (statusCode === 405) {
                if (connectionAttempts < MAX_RETRIES - 1) {
                    connectionAttempts++;
                    const delay = 5000 * Math.pow(2, connectionAttempts - 1); // Exponential backoff
                    console.log(`⏱️ Retrying in ${delay/1000} seconds... (Attempt ${connectionAttempts+1}/${MAX_RETRIES})`);
                    
                    setTimeout(startWhatsAppConnection, delay);
                } else {
                    console.log('❌ Connection failed after multiple attempts.');
                    console.log('The cloud environment may be blocked by WhatsApp.');
                    console.log('Press Ctrl+C to exit and try again.');
                }
            } else if (statusCode !== DisconnectReason.loggedOut) {
                // For general errors (not logouts), retry
                if (connectionAttempts < MAX_RETRIES - 1) {
                    connectionAttempts++;
                    console.log(`⏱️ Retrying in 5 seconds... (Attempt ${connectionAttempts+1}/${MAX_RETRIES})`);
                    setTimeout(startWhatsAppConnection, 5000);
                } else {
                    console.log('❌ Connection failed after multiple attempts.');
                    console.log('Press Ctrl+C to exit and try again.');
                }
            } else {
                console.log('❌ Device logged out. Please try again.');
            }
        }
    });
    
    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);
}

// Display welcome message
console.log('\n===========================================');
console.log('📱 TERMINAL QR CODE GENERATOR');
console.log('===========================================');
console.log('This tool generates a WhatsApp QR code in');
console.log('the terminal for you to scan with your phone.');
console.log('===========================================\n');

// Start the connection
startWhatsAppConnection();