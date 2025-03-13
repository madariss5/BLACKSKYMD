/**
 * Heroku Deployment Script for BLACKSKY-MD
 * This version is optimized for Heroku environments where filesystem changes aren't persistent
 */

require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

// Import message handlers
const { messageHandler } = require('./src/handlers/messageHandler');

// Use environment variables for port assignment
const PORT = process.env.PORT || 5000;
const AUTH_STRING = process.env.SESSION_STRING || '';
const SESSION_DIR = path.join(__dirname, 'auth_info_heroku');

// Set up pino logger
const logger = pino({
    level: 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    }
});

// Initialize express app for QR display and session management
const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Global variables
let sock = null;
let startTime = Date.now();
let lastQR = null;
let connectionState = {
    state: 'disconnected',
    message: 'Waiting for authentication',
    qrCode: null,
    uptime: 0,
    connected: false,
    disconnectReason: null
};

// Create directories if they don't exist
if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// HTML content for QR and authentication
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BLACKSKY-MD Heroku Authentication</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background-color: #f0f0f0;
            padding: 20px;
            box-sizing: border-box;
        }
        .container {
            background-color: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 800px;
            width: 100%;
            margin-bottom: 20px;
        }
        h1 {
            color: #128C7E;
        }
        .qr-container {
            margin: 20px 0;
            padding: 15px;
            border: 2px dashed #ddd;
            border-radius: 8px;
            background-color: white;
            display: inline-block;
        }
        .status {
            margin: 20px 0;
            padding: 10px;
            border-radius: 5px;
            font-weight: bold;
        }
        .connected {
            background-color: #DFF2BF;
            color: #4F8A10;
        }
        .disconnected {
            background-color: #FEEFB3;
            color: #9F6000;
        }
        .error {
            background-color: #FFD2D2;
            color: #D8000C;
        }
        .instructions {
            text-align: left;
            margin: 20px 0;
            background-color: #e9f7fe;
            padding: 15px;
            border-radius: 5px;
            color: #3a87ad;
        }
        img {
            max-width: 100%;
            height: auto;
        }
        .input-area {
            margin: 20px 0;
            padding: 15px;
            background-color: #f9f9f9;
            border-radius: 5px;
            text-align: left;
            width: 100%;
        }
        textarea {
            width: 100%;
            min-height: 150px;
            margin: 10px 0;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: monospace;
            font-size: 14px;
        }
        button {
            background-color: #128C7E;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin: 5px;
        }
        button:hover {
            background-color: #0C6B5E;
        }
        .tabs {
            display: flex;
            margin-bottom: 20px;
            width: 100%;
        }
        .tab {
            padding: 10px 20px;
            background-color: #eee;
            border: 1px solid #ddd;
            cursor: pointer;
            flex: 1;
            text-align: center;
        }
        .tab.active {
            background-color: #128C7E;
            color: white;
            border-color: #128C7E;
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>BLACKSKY-MD Heroku Authentication</h1>
        
        <div class="tabs">
            <div class="tab active" onclick="showTab('qr-tab')">QR Code Method</div>
            <div class="tab" onclick="showTab('session-tab')">Session String Method</div>
        </div>
        
        <div id="qr-tab" class="tab-content active">
            <div class="instructions">
                <h3>QR Code Scan Instructions:</h3>
                <ol>
                    <li>Open WhatsApp on your smartphone</li>
                    <li>Go to Settings or Menu and select "Linked Devices"</li>
                    <li>Tap on "Link a Device"</li>
                    <li>Scan the QR code below with your smartphone</li>
                    <li>After successful connection, copy the Session String to save for future deployments</li>
                </ol>
            </div>
            
            <div class="qr-container">
                <img id="qrcode" src="/qrcode.png" alt="QR Code">
                <div style="font-size: 14px; color: #666; margin-top: 5px;">The QR code refreshes automatically every 20 seconds</div>
            </div>
            
            <div id="status" class="status disconnected">
                Status: Waiting for QR code scan...
            </div>
        </div>
        
        <div id="session-tab" class="tab-content">
            <div class="instructions">
                <h3>Session String Instructions:</h3>
                <ol>
                    <li>Paste your previously saved Session String in the text area below</li>
                    <li>Click "Authenticate with Session String"</li>
                    <li>This method allows you to reconnect without scanning a QR code each time</li>
                    <li>Ideal for Heroku deployments where filesystem changes aren't persistent</li>
                </ol>
            </div>
            
            <div class="input-area">
                <h3>Enter Your Session String:</h3>
                <textarea id="session-string" placeholder="Paste your session string here..."></textarea>
                <button onclick="submitSessionString()">Authenticate with Session String</button>
            </div>
        </div>
        
        <div id="session-output" style="display: none;" class="input-area">
            <h3>Your Session String (Save this for future use):</h3>
            <textarea id="session-output-text" readonly></textarea>
            <button onclick="copySessionString()">Copy to Clipboard</button>
            <p>Important: Add this string to your Heroku config variables as SESSION_STRING</p>
        </div>
    </div>

    <script>
        // Tab functionality
        function showTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            document.getElementById(tabId).classList.add('active');
            document.querySelector(`.tab[onclick="showTab('${tabId}')"]`).classList.add('active');
        }
        
        // Auto-refresh the QR code image and check status
        setInterval(() => {
            const img = document.getElementById('qrcode');
            const timestamp = new Date().getTime();
            img.src = '/qrcode.png?t=' + timestamp;
            
            // Also check connection status
            fetch('/status')
                .then(response => response.json())
                .then(data => {
                    const statusElement = document.getElementById('status');
                    statusElement.textContent = 'Status: ' + data.message;
                    
                    // Remove old classes
                    statusElement.classList.remove('connected', 'disconnected', 'error');
                    
                    // Add appropriate class
                    if (data.state === 'connected') {
                        statusElement.classList.add('connected');
                        
                        // Display session string if connected
                        if (data.sessionString) {
                            document.getElementById('session-output').style.display = 'block';
                            document.getElementById('session-output-text').value = data.sessionString;
                        }
                    } else if (data.state === 'error') {
                        statusElement.classList.add('error');
                    } else {
                        statusElement.classList.add('disconnected');
                    }
                })
                .catch(err => console.error('Error fetching status:', err));
        }, 5000);
        
        // Submit session string for authentication
        function submitSessionString() {
            const sessionString = document.getElementById('session-string').value.trim();
            if (!sessionString) {
                alert('Please enter a valid session string');
                return;
            }
            
            fetch('/auth/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sessionString })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Authentication successful! Bot is connecting...');
                    setTimeout(() => {
                        window.location.reload();
                    }, 3000);
                } else {
                    alert('Authentication failed: ' + data.message);
                }
            })
            .catch(err => {
                alert('Error: ' + err.message);
            });
        }
        
        // Copy session string to clipboard
        function copySessionString() {
            const sessionText = document.getElementById('session-output-text');
            sessionText.select();
            document.execCommand('copy');
            alert('Session string copied to clipboard!');
        }
    </script>
</body>
</html>
`;

// Write HTML to public directory
if (!fs.existsSync('public')) {
    fs.mkdirSync('public', { recursive: true });
}
fs.writeFileSync('public/index.html', htmlContent);

/**
 * Convert session data to a transportable string
 */
function sessionToString(sessionData) {
    try {
        return Buffer.from(JSON.stringify(sessionData)).toString('base64');
    } catch (error) {
        logger.error('Error converting session to string:', error);
        return null;
    }
}

/**
 * Parse session string back to session data
 */
function stringToSession(sessionString) {
    try {
        const jsonString = Buffer.from(sessionString, 'base64').toString();
        return JSON.parse(jsonString);
    } catch (error) {
        logger.error('Error parsing session string:', error);
        return null;
    }
}

/**
 * Save session data to filesystem
 */
async function saveSessionData(sessionData) {
    try {
        const credsPath = path.join(SESSION_DIR, 'creds.json');
        fs.writeFileSync(credsPath, JSON.stringify(sessionData));
        logger.info('Session data saved to filesystem');
        return true;
    } catch (error) {
        logger.error('Error saving session data:', error);
        return false;
    }
}

/**
 * Load session data from environment or filesystem
 */
async function loadSessionData() {
    try {
        // Try to load from environment variable first
        if (AUTH_STRING) {
            const sessionData = stringToSession(AUTH_STRING);
            if (sessionData) {
                logger.info('Loaded session data from environment variable');
                await saveSessionData(sessionData);
                return sessionData;
            }
        }
        
        // Fall back to filesystem if available
        const credsPath = path.join(SESSION_DIR, 'creds.json');
        if (fs.existsSync(credsPath)) {
            const sessionData = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            logger.info('Loaded session data from filesystem');
            return sessionData;
        }
        
        logger.info('No existing session data found');
        return null;
    } catch (error) {
        logger.error('Error loading session data:', error);
        return null;
    }
}

/**
 * Initialize WhatsApp connection
 */
async function connectToWhatsApp() {
    try {
        connectionState.state = 'connecting';
        connectionState.message = 'Initializing WhatsApp connection...';
        
        // Set up custom auth state
        let creds = await loadSessionData();
        
        // Create auth state handlers
        const saveState = async (newCreds) => {
            creds = newCreds;
            await saveSessionData(creds);
            
            // Update connection state with new session string
            if (creds) {
                connectionState.sessionString = sessionToString(creds);
            }
        };
        
        const getState = async () => {
            return {
                creds
            };
        };
        
        // Create WhatsApp socket
        sock = makeWASocket({
            auth: {
                creds: creds || undefined,
                keys: undefined
            },
            printQRInTerminal: true,
            logger: logger.child({ level: 'silent' }),
            browser: ['BLACKSKY-MD', 'Chrome', '121.0.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            markOnlineOnConnect: true,
            emitOwnEvents: false,
            syncFullHistory: false
        });
        
        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                lastQR = qr;
                connectionState.state = 'qr_ready';
                connectionState.qrCode = qr;
                connectionState.message = 'QR Code ready for scanning';
                logger.info('New QR code generated');
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                logger.info(`Connection closed with status code: ${statusCode}`);
                
                connectionState.state = 'disconnected';
                connectionState.connected = false;
                connectionState.message = `Connection closed (${statusCode}). Please refresh the page.`;
                
                // If logged out, clear credentials
                if (statusCode === DisconnectReason.loggedOut) {
                    creds = null;
                    await saveState(null);
                    logger.info('Logged out. Credentials cleared.');
                }
                
                // Reconnect except if logged out
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    logger.info('Attempting to reconnect...');
                    setTimeout(connectToWhatsApp, 5000);
                }
            } else if (connection === 'open') {
                logger.info('WhatsApp connection established!');
                connectionState.state = 'connected';
                connectionState.connected = true;
                connectionState.message = 'Connected to WhatsApp!';
                
                // Update session string for UI display
                if (creds) {
                    connectionState.sessionString = sessionToString(creds);
                }
            }
        });
        
        // Handle credential updates
        sock.ev.on('creds.update', saveState);
        
        // Handle messages
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type === 'notify') {
                for (const message of messages) {
                    try {
                        await messageHandler(sock, message);
                    } catch (err) {
                        logger.error('Error handling message:', err);
                    }
                }
            }
        });
        
        return sock;
    } catch (error) {
        logger.error('Error in WhatsApp connection:', error);
        connectionState.state = 'error';
        connectionState.message = `Connection error: ${error.message}`;
        throw error;
    }
}

/**
 * Get formatted uptime string
 */
function getUptime() {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

// Web server endpoints
app.get('/qrcode.png', async (req, res) => {
    if (lastQR) {
        try {
            // Convert QR data to PNG buffer
            const qrImage = await qrcode.toBuffer(lastQR);
            res.type('png');
            res.send(qrImage);
        } catch (err) {
            logger.error('Error generating QR image:', err);
            res.status(500).send('Error generating QR code');
        }
    } else {
        // If no QR code is available yet, generate a placeholder
        res.status(503).send('QR code not yet available');
    }
});

app.get('/status', (req, res) => {
    const status = {
        ...connectionState,
        uptime: getUptime()
    };
    res.json(status);
});

// Endpoint to authenticate with session string
app.post('/auth/session', async (req, res) => {
    try {
        const { sessionString } = req.body;
        
        if (!sessionString) {
            return res.status(400).json({
                success: false,
                message: 'Session string is required'
            });
        }
        
        const sessionData = stringToSession(sessionString);
        
        if (!sessionData) {
            return res.status(400).json({
                success: false,
                message: 'Invalid session string format'
            });
        }
        
        // Save the session data
        await saveSessionData(sessionData);
        
        // Display in logs for debugging
        logger.info('Session data received and saved');
        
        // Update auth string
        process.env.SESSION_STRING = sessionString;
        
        // Restart connection
        if (sock) {
            sock.ev.removeAllListeners();
            sock = null;
        }
        
        // Initialize connection with new credentials
        setTimeout(connectToWhatsApp, 1000);
        
        res.json({
            success: true,
            message: 'Session data accepted. Connecting to WhatsApp...'
        });
    } catch (error) {
        logger.error('Error processing session string:', error);
        res.status(500).json({
            success: false,
            message: `Error: ${error.message}`
        });
    }
});

/**
 * Main application startup
 */
async function start() {
    try {
        logger.info('Starting BLACKSKY-MD Heroku Deployment...');
        
        // Start web server
        app.listen(PORT, '0.0.0.0', () => {
            logger.info(`Server started on port ${PORT}`);
            
            // Initialize WhatsApp connection
            connectToWhatsApp().catch(err => {
                logger.error('Failed to initialize WhatsApp:', err);
            });
        });
    } catch (error) {
        logger.error('Failed to start application:', error);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    // Don't exit - just log and continue
});

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err);
    // Don't exit - just log and continue
});

// Start the application
start();