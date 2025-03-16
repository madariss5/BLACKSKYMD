/**
 * WhatsApp QR Web Server and Connection Manager
 * Enhanced with persistent session management
 */

const express = require('express');
const http = require('http');
const qrcode = require('qrcode');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const logger = require('./utils/logger');

// Load the handler
process.env.DEBUG_BOT = 'true';
const handler = require('./handlers/ultra-minimal-handler');
const { 
    isConnectionError, 
    handleConnectionError, 
    resetConnectionStats 
} = require('./utils/connectionErrorHandler');

// Use a persistent auth directory
const AUTH_DIRECTORY = path.join(process.cwd(), 'auth_info_baileys');
const BACKUP_AUTH_DIR = path.join(process.cwd(), 'auth_info_backup');

// Create Express app
const app = express();
const server = http.createServer(app);
const PORT = 5000;

// Connection state
let latestQR = null;
let connectionStatus = 'disconnected';
let sock = null;
let qrGenerationAttempt = 0;
let isReconnecting = false;

// Create auth directories
[AUTH_DIRECTORY, BACKUP_AUTH_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
            logger.info(`Created auth directory: ${dir}`);
        } catch (err) {
            logger.error(`Failed to create auth directory: ${err.message}`);
        }
    }
});

// Enhanced connection function with persistent sessions
async function startConnection() {
    if (isReconnecting) {
        logger.info('Already attempting to reconnect...');
        return;
    }

    try {
        isReconnecting = true;
        connectionStatus = 'connecting';

        // Initialize handler
        await handler.init();
        logger.info('Command handler initialized');

        // Load auth state
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIRECTORY);
        logger.info('Auth state loaded');

        // Create WhatsApp socket connection with enhanced settings
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'silent' }),
            browser: ['BLACKSKY-MD', 'Chrome', '108.0.0'],
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 15000,
            retryRequestDelayMs: 2000,
            defaultQueryTimeoutMs: 60000,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            patchMessageBeforeSending: true,
            shouldIgnoreJid: jid => isJidBroadcast(jid)
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && !fs.existsSync(path.join(AUTH_DIRECTORY, 'creds.json'))) {
                logger.info('New QR code received');
                latestQR = qr;
                connectionStatus = 'qr_ready';
                qrGenerationAttempt++;
            }

            if (connection === 'open') {
                connectionStatus = 'connected';
                latestQR = null;
                isReconnecting = false;

                // Backup auth state
                try {
                    const files = fs.readdirSync(AUTH_DIRECTORY);
                    for (const file of files) {
                        fs.copyFileSync(
                            path.join(AUTH_DIRECTORY, file),
                            path.join(BACKUP_AUTH_DIR, file)
                        );
                    }
                    logger.info('Auth state backed up successfully');
                } catch (err) {
                    logger.error('Failed to backup auth state:', err.message);
                }

                resetConnectionStats();
                logger.info('Connection established successfully!');
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                connectionStatus = 'disconnected';
                isReconnecting = false;
                logger.info(`Connection closed with status code: ${statusCode}`);

                if (shouldReconnect) {
                    if (isConnectionError(lastDisconnect?.error)) {
                        await handleConnectionError(sock, lastDisconnect.error, 'connection-closed', startConnection);
                    } else {
                        logger.info('Attempting to reconnect...');
                        setTimeout(startConnection, 3000);
                    }
                } else if (statusCode === DisconnectReason.loggedOut) {
                    logger.warn('Session ended. Restoring from backup...');
                    try {
                        // Restore from backup
                        const files = fs.readdirSync(BACKUP_AUTH_DIR);
                        for (const file of files) {
                            fs.copyFileSync(
                                path.join(BACKUP_AUTH_DIR, file),
                                path.join(AUTH_DIRECTORY, file)
                            );
                        }
                        logger.info('Auth state restored from backup');
                        setTimeout(startConnection, 3000);
                    } catch (err) {
                        logger.error('Failed to restore auth state:', err.message);
                    }
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

        // Wire up message handler
        sock.ev.on('messages.upsert', async (m) => {
            if (m.type === 'notify') {
                try {
                    await handler.messageHandler(sock, m.messages[0]);
                } catch (err) {
                    logger.error('Message handling error:', err);
                }
            }
        });

    } catch (err) {
        logger.error('Error in connection:', err);
        connectionStatus = 'error';
        isReconnecting = false;

        if (isConnectionError(err)) {
            await handleConnectionError(sock, err, 'connection-start', startConnection);
        } else {
            setTimeout(startConnection, 3000);
        }
    }
}

// Helper function to check broadcast JIDs
function isJidBroadcast(jid) {
    return jid === 'status@broadcast';
}

// Serve static HTML page with QR code
app.get('/', (req, res) => {
    // Create a simple HTML page to display the QR
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>BLACKSKY-MD WhatsApp Bot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="30">
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
                color: #128C7E;
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
            .qr_ready {background-color: #ffffcc; color: #ff8f00;}
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
            .bot-status {
                margin-top: 20px;
                padding: 15px;
                background-color: #f5f5f5;
                border-radius: 5px;
                font-size: 0.9em;
            }
            .command-examples {
                text-align: left;
                background-color: #f0f8ff;
                padding: 15px;
                border-radius: 5px;
                margin-top: 15px;
            }
            .command-examples h3 {
                margin-top: 0;
                font-size: 1em;
            }
            .command-examples code {
                background-color: #e6f2ff;
                padding: 2px 4px;
                border-radius: 3px;
                font-family: monospace;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>BLACKSKY-MD</h1>
            <h2>WhatsApp Bot Connection</h2>
            <div class="status ${connectionStatus}">
                Status: ${connectionStatus === 'connected' 
                        ? 'Connected ✓' 
                        : connectionStatus === 'connecting' 
                            ? 'Connecting...' 
                            : connectionStatus === 'qr_ready'
                                ? 'QR Code Ready'
                                : 'Waiting for QR Code...'}
            </div>
            <div class="qr-container">
                ${latestQR 
                    ? `<img src="${latestQR}" alt="WhatsApp QR Code" width="300" height="300">`
                    : connectionStatus === 'connected'
                        ? `<p>✅ Successfully connected to WhatsApp!</p>
                           <p>Your bot is now active and responding to commands.</p>`
                        : connectionStatus === 'qr_ready'
                            ? `<p>Scan the QR code above to connect.</p>`
                            : `<p>Generating QR code... Please wait.</p>
                               <p>If no QR appears after 15 seconds, click refresh.</p>`
                }
            </div>
            ${connectionStatus === 'connected' ? `
                <div class="bot-status">
                    <strong>Bot Status:</strong> Active and ready to use<br>
                    <strong>Commands Available:</strong> ${handler?.commands?.size || 'Loading...'} loaded / ${(() => {
                        try {
                            // Get the config directory path
                            const configDir = path.join(process.cwd(), 'src/config/commands');
                            let count = 0;

                            // Check if the directory exists before trying to read
                            if (fs.existsSync(configDir)) {
                                // Read all JSON files
                                const configFiles = fs.readdirSync(configDir);

                                // Count commands in each JSON file
                                for (const file of configFiles) {
                                    if (file.endsWith('.json')) {
                                        const filePath = path.join(configDir, file);
                                        const fileContent = fs.readFileSync(filePath, 'utf8');
                                        try {
                                            const config = JSON.parse(fileContent);
                                            if (Array.isArray(config.commands)) {
                                                count += config.commands.length;
                                            }
                                        } catch (e) {
                                            // JSON parsing error, skip this file
                                        }
                                    }
                                }
                            }
                            return count;
                        } catch (err) {
                            return '?';
                        }
                    })()} configured<br>
                    <strong>Prefix:</strong> !, /, or .
                </div>
                <div class="command-examples">
                    <h3>Try these commands in WhatsApp:</h3>
                    <ul>
                        <li><code>!ping</code> - Check if bot is responding</li>
                        <li><code>!menu</code> - View all available commands</li>
                        <li><code>!help</code> - Get help with using the bot</li>
                        <li><code>!hug @user</code> - Send a reaction GIF to someone</li>
                    </ul>
                    <p style="margin-top:10px;">
                        <a href="/reaction-commands" style="color:#128C7E;text-decoration:none;font-weight:bold;">
                            View All Reaction Commands →
                        </a>
                    </p>
                </div>
            ` : `
                <button class="refresh-button" onclick="location.reload()">Refresh</button>
            `}
            <div class="instructions">
                <strong>Instructions:</strong>
                <ol>
                    <li>Open WhatsApp on your phone</li>
                    <li>Tap Menu ⋮ or Settings ⚙ and select "Linked Devices"</li>
                    <li>Tap on "Link a Device"</li>
                    <li>Point your phone camera at this QR code to scan</li>
                </ol>
                <p><strong>Note:</strong> Page refreshes automatically every 30 seconds.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    res.send(html);
});


// Generate and display QR code
async function displayQR(qr) {
    try {
        // Generate QR code as data URL
        latestQR = await qrcode.toDataURL(qr);
        connectionStatus = 'connecting';
        qrGenerationAttempt++;
        logger.info(`QR Code generated (attempt ${qrGenerationAttempt}). Visit http://localhost:${PORT} to scan.`);
    } catch (err) {
        logger.error('Failed to generate QR code:', err);
    }
}

// Import the direct copy script for reaction GIFs
const directCopyReactionGifs = require('./direct-copy-reaction-gifs');

// Auto-verify reaction GIFs with enhanced reliability
const verifyReactionGifs = async () => {
    // First, run the direct copy script to ensure all GIFs are properly copied
    console.log('Running direct copy of reaction GIFs to ensure correct files are used...');
    await directCopyReactionGifs.processAllReactions();
    console.log('Direct copy of reaction GIFs completed.');
    
    // Now check if data/reaction_gifs directory exists
    const reactionGifsDir = path.join(process.cwd(), 'data', 'reaction_gifs');
    if (!fs.existsSync(reactionGifsDir)) {
        fs.mkdirSync(reactionGifsDir, { recursive: true });
        logger.info(`Created reaction GIFs directory: ${reactionGifsDir}`);
    }

    // Verify each reaction GIF
    const reactionCommands = [
        'smile', 'happy', 'dance', 'cry', 'blush', 'laugh',
        'hug', 'pat', 'kiss', 'cuddle', 'wave', 'wink', 'poke',
        'slap', 'bonk', 'bite', 'punch', 'highfive', 'yeet', 'kill'
    ];

    let missingGifs = [];
    let validGifs = [];

    reactionCommands.forEach(cmd => {
        const gifPath = path.join(reactionGifsDir, `${cmd}.gif`);
        if (fs.existsSync(gifPath)) {
            logger.info(`✅ Found valid GIF for ${cmd}: ${gifPath}`);
            validGifs.push(cmd);
        } else {
            logger.warn(`❌ Missing GIF for ${cmd}: ${gifPath}`);
            missingGifs.push(cmd);
        }
    });

    logger.info(`Reaction GIFs validation complete. Valid: ${validGifs.length}, Missing: ${missingGifs.length}`);

    // Always run enhanced fix to ensure correct GIF mapping
    // This ensures that not only missing GIFs are fixed but also that 
    // Verify all GIFs exist in data/reaction_gifs directory only
    try {
        // Apply enhanced reaction verification (only using data/reaction_gifs)
        try {
            const enhancedFixModule = require('./enhanced-reaction-fix');
            await enhancedFixModule.fixReactionGifs();
            logger.info('Enhanced reaction GIF verification completed successfully');
            logger.info('Using ONLY data/reaction_gifs directory for all reactions');
            console.log('Using ONLY data/reaction_gifs directory for all reactions');
        } catch (enhancedErr) {
            logger.warn(`Could not complete reaction GIF verification: ${enhancedErr.message}`);
        }
        
        logger.info('Reaction GIFs verified and fixed on startup');
    } catch (err) {
        logger.error(`Error fixing reaction GIFs: ${err.message}`);
    }
};

// Enable JSON parsing for request bodies
app.use(express.json());

// API endpoint to check bot status
app.get('/status', (req, res) => {
    // For command count, include both commands available in the handler
    // and configuration details from our command loading process
    let commandCount = handler?.commands?.size || 0;
    let configuredCommandCount = 0;
    
    try {
        // Get the config directory path
        const configDir = path.join(process.cwd(), 'src/config/commands');
        
        // Check if the directory exists before trying to read
        if (fs.existsSync(configDir)) {
            // Read all JSON files
            const configFiles = fs.readdirSync(configDir);
            
            // Count commands in each JSON file
            for (const file of configFiles) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(configDir, file);
                    const fileContent = fs.readFileSync(filePath, 'utf8');
                    try {
                        const config = JSON.parse(fileContent);
                        if (Array.isArray(config.commands)) {
                            configuredCommandCount += config.commands.length;
                        }
                    } catch (e) {
                        // JSON parsing error, skip this file
                        console.error(`Error parsing ${file}:`, e.message);
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error reading command configurations:', err);
    }
    
    res.json({
        status: connectionStatus,
        commandsLoaded: commandCount,
        commandsConfigured: configuredCommandCount,
        qrAvailable: latestQR !== null
    });
});

// UI endpoint to display all reaction commands with visuals
app.get('/reaction-commands', (req, res) => {
    try {
        const reactionGifsDir = path.join(process.cwd(), 'data', 'reaction_gifs');
        const reactionsModule = require('./commands/reactions');
        
        // Get all reaction commands from the module
        const reactionCommands = Object.keys(reactionsModule.commands)
            .filter(cmd => cmd !== 'init')
            .sort();
            
        // Build array of available reactions
        const availableReactions = reactionCommands.map(cmd => {
            const gifPath = path.join(reactionGifsDir, `${cmd}.gif`);
            const exists = fs.existsSync(gifPath);
            let size = 0;
            let sizeFormatted = 'N/A';
            
            if (exists) {
                try {
                    const stats = fs.statSync(gifPath);
                    size = stats.size;
                    sizeFormatted = (stats.size / 1024).toFixed(2) + ' KB';
                } catch (err) {
                    // Ignore errors
                }
            }
            
            return {
                name: cmd,
                exists,
                size,
                sizeFormatted,
                url: `/test-reaction?type=${cmd}`
            };
        });
        
        // Create HTML for the reaction commands page
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Bot Reaction Commands</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #f0f4f7;
                    margin: 0;
                    padding: 20px;
                }
                h1 {
                    color: #128C7E;
                    text-align: center;
                }
                .reactions-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 20px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .reaction-card {
                    background-color: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    transition: transform 0.3s ease;
                }
                .reaction-card:hover {
                    transform: translateY(-5px);
                }
                .reaction-gif {
                    height: 150px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: #f0f0f0;
                }
                .reaction-gif img {
                    max-width: 100%;
                    max-height: 150px;
                    object-fit: contain;
                }
                .reaction-details {
                    padding: 15px;
                }
                .reaction-name {
                    font-weight: bold;
                    font-size: 1.1em;
                    margin: 0 0 5px 0;
                    color: #128C7E;
                }
                .reaction-size {
                    color: #888;
                    font-size: 0.9em;
                    margin-bottom: 10px;
                }
                .reaction-command {
                    background-color: #f0f8ff;
                    padding: 8px;
                    border-radius: 5px;
                    font-family: monospace;
                    font-size: 0.9em;
                }
                .not-available {
                    color: #d32f2f;
                    font-style: italic;
                }
                .stats {
                    background-color: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                    padding: 15px;
                    margin: 0 auto 20px auto;
                    max-width: 1200px;
                }
                .stats-title {
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 10px;
                }
                .stat-item {
                    padding: 10px;
                    background-color: #f0f8ff;
                    border-radius: 5px;
                }
                .back-button {
                    display: block;
                    margin: 20px auto;
                    padding: 10px 20px;
                    background-color: #128C7E;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    text-decoration: none;
                    text-align: center;
                    width: 200px;
                }
            </style>
        </head>
        <body>
            <h1>WhatsApp Bot Reaction Commands</h1>
            
            <div class="stats">
                <div class="stats-title">Reaction Commands Statistics</div>
                <div class="stats-grid">
                    <div class="stat-item">Total Commands: ${reactionCommands.length}</div>
                    <div class="stat-item">Available GIFs: ${availableReactions.filter(r => r.exists).length}</div>
                    <div class="stat-item">Missing GIFs: ${availableReactions.filter(r => !r.exists).length}</div>
                </div>
            </div>
            
            <div class="reactions-container">
                ${availableReactions.map(reaction => `
                    <div class="reaction-card">
                        <div class="reaction-gif">
                            ${reaction.exists 
                              ? `<img src="${reaction.url}" alt="${reaction.name}" title="${reaction.name}">`
                              : `<span class="not-available">GIF not available</span>`}
                        </div>
                        <div class="reaction-details">
                            <div class="reaction-name">${reaction.name}</div>
                            <div class="reaction-size">Size: ${reaction.sizeFormatted}</div>
                            <div class="reaction-command">!${reaction.name} @user</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <a href="/" class="back-button">Back to Main Page</a>
        </body>
        </html>
        `;
        
        res.send(html);
    } catch (err) {
        logger.error(`Error in /reaction-commands endpoint: ${err.message}`);
        res.status(500).send(`<h1>Error</h1><p>${err.message}</p><a href="/">Back to Home</a>`);
    }
});

// API endpoint to list all available reaction commands
app.get('/reactions', (req, res) => {
    try {
        const reactionGifsDir = path.join(process.cwd(), 'data', 'reaction_gifs');
        const reactionsModule = require('./commands/reactions');
        
        // Get all reaction commands from the module
        const reactionCommands = Object.keys(reactionsModule.commands)
            .filter(cmd => cmd !== 'init')
            .sort();
            
        // Check which GIFs actually exist in the directory
        const availableGifs = [];
        const missingGifs = [];
        
        reactionCommands.forEach(cmd => {
            const gifPath = path.join(reactionGifsDir, `${cmd}.gif`);
            if (fs.existsSync(gifPath)) {
                const stats = fs.statSync(gifPath);
                availableGifs.push({
                    name: cmd,
                    path: `/test-reaction?type=${cmd}`,
                    size: stats.size,
                    sizeFormatted: (stats.size / 1024).toFixed(2) + ' KB'
                });
            } else {
                missingGifs.push(cmd);
            }
        });
        
        // Return JSON with reaction command information
        return res.json({
            success: true,
            total: reactionCommands.length,
            available: availableGifs.length,
            missing: missingGifs.length,
            reactions: availableGifs,
            missingReactions: missingGifs
        });
    } catch (err) {
        logger.error(`Error in /reactions endpoint: ${err.message}`);
        return res.status(500).json({ error: `Error loading reactions: ${err.message}` });
    }
});

// API endpoint to test reaction GIFs - only use data/reaction_gifs directory
app.get('/test-reaction', (req, res) => {
    const type = req.query.type || 'laugh';
    const reactionGifsDir = path.join(process.cwd(), 'data', 'reaction_gifs');
    const gifPath = path.join(reactionGifsDir, `${type}.gif`);
    
    if (fs.existsSync(gifPath)) {
        try {
            const gifBuffer = fs.readFileSync(gifPath);
            logger.info(`===== API ENDPOINT ===== Using GIF from data/reaction_gifs for ${type}: ${gifPath}`);
            console.log(`===== API ENDPOINT ===== Using GIF from data/reaction_gifs for ${type}: ${gifPath}`);
            res.setHeader('Content-Type', 'image/gif');
            return res.send(gifBuffer);
        } catch (err) {
            logger.error(`Error reading GIF for ${type}: ${err.message}`);
            return res.status(500).json({ error: `Error reading GIF: ${err.message}` });
        }
    } else {
        // If the GIF doesn't exist in data/reaction_gifs, return 404
        return res.status(404).json({ error: `GIF for reaction ${type} not found in data/reaction_gifs directory` });
    }
});


// API endpoint to get list of all available reaction commands
app.get('/reaction-commands', async (req, res) => {
    const reactionGifsDir = path.join(process.cwd(), 'data', 'reaction_gifs');
    const validReactions = [
        'smile', 'happy', 'dance', 'cry', 'blush', 'laugh',
        'hug', 'pat', 'kiss', 'cuddle', 'wave', 'wink', 'poke',
        'slap', 'bonk', 'bite', 'punch', 'highfive', 'yeet', 'kill'
    ];
    
    // Check each reaction GIF to make sure it exists
    const availableReactions = validReactions.filter(reaction => {
        const gifPath = path.join(reactionGifsDir, `${reaction}.gif`);
        return fs.existsSync(gifPath);
    });
    
    // Create basic HTML page to display the reaction commands with GIF previews
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>WhatsApp Bot Reaction Commands</title>
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
                max-width: 800px;
                width: 100%;
            }
            h1 {
                color: #128C7E;
                margin-bottom: 5px;
            }
            h2 {
                color: #075E54;
                font-size: 1.2em;
                margin-top: 0;
            }
            .reaction-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 20px;
                margin-top: 20px;
            }
            .reaction-item {
                border: 1px solid #e0e0e0;
                border-radius: 10px;
                padding: 10px;
                background-color: #f9f9f9;
                transition: transform 0.2s;
            }
            .reaction-item:hover {
                transform: scale(1.05);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }
            .reaction-gif {
                width: 100%;
                height: 150px;
                object-fit: cover;
                border-radius: 5px;
                margin-bottom: 10px;
            }
            .reaction-name {
                font-weight: bold;
                color: #128C7E;
            }
            .reaction-command {
                font-family: monospace;
                background-color: #f0f0f0;
                padding: 3px 6px;
                border-radius: 3px;
                margin-top: 5px;
                display: inline-block;
            }
            .back-button {
                background-color: #128C7E;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1em;
                margin-top: 20px;
                text-decoration: none;
                display: inline-block;
            }
            .usage-instructions {
                margin-top: 20px;
                padding: 15px;
                background-color: #e8f5e9;
                border-radius: 5px;
                text-align:left;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>BLACKSKY-MD</h1>
            <h2>WhatsApp Bot Reaction Commands</h2>
            
            <div class="usage-instructions">
                <strong>How to use:</strong>
                <p>Send <code>!{command} @user</code> to send a reaction to someone.</p>
                <p>For example, to send a hug to someone, type: <code>!hug @user</code></p>
                <p>The bot will automatically send the reaction GIF in your chat.</p>
            </div>
            
            <div class="reaction-grid">
                ${availableReactions.map(reaction => `
                    <div class="reaction-item">
                        <img src="/test-reaction?type=${reaction}" class="reaction-gif" alt="${reaction} reaction">
                        <div class="reaction-name">${reaction.charAt(0).toUpperCase() + reaction.slice(1)}</div>
                        <div class="reaction-command">!${reaction}</div>
                    </div>
                `).join('')}
            </div>
            
            <a href="/" class="back-button">Back to QR Code</a>            </div>
        </body>
    </html>
    `;
    
    res.send(html);
});

// Test command endpoint for debugging
app.post('/test-command', async (req, res) => {
    try {
        const { command, args = [] } = req.body;
        
        if (!command) {
            return res.status(400).json({ error: 'Command is required' });
        }
        
        // Create a mock message object
        const mockMessage = {
            key: {
                remoteJid: 'test@s.whatsapp.net',
                fromMe: false,
                id: `mock-${Date.now()}`
            },
            message: {
                conversation: `!${command} ${args.join(' ')}`.trim()
            }
        };
        
        // Get the command from the handler
        const commandObj = handler.commands.get(command);
        
        if (!commandObj) {
            return res.status(404).json({ error: 'Command not found' });
        }
        
        // Create a mock socket with logging
        const mockSock = {
            sendMessage: async (jid, content) => {
                logger.info(`Test: Sending message to ${jid}`);
                logger.info(`Test: Content: ${JSON.stringify(content)}`);
                return { status: 'success', jid, content };
            },
            sendPresenceUpdate: async () => {}
        };
        
        // Execute the command
        let result;
        if (typeof commandObj === 'function') {
            result = await commandObj(mockSock, mockMessage, args);
        } else if (commandObj && typeof commandObj.execute === 'function') {
            result = await commandObj.execute(mockSock, mockMessage, args);
        } else {
            return res.status(500).json({ error: 'Invalid command implementation' });
        }
        
        return res.json({ 
            success: true, 
            command,
            result: result || 'Command executed successfully but returned no result'
        });
    } catch (error) {
        logger.error('Error in test command endpoint:', error);
        return res.status(500).json({ 
            error: error.message || 'Unknown error',
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        });
    }
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
    logger.info(`\n✅ QR Web Server running at http://localhost:${PORT}\n`);
    logger.info('✅ Use this URL to access the WhatsApp QR code scanning interface\n');
    
    // Start the WhatsApp connection
    startConnection();
});

// Handle process termination gracefully
process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM');
    if (sock?.ws?.readyState !== sock?.ws?.CLOSED) {
        sock.ws.close();
    }
    setTimeout(() => process.exit(0), 1000);
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT');
    if (sock?.ws?.readyState !== sock?.ws?.CLOSED) {
        sock.ws.close();
    }
    setTimeout(() => process.exit(0), 1000);
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    if (!isReconnecting) startConnection();
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', reason);
    if (!isReconnecting) startConnection();
});

module.exports = { startConnection };