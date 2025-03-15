/**
 * Unified WhatsApp Bot with Web QR Interface
 * Combines the QR web display and bot functionality in a single process
 * Includes comprehensive command module support with 490+ commands
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const express = require('express');
const qrcode = require('qrcode');
const pino = require('pino');

// Command loader
const { commandLoader } = require('./src/utils/commandLoader');
const { languageManager } = require('./src/utils/language');
const { handleCommandError } = require('./src/utils/errorHandler');

// Constants
const AUTH_DIR = './auth_info_terminal';
let sock = null;
let qrCodeDataURL = '';
let connectionStatus = 'disconnected';
let lastError = '';
let connectionAttempt = 0;
const MAX_ATTEMPTS = 5;
let reconnectTimer = null;
let uptime = {
    startTime: null,
    connectionCount: 0
};

// Express app setup
const app = express();
const port = 5004; // Changed port to avoid conflict with other workflows

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Bot Status</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="refresh" content="30">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                    color: #333;
                }
                h1 { color: #128C7E; }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .status-card {
                    margin: 30px auto;
                    padding: 20px;
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                    max-width: 500px;
                }
                .status {
                    padding: 10px;
                    border-radius: 5px;
                    margin: 10px 0;
                    font-weight: bold;
                }
                .disconnected { background-color: #ffcccc; color: #990000; }
                .connecting { background-color: #ffffcc; color: #999900; }
                .connected { background-color: #ccffcc; color: #009900; }
                .error { background-color: #ffcccc; color: #990000; }
                .button {
                    background-color: #128C7E;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    margin-top: 20px;
                    cursor: pointer;
                    text-decoration: none;
                    display: inline-block;
                }
                .qr-container {
                    margin: 20px auto;
                    max-width: 300px;
                }
                .stats {
                    text-align: left;
                    margin-top: 20px;
                    padding: 15px;
                    background: #f9f9f9;
                    border-radius: 5px;
                }
                .stats-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .stats-table td {
                    padding: 8px;
                    border-bottom: 1px solid #eee;
                }
                .stats-table td:first-child {
                    font-weight: bold;
                    width: 40%;
                }
                pre {
                    background-color: #f0f0f0;
                    padding: 10px;
                    border-radius: 5px;
                    text-align: left;
                    overflow-x: auto;
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>WhatsApp Bot Status</h1>
                
                <div class="status-card">
                    <div class="status ${connectionStatus}">
                        Status: ${connectionStatus.toUpperCase()}
                    </div>
                    
                    ${lastError ? `<div class="error">${lastError}</div>` : ''}
                    
                    ${connectionStatus === 'connected' ? `
                        <div class="stats">
                            <h3>Connection Stats</h3>
                            <table class="stats-table">
                                <tr>
                                    <td>Uptime:</td>
                                    <td>${getUptime()}</td>
                                </tr>
                                <tr>
                                    <td>Reconnections:</td>
                                    <td>${uptime.connectionCount}</td>
                                </tr>
                            </table>
                        </div>
                    ` : 
                    qrCodeDataURL ? `
                        <div class="qr-container">
                            <h3>Scan this QR code</h3>
                            <img src="${qrCodeDataURL}" alt="WhatsApp QR Code">
                        </div>
                    ` : 
                    `<p>Waiting for QR code...</p>`}
                    
                    <div style="margin-top: 20px;">
                        <a href="/reset" class="button">Reset Connection</a>
                        <a href="/pairing" class="button" style="background-color: #075E54; margin-left: 10px;">Configure Pairing</a>
                    </div>
                    
                    ${process.env.USE_PAIRING_CODE === 'true' ? `
                        <div style="margin-top: 15px; font-size: 14px; color: #128C7E;">
                            <strong>Pairing Code Mode:</strong> Enabled for ${process.env.PAIRING_NUMBER}
                        </div>
                    ` : ''}
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/reset', async (req, res) => {
    console.log('Connection reset requested');
    await resetConnection();
    res.redirect('/');
});

app.get('/status', (req, res) => {
    res.json({
        status: connectionStatus,
        uptime: getUptime(),
        reconnections: uptime.connectionCount,
        error: lastError,
        pairing: {
            enabled: process.env.USE_PAIRING_CODE === 'true',
            number: process.env.PAIRING_NUMBER || ''
        }
    });
});

// Pairing code configuration page
app.get('/pairing', (req, res) => {
    const usePairingCode = process.env.USE_PAIRING_CODE === 'true';
    const phoneNumber = process.env.PAIRING_NUMBER || '';
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Pairing Configuration</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                    color: #333;
                }
                h1 { color: #128C7E; }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .form-card {
                    margin: 30px auto;
                    padding: 20px;
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                    max-width: 500px;
                    text-align: left;
                }
                .form-group {
                    margin-bottom: 20px;
                }
                label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: bold;
                }
                input[type="text"],
                input[type="tel"] {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    font-size: 16px;
                    box-sizing: border-box;
                }
                .button {
                    background-color: #128C7E;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    margin-top: 20px;
                    cursor: pointer;
                    text-decoration: none;
                    display: inline-block;
                    font-size: 16px;
                }
                .checkbox-container {
                    display: flex;
                    align-items: center;
                }
                .checkbox-container input {
                    margin-right: 10px;
                    width: 20px;
                    height: 20px;
                }
                .note {
                    background-color: #ffffd9;
                    padding: 15px;
                    border-radius: 5px;
                    border-left: 4px solid #ffcc00;
                    margin: 20px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>WhatsApp Pairing Configuration</h1>
                
                <div class="form-card">
                    <form action="/set-pairing" method="GET">
                        <div class="form-group checkbox-container">
                            <input type="checkbox" id="use_pairing" name="use_pairing" value="true" ${usePairingCode ? 'checked' : ''}>
                            <label for="use_pairing">Use Pairing Code (Instead of QR Code)</label>
                        </div>
                        
                        <div class="form-group">
                            <label for="phone_number">Phone Number (with country code):</label>
                            <input type="tel" id="phone_number" name="phone_number" value="${phoneNumber}" placeholder="e.g., +19876543210">
                        </div>
                        
                        <div class="note">
                            <p><strong>Note:</strong> Enter your full phone number with country code (e.g., +1 for USA). After saving, please restart the connection for changes to take effect.</p>
                        </div>
                        
                        <button type="submit" class="button">Save Configuration</button>
                    </form>
                    
                    <p style="margin-top: 20px;">
                        <a href="/" style="color: #128C7E;">Back to Status Page</a>
                    </p>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Set pairing configuration
app.get('/set-pairing', (req, res) => {
    const usePairingCode = req.query.use_pairing === 'true';
    const phoneNumber = req.query.phone_number || '';
    
    process.env.USE_PAIRING_CODE = usePairingCode ? 'true' : 'false';
    process.env.PAIRING_NUMBER = phoneNumber;
    
    console.log(`Pairing configuration updated: enabled=${usePairingCode}, number=${phoneNumber}`);
    
    res.redirect('/pairing?success=true');
});

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt) {
    return Math.min(Math.pow(2, attempt) * 1000, 60000); // Max 1 minute
}

/**
 * Clear authentication data
 * @param {boolean} force Whether to force clearing auth data even on temporary disconnections
 */
async function clearAuthData(force = false) {
    if (force || connectionStatus !== 'connected') {
        try {
            const mainAuthDir = './auth_info_baileys';
            if (fs.existsSync(mainAuthDir)) {
                fs.rmSync(mainAuthDir, { recursive: true, force: true });
                fs.mkdirSync(mainAuthDir, { recursive: true });
                console.log('Auth data cleared');
            }
        } catch (err) {
            console.error('Error clearing auth data:', err);
        }
    }
}

/**
 * Initialize WhatsApp connection with retry logic and pairing code
 */
async function connectToWhatsApp(retryCount = 0) {
    // Clear any existing reconnect timer
    clearReconnectTimer();
    
    try {
        // Update connection status
        connectionStatus = 'connecting';
        console.log(`Starting WhatsApp connection (attempt ${retryCount + 1})...`);
        
        // Try to use auth_info_terminal first, fall back to auth_info_baileys if not available
        const authDir = fs.existsSync(AUTH_DIR) && fs.readdirSync(AUTH_DIR).length > 0
            ? AUTH_DIR
            : './auth_info_baileys';
        
        console.log(`Using authentication from ${authDir}`);
        
        // Ensure auth directory exists
        if (!fs.existsSync(authDir)) {
            fs.mkdirSync(authDir, { recursive: true });
        }
        
        // Load authentication state
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        
        // Select browser fingerprint based on retry count
        const browserOptions = [
            ['Chrome', '120.0.0.0'],
            ['Firefox', '115.0'],
            ['Edge', '120.0.0.0'],
            ['Safari', '17.0'],
            ['Opera', '105.0.0.0']
        ];
        
        const browser = browserOptions[retryCount % browserOptions.length];
        console.log(`Using ${browser[0]} browser fingerprint`);
        
        // Create a unique device ID
        const deviceId = `BLACKSKY-${Date.now()}`;
        
        // Determine if we should use pairing code instead of QR
        const usePairingCode = process.env.USE_PAIRING_CODE === 'true';
        const phoneNumber = process.env.PAIRING_NUMBER || '';
        
        console.log(`Pairing code mode: ${usePairingCode ? 'Enabled' : 'Disabled'}`);
        if (usePairingCode && phoneNumber) {
            console.log(`Will attempt to pair with: ${phoneNumber}`);
        }
        
        // Initialize socket with different options based on pairing mode
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: !usePairingCode, // Only print QR if not using pairing code
            browser: [deviceId, browser[0], browser[1]],
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            // Add mobile device fingerprint if using pairing code
            ...(usePairingCode ? {
                mobile: true,
                browser: ['BLACKSKY-MD', 'Safari', '1.0.0'],
                logger: pino({ level: 'trace' }),
                defaultQueryTimeoutMs: undefined
            } : {})
        });
        
        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // Handle QR code updates
            if (qr) {
                console.log('New QR code received');
                qrCodeDataURL = await qrcode.toDataURL(qr);
            }
            
            // Handle pairing code if enabled
            const usePairingCode = process.env.USE_PAIRING_CODE === 'true';
            const phoneNumber = process.env.PAIRING_NUMBER || '';
            
            if (usePairingCode && phoneNumber && !sock.authState.creds.registered && !qr) {
                // Format the phone number (remove any non-numeric chars)
                const formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
                if (formattedNumber) {
                    try {
                        console.log(`Requesting pairing code for ${formattedNumber}...`);
                        // Request a pairing code
                        setTimeout(async () => {
                            const code = await sock.requestPairingCode(formattedNumber);
                            console.log(`\n💻 Pairing Code: ${code}\n`);
                            // Display the code on the web interface
                            const pairingCodeHTML = `
                            <div style="text-align:center; padding: 20px; font-family: monospace; background: #000; color: #0f0; border-radius: 10px; margin: 20px 0;">
                                <h2>📱 WhatsApp Pairing Code</h2>
                                <div style="font-size: 32px; letter-spacing: 5px; padding: 20px; font-weight: bold;">${code}</div>
                                <p>Enter this code in your WhatsApp app to connect your device (${formattedNumber})</p>
                            </div>`;
                            qrCodeDataURL = `data:text/html,${encodeURIComponent(pairingCodeHTML)}`;
                        }, 3000);
                    } catch (error) {
                        console.error('Failed to request pairing code:', error);
                        lastError = `Pairing code request failed: ${error.message}`;
                    }
                }
            }
            
            // Handle connection status changes
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
                
                console.log(`Connection closed: ${errorMessage} (Status code: ${statusCode})`);
                connectionStatus = 'disconnected';
                lastError = `${errorMessage} (Status code: ${statusCode})`;
                
                if (statusCode === DisconnectReason.loggedOut) {
                    // Clear auth data if logged out
                    await clearAuthData(true);
                    console.log('Device logged out, cleared auth data');
                }
                
                // Schedule reconnection
                const retryDelay = getRetryDelay(retryCount);
                console.log(`Reconnecting in ${retryDelay/1000}s (Attempt ${retryCount + 1})`);
                
                reconnectTimer = setTimeout(() => {
                    connectToWhatsApp(retryCount + 1);
                }, retryDelay);
                
            } else if (connection === 'open') {
                console.log('Connected to WhatsApp');
                connectionStatus = 'connected';
                lastError = '';
                uptime.connectionCount++;
                
                if (!uptime.startTime) {
                    uptime.startTime = Date.now();
                }
                
                // If we're using Terminal QR auth, copy to main auth
                if (authDir === AUTH_DIR) {
                    try {
                        const mainAuthDir = './auth_info_baileys';
                        if (!fs.existsSync(mainAuthDir)) {
                            fs.mkdirSync(mainAuthDir, { recursive: true });
                        }
                        
                        // Copy auth files
                        const files = fs.readdirSync(AUTH_DIR);
                        for (const file of files) {
                            const srcPath = path.join(AUTH_DIR, file);
                            const destPath = path.join(mainAuthDir, file);
                            if (fs.statSync(srcPath).isFile()) {
                                fs.copyFileSync(srcPath, destPath);
                            }
                        }
                        
                        console.log('Copied auth files to main directory');
                    } catch (err) {
                        console.error('Error copying auth files:', err);
                    }
                }
                
                // Send notification to owner
                await sendDeploymentNotification(sock);
            }
        });
        
        // Set up message handling
        sock.ev.on('messages.upsert', async (m) => {
            if (m.type === 'notify') {
                for (const msg of m.messages) {
                    try {
                        // Skip messages from self
                        if (msg.key.fromMe) continue;
                        
                        console.log('New message received:', msg.key.remoteJid);
                        const messageText = msg.message?.conversation || 
                                          msg.message?.extendedTextMessage?.text || 
                                          'Media message';
                        
                        // Process command if it starts with !
                        if (messageText.startsWith('!')) {
                            const input = messageText.slice(1).trim();
                            const [commandName, ...args] = input.split(' ');
                            console.log('Command received:', commandName, 'with args:', args.join(' '));

                            // Always handle these core commands directly
                            if (commandName === 'ping') {
                                await sock.sendMessage(msg.key.remoteJid, { text: 'Pong! Bot is operational.' });
                                continue;
                            } else if (commandName === 'status') {
                                await sock.sendMessage(msg.key.remoteJid, { 
                                    text: `Status: ${connectionStatus.toUpperCase()}\nUptime: ${getUptime()}\nReconnections: ${uptime.connectionCount}` 
                                });
                                continue;
                            } else if (commandName === 'time') {
                                await sock.sendMessage(msg.key.remoteJid, { 
                                    text: `Current server time: ${new Date().toLocaleString()}` 
                                });
                                continue;
                            }
                            
                            // Look up the command in the command loader
                            const command = await commandLoader.getCommand(commandName);
                            
                            if (command) {
                                try {
                                    console.log(`Executing command: ${commandName}`);
                                    // Execute the command
                                    await command.execute(sock, msg, args);
                                } catch (error) {
                                    console.error(`Error executing command ${commandName}:`, error);
                                    // Use the error handler to provide a user-friendly response
                                    await handleCommandError(sock, msg.key.remoteJid, error, commandName, 'unknown', {
                                        reply: true,
                                        logError: true,
                                        userFriendly: true
                                    });
                                }
                            } else {
                                // Command not found - you can optionally send a response here
                                console.log(`Command not found: ${commandName}`);
                                const helpText = languageManager.getText('system.command_not_found', 'en', commandName);
                                await sock.sendMessage(msg.key.remoteJid, { text: helpText });
                            }
                        }
                    } catch (error) {
                        console.error('Error processing message:', error);
                    }
                }
            }
        });
        
        // Save credentials when updated
        sock.ev.on('creds.update', saveCreds);
        
        // Set up regular session backup
        setupSessionBackup();
        
    } catch (error) {
        console.error('Error in connection:', error);
        connectionStatus = 'disconnected';
        lastError = error.message;
        
        // Schedule reconnection
        const retryDelay = getRetryDelay(retryCount);
        console.log(`Reconnecting in ${retryDelay/1000}s due to error (Attempt ${retryCount + 1})`);
        
        reconnectTimer = setTimeout(() => {
            connectToWhatsApp(retryCount + 1);
        }, retryDelay);
    }
}

/**
 * Backup session at regular intervals
 */
function setupSessionBackup() {
    setInterval(async () => {
        if (connectionStatus === 'connected' && sock) {
            try {
                console.log('Performing session backup...');
                await sendCredsToSelf(sock);
            } catch (error) {
                console.error('Error during session backup:', error);
            }
        }
    }, 24 * 60 * 60 * 1000); // Once per day
}

/**
 * Get current connection status
 */
function getConnectionStatus() {
    return {
        status: connectionStatus,
        error: lastError,
        uptime: getUptime(),
        reconnections: uptime.connectionCount
    };
}

/**
 * Reset the connection state and reconnect
 */
async function resetConnection() {
    // Clear any existing reconnect timer
    clearReconnectTimer();
    
    // Clear auth data
    await clearAuthData(true);
    
    // Reset uptime tracking
    uptime = {
        startTime: null,
        connectionCount: 0
    };
    
    // Reconnect
    connectToWhatsApp(0);
}

/**
 * Clear reconnect timer
 */
function clearReconnectTimer() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}

/**
 * Get formatted uptime string
 */
function getUptime() {
    if (!uptime.startTime) return 'Not connected';
    
    const elapsed = Date.now() - uptime.startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Send creds.json file to the bot itself for backup
 */
async function sendCredsToSelf(sock) {
    try {
        // Get bot's own JID
        const { id } = sock.user;
        console.log(`Bot JID: ${id}`);
        
        // Check multiple auth directories for creds.json
        const authDirs = [
            AUTH_DIR, 
            './auth_info_baileys',
            './auth_info_safari'
        ];
        
        let credsFound = false;
        
        for (const dir of authDirs) {
            const credsPath = path.join(dir, 'creds.json');
            if (fs.existsSync(credsPath)) {
                // Check file size to ensure it's not empty
                const stats = fs.statSync(credsPath);
                if (stats.size === 0) {
                    console.log(`Empty creds.json found in ${dir}, skipping`);
                    continue;
                }
                
                // Read creds data
                const credsData = fs.readFileSync(credsPath);
                
                // Send with explanatory caption
                await sock.sendMessage(id, {
                    document: credsData,
                    mimetype: 'application/json',
                    fileName: 'creds.json',
                    caption: `🔐 *WhatsApp Credentials Backup* (${dir})\n\nThis file is needed for Heroku deployment. Keep it safe and do not share it with anyone.\n\n_Generated: ${new Date().toISOString()}_`
                });
                
                console.log(`Sent creds.json from ${dir} to self for backup`);
                credsFound = true;
                
                // Also backup relevant session files which are crucial for reconnection
                const sessionFiles = fs.readdirSync(dir).filter(file => file.startsWith('session-'));
                if (sessionFiles.length > 0) {
                    try {
                        // Create a temporary zip file with all session files
                        const AdmZip = require('adm-zip');
                        const zip = new AdmZip();
                        
                        for (const file of sessionFiles) {
                            const filePath = path.join(dir, file);
                            zip.addLocalFile(filePath);
                        }
                        
                        // Generate zip buffer
                        const zipBuffer = zip.toBuffer();
                        
                        // Send the session backup
                        await sock.sendMessage(id, {
                            document: zipBuffer,
                            fileName: `session_backup_${dir.replace(/\.\//g, '').replace(/auth_info_/g, '')}.zip`,
                            mimetype: 'application/zip',
                            caption: `📁 *WhatsApp Session Backup*\n\nAdditional session files from ${dir} for complete restoration.`
                        });
                        
                        console.log(`Sent session backup from ${dir}`);
                    } catch (zipError) {
                        console.error(`Error creating session backup for ${dir}:`, zipError);
                    }
                }
            }
        }
        
        if (!credsFound) {
            console.error('No valid creds.json found in any auth directory!');
            
            // Send error notification
            await sock.sendMessage(id, {
                text: `⚠️ *Credentials Backup Failed*\n\nNo valid creds.json found in any authentication directory. This may cause issues with Heroku deployment.\n\nPlease reconnect the bot to generate valid credentials.`
            });
        }
    } catch (error) {
        console.error('Error sending creds to self:', error);
        
        // Try to notify about error
        try {
            if (sock && sock.user) {
                await sock.sendMessage(sock.user.id, {
                    text: `❌ *Credentials Backup Error*\n\nFailed to send credentials backup: ${error.message}\n\nThis may affect Heroku deployment.`
                });
            }
        } catch (notifyError) {
            console.error('Error sending notification:', notifyError);
        }
    }
}

/**
 * Send deployment notification to the bot owner
 */
async function sendDeploymentNotification(sock) {
    try {
        // Get bot's own JID
        const { id } = sock.user;
        console.log(`Bot JID: ${id}`);
        
        // Get command stats
        const stats = commandLoader.getCommandStats();
        const breakdown = commandLoader.getCommandsBreakdown();
        
        // Format categories for notification
        let categoryText = '';
        Object.entries(breakdown).forEach(([category, count]) => {
            categoryText += `- ${category}: ${count} commands\n`;
        });
        
        // Send deployment notification
        await sock.sendMessage(id, {
            text: `🤖 *Bot started and connected!*\n\n*Time:* ${new Date().toLocaleString()}\n*Status:* ${connectionStatus.toUpperCase()}\n*Commands:* ${stats.total} total across ${stats.modules} modules\n\n*Command Categories:*\n${categoryText}\n*Basic commands:*\n!menu - Show all commands\n!ping - Test bot is running\n!status - Show connection status\n!help - Show command help`
        });
        
    } catch (error) {
        console.error('Error sending deployment notification:', error);
    }
}

/**
 * Main application startup
 */
async function start() {
    console.log('Starting WhatsApp bot...');
    
    // Initialize language manager
    await languageManager.loadTranslations();
    console.log('Translations loaded successfully');
    
    // Load all commands
    try {
        console.log('Loading command modules...');
        await commandLoader.loadCommandHandlers();
        const stats = commandLoader.getCommandStats();
        console.log(`Successfully loaded ${stats.total} commands from ${stats.modules} modules`);
        
        // Log command categories
        const breakdown = commandLoader.getCommandsBreakdown();
        console.log('Command categories:');
        Object.entries(breakdown).forEach(([category, count]) => {
            console.log(`- ${category}: ${count} commands`);
        });
    } catch (error) {
        console.error('Error loading commands:', error);
    }
    
    // Start the web server
    app.listen(port, '0.0.0.0', () => {
        console.log(`Server running on port ${port}`);
    });
    
    // Start the WhatsApp connection
    await connectToWhatsApp();
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    clearReconnectTimer();
    process.exit(0);
});

// Start the application
start();