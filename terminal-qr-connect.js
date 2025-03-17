/**
 * Terminal QR Code Connection for WhatsApp Bot
 * This script prioritizes reliable QR code generation in terminal environment
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Configuration
const AUTH_FOLDER = './auth_info_terminal_qr';
const MAX_QR_ATTEMPTS = 20;
const CONNECTION_TIMEOUT = 60000;

// Ensure auth folder exists
if (!fs.existsSync(AUTH_FOLDER)) {
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
}

// Connection state tracking
let connectionAttempts = 0;
let qrAttempts = 0;
let qrGenerated = false;

// Start WhatsApp connection
async function connectToWhatsApp() {
    try {
        connectionAttempts++;
        console.log(`\nConnection attempt ${connectionAttempts}`);
        
        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
        
        // Connection configuration
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,  // Enable built-in QR printing
            browser: ['Firefox', 'Desktop', '105.0.1'],
            connectTimeoutMs: CONNECTION_TIMEOUT,
            qrTimeout: 180000,  // 3 minutes for QR scanning
            defaultQueryTimeoutMs: 60000,
            linkPreviewApiKey: false  // Disable link previews for better performance
        });
        
        // Connection update handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // Display QR code and ensure it's visible
            if (qr) {
                qrAttempts++;
                qrGenerated = true;
                
                // Clear terminal and display prominent header
                console.clear();
                console.log('\n\n');
                console.log('▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄');
                console.log('█         BLACKSKY-MD WHATSAPP QR CODE         █');
                console.log('▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀');
                console.log('\n1. Open WhatsApp on your phone');
                console.log('2. Tap Menu or Settings > Linked Devices');
                console.log('3. Tap on "Link a Device"');
                console.log('4. Point your phone camera to scan this QR code\n\n');
                
                // Try to use the QR resizer for better visibility
                try {
                    const qrResizer = require('./src/qr-resizer');
                    qrResizer.generateCompactQR(qr, { small: true });
                } catch (err) {
                    // Fallback to standard QR code if resizer not available
                    qrcode.generate(qr, { small: true });
                }
                
                console.log(`\n[QR code generated - attempt ${qrAttempts}/${MAX_QR_ATTEMPTS}]`);
                console.log('\nWaiting for you to scan the QR code...');
            }
            
            // Handle connection status
            if (connection === 'open') {
                console.log('\n✅ CONNECTED TO WHATSAPP SUCCESSFULLY!\n');
                qrAttempts = 0;
                connectionAttempts = 0;
                
                // Save auth state to other folders for compatibility
                try {
                    const otherFolders = ['./auth_info_baileys', './auth_info'];
                    for (const folder of otherFolders) {
                        if (!fs.existsSync(folder)) {
                            fs.mkdirSync(folder, { recursive: true });
                        }
                        
                        // Copy all auth files
                        const files = fs.readdirSync(AUTH_FOLDER);
                        for (const file of files) {
                            fs.copyFileSync(
                                path.join(AUTH_FOLDER, file),
                                path.join(folder, file)
                            );
                        }
                        console.log(`Auth state copied to ${folder} for compatibility`);
                    }
                } catch (err) {
                    console.error(`Error copying auth files: ${err.message}`);
                }
                
                // Initialize message handler
                try {
                    const messageHandler = require('./src/simplified-message-handler');
                    await messageHandler.init(sock);
                    console.log('Message handler initialized! Bot is now ready to respond to commands.');
                    console.log('Command modules have been loaded from both /commands and /src/commands folders.');
                    console.log('Try sending ".help" to the bot to see available commands.');
                } catch (err) {
                    console.error(`Error initializing message handler: ${err.message}`);
                    console.error('The bot will work but won\'t respond to commands');
                }
            }
            
            // Handle disconnection
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`Connection closed with status code: ${statusCode || 'unknown'}`);
                
                // Decide whether to reconnect
                if (statusCode !== DisconnectReason.loggedOut) {
                    // Calculate backoff delay
                    const delay = Math.min(5000 * Math.pow(1.5, connectionAttempts - 1), 60000);
                    console.log(`Reconnecting in ${Math.floor(delay/1000)} seconds...`);
                    
                    setTimeout(() => {
                        connectToWhatsApp().catch(err => {
                            console.error(`Reconnection error: ${err.message}`);
                        });
                    }, delay);
                } else {
                    console.log('Logged out from WhatsApp. Please run the script again.');
                    process.exit(0);
                }
            }
        });
        
        // Save credentials on update
        sock.ev.on('creds.update', saveCreds);
        
        return sock;
    } catch (err) {
        console.error(`Connection error: ${err.message}`);
        console.error(err.stack);
        
        // Retry with backoff
        if (connectionAttempts < 5) {
            const delay = Math.min(5000 * Math.pow(2, connectionAttempts - 1), 30000);
            console.log(`Retrying in ${Math.floor(delay/1000)} seconds...`);
            
            return new Promise(resolve => {
                setTimeout(() => {
                    connectToWhatsApp().then(resolve).catch(err => {
                        console.error(`Retry failed: ${err.message}`);
                        resolve(null);
                    });
                }, delay);
            });
        }
        
        return null;
    }
}

// Display banner
console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║     BLACKSKY-MD WHATSAPP TERMINAL QR CONNECT      ║
║                                                   ║
║  • Optimized for reliable QR code generation      ║
║  • Compact QR code for easier scanning            ║
║  • Automatic reconnection on failure              ║
║  • Compatible with multiple environments          ║
║                                                   ║
║  Wait for the QR code to appear and scan it       ║
║  with your WhatsApp mobile app                    ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
`);

// Function to clear the auth state and restart
async function clearAuthAndRestart() {
    console.log('Clearing auth state and restarting connection...');
    
    try {
        // Remove auth directory
        if (fs.existsSync(AUTH_FOLDER)) {
            const files = fs.readdirSync(AUTH_FOLDER);
            for (const file of files) {
                fs.unlinkSync(path.join(AUTH_FOLDER, file));
            }
            console.log('Auth files cleared successfully');
        }
    } catch (err) {
        console.error(`Error clearing auth files: ${err.message}`);
    }
    
    // Restart connection
    console.log('Restarting WhatsApp connection...');
    await connectToWhatsApp();
}

// Start connection
connectToWhatsApp().catch(err => {
    console.error('Fatal error:');
    console.error(err);
    
    // Offer restart option
    console.log('\nIf the bot is not responding to commands, you can:');
    console.log('1. Try sending a message to the bot');
    console.log('2. Wait a moment for WhatsApp to sync messages');
    console.log('3. If still not working, you may want to restart the connection\n');
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('Process terminated by user');
    process.exit(0);
});