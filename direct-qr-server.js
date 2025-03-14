/**
 * Direct QR Code Server
 * This is a simplified QR code server that displays the QR code directly.
 */

const express = require('express');
const http = require('http');
const qrcode = require('qrcode');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

// Create Express app
const app = express();
const server = http.createServer(app);
const PORT = 5006; // Use a consistent port

// QR code state
let latestQR = null;
let connectionStatus = 'disconnected';
let sock = null;

// Auth directory
const AUTH_DIRECTORY = path.join(process.cwd(), 'auth_info');

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIRECTORY)) {
    fs.mkdirSync(AUTH_DIRECTORY, { recursive: true });
}

// Clear auth state to force new QR code generation
async function clearAuthState() {
    console.log('Clearing auth state to force QR code generation...');
    if (fs.existsSync(AUTH_DIRECTORY)) {
        fs.rmSync(AUTH_DIRECTORY, { recursive: true, force: true });
        fs.mkdirSync(AUTH_DIRECTORY, { recursive: true });
    }
}

// Serve static HTML page with QR code
app.get('/', (req, res) => {
    // Create a simple HTML page to display the QR
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>WhatsApp Bot QR Code</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f0f4f7;
                margin: 0;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                text-align: center;
            }
            .container {
                background-color: white;
                border-radius: 15px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                padding: 30px;
                max-width: 500px;
                width: 100%;
            }
            h1 {
                color: #128C7E; /* WhatsApp green */
                margin-bottom: 5px;
            }
            h2 {
                color: #075E54;
                font-size: 1.2em;
                margin-top: 0;
            }
            .qr-container {
                background-color: white;
                padding: 20px;
                border-radius: 10px;
                margin: 20px auto;
                display: inline-block;
            }
            .status {
                font-weight: bold;
                padding: 10px;
                border-radius: 5px;
                margin: 15px 0;
            }
            .disconnected { background-color: #ffcccc; color: #d32f2f; }
            .connecting { background-color: #fff8e1; color: #ff8f00; }
            .connected { background-color: #e8f5e9; color: #2e7d32; }
            .refresh-button {
                background-color: #128C7E;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1em;
                margin-top: 10px;
            }
            .instructions {
                font-size: 0.9em;
                color: #666;
                margin-top: 20px;
                line-height: 1.5;
                text-align: left;
            }
            .instructions ol {
                margin-top: 10px;
                padding-left: 25px;
            }
            img {
                max-width: 100%;
                height: auto;
            }
            .pulse {
                animation: pulse 2s infinite;
            }
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.6; }
                100% { opacity: 1; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>WhatsApp Bot</h1>
            <h2>QR Code Connection</h2>
            
            <div class="status ${connectionStatus}">
                Status: ${connectionStatus === 'connected' 
                        ? 'Connected ✓' 
                        : connectionStatus === 'connecting' 
                            ? 'Connecting...' 
                            : 'Waiting for QR Code...'}
            </div>
            
            <div class="qr-container">
                ${latestQR 
                    ? `<img src="${latestQR}" alt="WhatsApp QR Code" width="260" height="260">`
                    : `<p class="pulse">Generating QR code... Please wait.</p><p>This may take up to 30 seconds.</p>`
                }
            </div>
            
            <button class="refresh-button" onclick="location.reload()">Refresh QR Code</button>
            
            <div class="instructions">
                <strong>Instructions:</strong>
                <ol>
                    <li>Open WhatsApp on your phone</li>
                    <li>Tap Menu ⋮ or Settings ⚙ and select "Linked Devices"</li>
                    <li>Tap on "Link a Device"</li>
                    <li>Point your phone camera at this QR code to scan</li>
                </ol>
                <p>If no QR appears after 30 seconds, click the Refresh button.</p>
                <p>Once connected, you can close this page.</p>
            </div>
        </div>
        
        <script>
            // Auto-refresh if no QR code appears after 20 seconds
            const hasQR = ${latestQR ? 'true' : 'false'};
            const status = "${connectionStatus}";
            
            if (!hasQR && status !== 'connected') {
                setTimeout(() => location.reload(), 20000);
            }
            
            // Auto-refresh every 2 minutes while waiting for connection
            if (status !== 'connected') {
                setTimeout(() => location.reload(), 120000);
            }
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
});

// Generate and display QR code
async function displayQR(qr) {
    try {
        // Generate QR code as data URL for web
        latestQR = await qrcode.toDataURL(qr);
        connectionStatus = 'connecting';
        
        // Also display QR in terminal for maximum compatibility
        console.log('\n\n');
        await qrcode.toString(qr, {type: 'terminal', small: true})
            .then(qrString => {
                console.log(qrString);
            });
        
        console.log(`\n✅ QR CODE GENERATED SUCCESSFULLY!`);
        console.log(`\n👉 QR Code ready at http://localhost:${PORT}`);
        console.log(`\n👉 You can also scan the QR code above directly from your terminal`);
        console.log('\n\n');
    } catch (err) {
        console.error('Failed to generate QR code:', err);
    }
}

// Start WhatsApp connection with detailed debugging
async function startWhatsAppConnection() {
    try {
        console.log('\n🔄 STARTING WHATSAPP CONNECTION PROCESS...');
        
        // Clear session to force new QR code
        await clearAuthState();
        console.log('✅ Auth state cleared - Will generate fresh QR code');
        
        // Create auth state
        console.log('⏳ Creating auth state from directory:', AUTH_DIRECTORY);
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIRECTORY);
        console.log('✅ Auth state created successfully');
        
        // Create WhatsApp socket connection with enhanced debugging
        console.log('⏳ Creating WhatsApp socket with improved settings...');
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true, // Print to terminal as backup
            browser: ['WhatsApp Bot', 'Chrome', '110.0.0'],
            logger: pino({ 
                level: 'debug',  // More verbose logging
                transport: {
                    target: 'pino-pretty',
                    options: {
                        colorize: true
                    }
                } 
            }),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            version: [2, 2323, 4],
            // Add more debugging features
            emitOwnEvents: true,
            fireAndForget: false,
            shouldIgnoreJid: jid => false,
            getMessage: async key => {
                return { conversation: 'hello' };
            }
        });
        console.log('✅ WhatsApp socket created');
        
        // Enhanced connection event handling with verbose logging
        console.log('⏳ Setting up connection event handlers...');
        sock.ev.on('connection.update', async (update) => {
            console.log('📡 CONNECTION UPDATE:', JSON.stringify(update, null, 2));
            const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;
            
            if (qr) {
                console.log('🔐 QR CODE RECEIVED FROM WHATSAPP! Displaying...');
                await displayQR(qr);
            }
            
            if (connection === 'connecting') {
                console.log('🔄 Connection status: CONNECTING');
                connectionStatus = 'connecting';
            }
            
            if (connection === 'open') {
                console.log('🎉 CONNECTION OPENED SUCCESSFULLY!');
                connectionStatus = 'connected';
                latestQR = null; // Clear QR code once connected
                await saveCreds();
                console.log('💾 Credentials saved successfully');
                console.log('\n✅ CONNECTION ESTABLISHED SUCCESSFULLY!\n');
                console.log('✅ WhatsApp Bot is now ready to use!\n');
                
                // Try to get the user info
                try {
                    const user = sock.user;
                    console.log('👤 Connected as:', user.name || user.verifiedName || user.id.split(':')[0]);
                } catch (userErr) {
                    console.log('⚠️ Could not get user details:', userErr.message);
                }
            }
            
            if (receivedPendingNotifications) {
                console.log('📨 Received pending notifications');
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || 'unknown error';
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                connectionStatus = 'disconnected';
                console.log(`\n🔴 CONNECTION CLOSED:
- Error Message: ${errorMessage}  
- Status Code: ${statusCode}
- Should Reconnect: ${shouldReconnect ? 'Yes' : 'No'}
`);
                
                // List all possible disconnection reasons for better debugging
                console.log('⚠️ Checking disconnect reason against known codes:');
                for (const [key, value] of Object.entries(DisconnectReason)) {
                    if (statusCode === value) {
                        console.log(`✓ Disconnection reason identified: ${key} (${value})`);
                    }
                }
                
                if (shouldReconnect) {
                    console.log('🔄 Attempting reconnection in 5 seconds...');
                    setTimeout(startWhatsAppConnection, 5000);
                } else {
                    console.log('⛔ Not reconnecting - user logged out or permanent error');
                }
            }
        });
        
        // Add more event listeners for better debugging
        sock.ev.on('creds.update', async (creds) => {
            console.log('💾 Credentials updated, saving...');
            await saveCreds();
        });
        
        sock.ev.on('messaging-history.set', () => {
            console.log('📚 Messaging history received');
        });
        
        sock.ev.on('chats.upsert', () => {
            console.log('💬 New chats received');
        });
        
        sock.ev.on('contacts.update', () => {
            console.log('👥 Contacts updated');
        });
        
        sock.ev.on('qr', async (qr) => {
            console.log('🔐 Direct QR event received');
            await displayQR(qr);
        });
        
        console.log('✅ All event handlers registered successfully');
        
    } catch (err) {
        console.error('❌ ERROR DURING CONNECTION SETUP:', err);
        console.error('Stack trace:', err.stack);
        connectionStatus = 'disconnected';
        console.log('🔄 Retrying connection in 10 seconds...');
        setTimeout(startWhatsAppConnection, 10000);
    }
}

// Start the server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ QR Web Server running at http://localhost:${PORT}\n`);
    console.log('✅ Use this URL to access the WhatsApp QR code scanning interface\n');
    
    // Start WhatsApp connection
    startWhatsAppConnection();
});