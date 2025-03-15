/**
 * Local WhatsApp Connection Script
 * 
 * This script is designed to be run on your local machine (not in Replit)
 * It will help you establish a connection and provide credentials for your bot
 * 
 * SETUP INSTRUCTIONS:
 * 1. Save this file to your local computer
 * 2. Install Node.js if you don't have it already
 * 3. Run these commands in your terminal/command prompt:
 *    npm install @whiskeysockets/baileys qrcode-terminal
 * 4. Run: node local-connect.js
 * 5. Scan the QR code with your phone
 * 6. After successful connection, upload the auth_info_baileys folder to your Replit project
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const path = require('path');

// Define constants
const AUTH_FOLDER = './auth_info_baileys';
const BACKUP_FOLDER = './auth_backup';
let connectionAttempt = 0;
const MAX_RETRIES = 3;

// Create necessary directories
if (!fs.existsSync(AUTH_FOLDER)) {
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    console.log(`📁 Created auth folder: ${AUTH_FOLDER}`);
}

if (!fs.existsSync(BACKUP_FOLDER)) {
    fs.mkdirSync(BACKUP_FOLDER, { recursive: true });
    console.log(`📁 Created backup folder: ${BACKUP_FOLDER}`);
}

// Connection function
async function connectToWhatsApp() {
    console.log('\n🔄 Starting WhatsApp connection process...');
    
    try {
        // Load auth state
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
        console.log('📂 Auth state loaded successfully');
        
        // Select browser fingerprint based on attempt number
        const browserOptions = [
            ['Chrome', '120.0.0.0'],
            ['Firefox', '115.0'],
            ['Safari', '17.0'],
            ['Edge', '120.0.0.0'],
            ['Opera', '105.0.0.0']
        ];
        
        const browser = browserOptions[connectionAttempt % browserOptions.length];
        console.log(`🌐 Using ${browser[0]} browser fingerprint (attempt ${connectionAttempt + 1}/${MAX_RETRIES})`);
        
        // Create socket connection
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: [`WhatsApp-MD-${Date.now()}`, browser[0], browser[1]],
            syncFullHistory: false
        });
        
        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // Handle QR code
            if (qr) {
                console.log('\n📱 SCAN THIS QR CODE WITH YOUR PHONE:');
                qrcode.generate(qr, { small: true });
                console.log('\n⏳ Waiting for you to scan the QR code...');
            }
            
            // Handle successful connection
            if (connection === 'open') {
                console.log('\n✅ SUCCESSFULLY CONNECTED TO WHATSAPP!');
                console.log('📲 Your WhatsApp is now linked');
                
                // Backup the credentials
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupPath = path.join(BACKUP_FOLDER, `auth_backup_${timestamp}`);
                
                try {
                    if (!fs.existsSync(BACKUP_FOLDER)) {
                        fs.mkdirSync(BACKUP_FOLDER, { recursive: true });
                    }
                    
                    fs.cpSync(AUTH_FOLDER, backupPath, { recursive: true });
                    console.log(`💾 Created backup of credentials at: ${backupPath}`);
                } catch (err) {
                    console.log(`⚠️ Couldn't create backup: ${err.message}`);
                }
                
                console.log('\n📋 NEXT STEPS:');
                console.log('1️⃣ Upload the entire "auth_info_baileys" folder to your Replit project');
                console.log('2️⃣ Make sure it\'s at the root level of your project');
                console.log('3️⃣ Restart your bot in Replit');
                console.log('\n⚠️ Note: These credentials will eventually expire (typically after a few days to weeks)');
                console.log('   When that happens, you\'ll need to repeat this process.');
                
                // Exit after 5 seconds
                setTimeout(() => {
                    console.log('\n👋 Exiting in 5 seconds...');
                    setTimeout(() => process.exit(0), 5000);
                }, 5000);
            }
            
            // Handle disconnection
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('❌ Device has been logged out');
                    process.exit(1);
                } else {
                    // If not logged out, retry
                    if (connectionAttempt < MAX_RETRIES - 1) {
                        connectionAttempt++;
                        console.log(`🔄 Connection attempt failed, retrying (${connectionAttempt + 1}/${MAX_RETRIES})...`);
                        setTimeout(connectToWhatsApp, 3000);
                    } else {
                        console.log('❌ Maximum retry attempts reached. Please check your internet connection and try again.');
                        process.exit(1);
                    }
                }
            }
        });
        
        // Save credentials when they're updated
        sock.ev.on('creds.update', saveCreds);
        
    } catch (error) {
        console.error(`❌ Error in connection process: ${error.message}`);
        
        if (connectionAttempt < MAX_RETRIES - 1) {
            connectionAttempt++;
            console.log(`🔄 Retrying connection (${connectionAttempt + 1}/${MAX_RETRIES})...`);
            setTimeout(connectToWhatsApp, 3000);
        } else {
            console.log('❌ Maximum retry attempts reached. Please check your internet connection and try again.');
            process.exit(1);
        }
    }
}

// Welcome message
console.log('\n===========================================');
console.log('📱 LOCAL WHATSAPP CONNECTION SCRIPT');
console.log('===========================================');
console.log('This script helps you connect your WhatsApp');
console.log('account locally and generate auth files for');
console.log('your Replit-hosted WhatsApp bot.');
console.log('===========================================\n');

// Start the connection process
connectToWhatsApp();