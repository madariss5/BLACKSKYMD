/**
 * 𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻 QR Terminal Display
 * Displays QR code in the terminal and logs it to console
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Constants
const AUTH_DIR = './auth_info_terminal';

// Clear auth directory to force QR code generation
if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
}
fs.mkdirSync(AUTH_DIR, { recursive: true });

async function startWhatsAppConnection() {
    // Setup authentication state
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    
    // Generate a random browser identifier to avoid conflicts
    const browserId = `BLACKSKY-${Date.now().toString().slice(-4)}`;
    
    console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
    console.log('┃     BLACKSKY-MD WHATSAPP BOT       ┃');
    console.log('┃    SIMPLIFIED QR CODE GENERATOR    ┃');
    console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n');

    console.log('⏳ Connecting to WhatsApp...');
    console.log('⏳ Browser ID:', browserId);
    
    // Create WhatsApp socket with minimal settings
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: [browserId, 'Chrome', '110.0.0'],
        version: [2, 2323, 4],
        connectTimeoutMs: 60000,
        // Use pino for proper logger
        logger: require('pino')({ level: 'silent' }), 
    });
    
    // Handle connection updates
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n📱 SCAN THIS QR CODE WITH YOUR WHATSAPP APP:\n');
            qrcode.generate(qr, { small: true });
            console.log('\n⚠️ QR Code expires in 20 seconds. If expired, wait for a new one.');
        }
        
        if (connection === 'connecting') {
            console.log('🔄 Status: CONNECTING...');
        }
        
        if (connection === 'open') {
            console.log('\n✅ SUCCESSFULLY CONNECTED TO WHATSAPP!\n');
            
            // Display user information if available
            try {
                const user = sock.user;
                console.log('👤 Connected as:', user.name || user.verifiedName || user.id.split(':')[0]);
            } catch (err) {
                console.log('⚠️ Could not get user details');
            }
            
            console.log('\n📱 Your WhatsApp bot is now ready to use!');
            console.log('\n💾 Session saved. You can now run your main bot with:');
            console.log('\n   node src/index.js\n');
            
            // Save credentials and exit
            saveCreds();
            setTimeout(() => {
                process.exit(0);
            }, 5000);
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(`\n❌ Connection closed. Status code: ${statusCode}`);
            
            // Map some common status codes to meaningful messages
            const errorMessages = {
                401: 'Unauthorized. Your WhatsApp session has expired.',
                403: 'Forbidden. Your IP address might be blocked.',
                408: 'Request timeout. Server took too long to respond.',
                429: 'Too many requests. You are being rate limited.',
                440: 'Session expired. Please reconnect.',
                500: 'Server error. Try again later.',
                501: 'Not implemented. Feature not supported.',
                502: 'Bad gateway. WhatsApp servers are having issues.',
                503: 'Service unavailable. WhatsApp is experiencing problems.',
                504: 'Gateway timeout. Connection to WhatsApp servers timed out.'
            };
            
            if (errorMessages[statusCode]) {
                console.log(`📌 ${errorMessages[statusCode]}`);
            }
            
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log('🔄 Reconnecting in 5 seconds...');
                setTimeout(startWhatsAppConnection, 5000);
            } else {
                console.log('⛔ Cannot reconnect - user logged out.');
            }
        }
    });
    
    // Save credentials on updates
    sock.ev.on('creds.update', saveCreds);
    
    return sock;
}

// Start the connection
console.log('Starting WhatsApp QR generation...');
startWhatsAppConnection();