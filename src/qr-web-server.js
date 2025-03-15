/**
 * WhatsApp QR Web Server and Connection Manager
 * This file manages both the QR code display and the WhatsApp connection
 * The bot functionality is handled by the main index.js file
 */

const express = require('express');
const http = require('http');
const qrcode = require('qrcode');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const logger = require('./utils/logger');
const handler = require('./handlers/ultra-minimal-handler');

// Create Express app
const app = express();
const server = http.createServer(app);
const PORT = 5007; // Using port 5007 to match workflow configuration

// QR code state
let latestQR = null;
let connectionStatus = 'disconnected';
let sock = null;
let qrGenerationAttempt = 0;

// Auth directory
const AUTH_DIRECTORY = path.join(process.cwd(), 'auth_info');

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIRECTORY)) {
    fs.mkdirSync(AUTH_DIRECTORY, { recursive: true });
} else {
    // Don't clean auth directory - we want to keep existing credentials
    logger.info('Auth directory already exists, using existing credentials');
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
                            : 'Waiting for QR Code...'}
            </div>

            <div class="qr-container">
                ${latestQR 
                    ? `<img src="${latestQR}" alt="WhatsApp QR Code" width="300" height="300">`
                    : connectionStatus === 'connected'
                        ? `<p>✅ Successfully connected to WhatsApp!</p>
                           <p>Your bot is now active and responding to commands.</p>`
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
                    </ul>
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

// Start WhatsApp connection
async function startConnection() {
    try {
        // Initialize handler
        await handler.init();
        logger.info('Command handler initialized');
        
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIRECTORY);
        logger.info('Auth state loaded');
        
        // Create WhatsApp socket connection
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: ['BLACKSKY-MD', 'Chrome', '100.0.0'],
            logger: pino({ level: 'silent' }),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            markOnlineOnConnect: true,
            syncFullHistory: false
        });

        // Handle connection events
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            logger.info('Connection update:', update?.connection || 'No connection data');

            if (qr) {
                await displayQR(qr);
            }

            if (connection === 'open') {
                connectionStatus = 'connected';
                latestQR = null; // Clear QR code once connected
                await saveCreds();
                logger.info('Connection established successfully!');
                
                try {
                    const user = sock.user;
                    logger.info('Connected as:', user.name || user.verifiedName || user.id.split(':')[0]);
                } catch (e) {
                    logger.error('Could not get user details:', e.message);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                connectionStatus = 'disconnected';
                logger.info(`Connection closed with status code: ${statusCode || 'Unknown'}`);

                if (shouldReconnect) {
                    logger.info('Reconnecting...');
                    setTimeout(startConnection, 5000);
                } else {
                    logger.info('Not reconnecting - user logged out');
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

        return sock;
    } catch (err) {
        logger.error('Error starting connection:', err);
        connectionStatus = 'disconnected';
        setTimeout(startConnection, 5000);
    }
}

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
    startConnection();
});

module.exports = {
    displayQR,
    updateConnectionStatus: (status) => {
        connectionStatus = status;
    }
};