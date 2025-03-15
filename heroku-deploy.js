/**
 * Heroku Deployment Script for BLACKSKY-MD
 * This version is optimized for Heroku environments where filesystem changes aren't persistent
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const express = require('express');
const qrcode = require('qrcode');
const http = require('http');
const app = express();
const server = http.createServer(app);

// Constants
const PORT = process.env.PORT || 5000;
const AUTH_DIR = './auth_info';
const SESSION_PATH = './session.json';
let messageHandler = null;

// Session state
let sock = null;
let qrCodeDataURL = null;
let connectionStatus = 'disconnected';
let startTime = Date.now();
let sessionData = null;

// Try to load message handler
try {
    const { messageHandler: handler } = require('./src/handlers/messageHandler');
    messageHandler = handler;
} catch (err) {
    console.log('Warning: Message handler not loaded yet');
}

/**
 * Convert session data to a transportable string
 */
function sessionToString(sessionData) {
    try {
        // Convert to JSON string then Base64 encode for safety
        const jsonData = JSON.stringify(sessionData);
        const base64Data = Buffer.from(jsonData).toString('base64');
        return base64Data;
    } catch (error) {
        console.error('Error converting session to string:', error);
        return null;
    }
}

/**
 * Parse session string back to session data
 */
function stringToSession(sessionString) {
    try {
        // Decode Base64 string then parse JSON
        const jsonData = Buffer.from(sessionString, 'base64').toString();
        const parsedData = JSON.parse(jsonData);
        return parsedData;
    } catch (error) {
        console.error('Error parsing session string:', error);
        return null;
    }
}

/**
 * Save session data to filesystem
 */
async function saveSessionData(sessionData) {
    try {
        // First convert to safe string format
        const sessionString = sessionToString(sessionData);
        if (!sessionString) return false;

        // Save to file
        fs.writeFileSync(SESSION_PATH, sessionString);
        console.log('Session data saved to file');

        // Also store in environment variable for Heroku persistence
        // Note: This won't actually work in Heroku as env vars are read-only at runtime
        // This is just shown as an example of the concept
        process.env.SESSION_DATA = sessionString;

        return true;
    } catch (error) {
        console.error('Error saving session data:', error);
        return false;
    }
}

/**
 * Load session data from environment or filesystem
 */
async function loadSessionData() {
    try {
        // Try to load from environment variable first (Heroku persistence)
        if (process.env.SESSION_DATA) {
            console.log('Found session data in environment');
            const sessionData = stringToSession(process.env.SESSION_DATA);
            if (sessionData) {
                console.log('Successfully loaded session from environment');
                return sessionData;
            }
        }

        // Fall back to filesystem
        if (fs.existsSync(SESSION_PATH)) {
            console.log('Found session data file');
            const sessionString = fs.readFileSync(SESSION_PATH, 'utf8');
            const sessionData = stringToSession(sessionString);
            if (sessionData) {
                console.log('Successfully loaded session from file');
                return sessionData;
            }
        }

        console.log('No valid session data found');
        return null;
    } catch (error) {
        console.error('Error loading session data:', error);
        return null;
    }
}

/**
 * Initialize WhatsApp connection
 */
async function connectToWhatsApp() {
    try {
        // Create auth directory if it doesn't exist
        if (!fs.existsSync(AUTH_DIR)) {
            fs.mkdirSync(AUTH_DIR, { recursive: true });
        }

        // Initialize auth state
        let authState;

        // Try to load session data first
        const savedSession = await loadSessionData();
        if (savedSession && savedSession.creds) {
            console.log('Restoring from saved session');

            // Write creds to auth file
            fs.writeFileSync(path.join(AUTH_DIR, 'creds.json'), JSON.stringify(savedSession.creds, null, 2));

            // Initialize from file
            console.log('Initializing from auth file');
        }

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

        // Generate a unique browser ID for Heroku
        const browserId = `BLACKSKY-HEROKU-${Date.now().toString(36)}`;
        console.log('Using browser ID:', browserId);

        // Create WhatsApp socket with optimized settings for Heroku
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: [browserId, 'Chrome', '110.0.0'],
            logger: pino({ level: 'silent' }),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            emitOwnEvents: false,
            markOnlineOnConnect: false,
            // Optimize for Heroku's limited resources
            syncFullHistory: false,
            fireAndForget: true,
            retryRequestDelayMs: 1000
        });

        // Handle connection events
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                // Generate QR code and store it
                qrCodeDataURL = await qrcode.toDataURL(qr);
                console.log('New QR code generated');
            }

            if (connection) {
                connectionStatus = connection;
                console.log('Connection status:', connection);
            }

            if (connection === 'open') {
                console.log('Connection established successfully');

                // On successful connection, save credentials
                try {
                    await saveCreds();
                    console.log('Credentials saved to filesystem');

                    // Try to make a more permanent backup of the session
                    if (sock.authState && sock.authState.creds) {
                        // Create session data object
                        sessionData = {
                            creds: sock.authState.creds,
                            timestamp: Date.now(),
                            version: '1.0'
                        };

                        // Save to more permanent storage
                        await saveSessionData(sessionData);
                        console.log('Session data backed up successfully');

                        // Log successful connection details
                        console.log('Connected as:', sock.user.id.split(':')[0]);
                    }
                } catch (err) {
                    console.error('Error saving credentials:', err);
                }

                // Initialize message handler now that we're connected
                if (messageHandler) {
                    console.log('Initializing message handler');

                    sock.ev.on('messages.upsert', async ({ messages, type }) => {
                        if (type === 'notify') {
                            for (const message of messages) {
                                try {
                                    await messageHandler(sock, message);
                                } catch (err) {
                                    console.error('Error handling message:', err);
                                }
                            }
                        }
                    });
                } else {
                    console.warn('No message handler available');

                    // Try to load it dynamically
                    try {
                        const { messageHandler: handler } = require('./src/handlers/messageHandler');
                        if (handler) {
                            messageHandler = handler;
                            console.log('Successfully loaded message handler dynamically');

                            sock.ev.on('messages.upsert', async ({ messages, type }) => {
                                if (type === 'notify') {
                                    for (const message of messages) {
                                        try {
                                            await messageHandler(sock, message);
                                        } catch (err) {
                                            console.error('Error handling message:', err);
                                        }
                                    }
                                }
                            });
                        }
                    } catch (err) {
                        console.error('Failed to load message handler dynamically:', err);
                    }
                }
            }

            if (connection === 'close') {
                // Handle disconnection
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`Connection closed with status code: ${statusCode}`);

                // Only attempt reconnection if not logged out
                if (statusCode !== DisconnectReason.loggedOut) {
                    console.log('Attempting to reconnect...');
                    setTimeout(connectToWhatsApp, 5000);
                } else {
                    console.log('Not reconnecting - logged out');
                }
            }
        });

        // Save credentials when they update
        sock.ev.on('creds.update', async (creds) => {
            await saveCreds();

            // Update our session backup
            if (sessionData) {
                sessionData.creds = creds;
                sessionData.timestamp = Date.now();
                await saveSessionData(sessionData);
            } else {
                // Create new session data
                sessionData = {
                    creds: creds,
                    timestamp: Date.now(),
                    version: '1.0'
                };
                await saveSessionData(sessionData);
            }
            console.log('Credentials updated and backed up');
        });

        return sock;
    } catch (error) {
        console.error('Connection error:', error);
        setTimeout(connectToWhatsApp, 10000);
    }
}

/**
 * Get formatted uptime string
 */
function getUptime() {
    const uptime = Date.now() - startTime;
    const seconds = Math.floor(uptime / 1000) % 60;
    const minutes = Math.floor(uptime / (1000 * 60)) % 60;
    const hours = Math.floor(uptime / (1000 * 60 * 60)) % 24;
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));

    let uptimeString = '';
    if (days > 0) uptimeString += `${days}d `;
    if (hours > 0) uptimeString += `${hours}h `;
    if (minutes > 0) uptimeString += `${minutes}m `;
    uptimeString += `${seconds}s`;

    return uptimeString;
}

/**
 * Main application startup
 */
async function start() {
    // Set up Express endpoints

    // Home page with status info
    app.get('/', (req, res) => {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>BLACKSKY WhatsApp Bot</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                        line-height: 1.6;
                    }
                    h1 { color: #128C7E; }
                    .card {
                        background: #f5f5f5;
                        border-radius: 8px;
                        padding: 20px;
                        margin-bottom: 20px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }
                    .status {
                        display: inline-block;
                        padding: 5px 10px;
                        border-radius: 4px;
                        font-weight: bold;
                    }
                    .connecting { background: #FFF3CD; color: #856404; }
                    .connected { background: #D4EDDA; color: #155724; }
                    .disconnected { background: #F8D7DA; color: #721C24; }
                </style>
            </head>
            <body>
                <h1>BLACKSKY WhatsApp Bot</h1>
                <div class="card">
                    <h2>Bot Status</h2>
                    <p><strong>Connection:</strong> <span class="status ${connectionStatus}">${connectionStatus.toUpperCase()}</span></p>
                    <p><strong>Uptime:</strong> ${getUptime()}</p>
                    <p><strong>Server Time:</strong> ${new Date().toLocaleString()}</p>
                </div>

                <div class="card">
                    <h2>Connection</h2>
                    ${qrCodeDataURL
                        ? `<p>Scan this QR code with WhatsApp:</p><img src="${qrCodeDataURL}" alt="WhatsApp QR Code" />`
                        : connectionStatus === 'connected'
                            ? '<p>Bot is connected to WhatsApp</p>'
                            : '<p>Waiting for connection...</p>'
                    }
                </div>

                <div class="card">
                    <h2>Bot Information</h2>
                    <p><strong>Version:</strong> 1.0.0</p>
                    <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
                    <p><strong>Session Backup:</strong> ${sessionData ? 'Available' : 'Not available'}</p>
                </div>

                <footer>
                    &copy; 2025 BLACKSKY WhatsApp Bot - Running on Heroku
                </footer>
            </body>
            </html>
        `);
    });

    // QR code endpoint
    app.get('/qr', (req, res) => {
        if (qrCodeDataURL) {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>WhatsApp QR Code</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <meta http-equiv="refresh" content="30">
                    <style>
                        body { 
                            display: flex; 
                            flex-direction: column;
                            align-items: center; 
                            justify-content: center; 
                            min-height: 100vh; 
                            margin: 0;
                            font-family: Arial, sans-serif;
                            background: #f0f2f5;
                            padding: 20px;
                        }
                        .qr-container {
                            background: white;
                            padding: 20px;
                            border-radius: 8px;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                            text-align: center;
                        }
                        h1 { color: #128C7E; }
                        .instructions {
                            margin-top: 20px;
                            text-align: left;
                        }
                        .refresh-note {
                            margin-top: 20px;
                            font-style: italic;
                            color: #666;
                        }
                    </style>
                </head>
                <body>
                    <div class="qr-container">
                        <h1>WhatsApp QR Code</h1>
                        <img src="${qrCodeDataURL}" alt="WhatsApp QR Code" />

                        <div class="instructions">
                            <h3>How to connect:</h3>
                            <ol>
                                <li>Open WhatsApp on your phone</li>
                                <li>Tap Menu or Settings and select Linked Devices</li>
                                <li>Tap on "Link a Device"</li>
                                <li>Point your phone at this screen to scan the QR code</li>
                            </ol>
                        </div>

                        <p class="refresh-note">This page will automatically refresh every 30 seconds.</p>
                    </div>
                </body>
                </html>
            `);
        } else {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>WhatsApp QR Code</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <meta http-equiv="refresh" content="5">
                    <style>
                        body { 
                            display: flex; 
                            flex-direction: column;
                            align-items: center; 
                            justify-content: center; 
                            min-height: 100vh; 
                            margin: 0;
                            font-family: Arial, sans-serif;
                            background: #f0f2f5;
                            padding: 20px;
                        }
                        .message-container {
                            background: white;
                            padding: 20px;
                            border-radius: 8px;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                            text-align: center;
                        }
                        h1 { color: #128C7E; }
                        .status {
                            margin-top: 20px;
                            padding: 10px;
                            background: #FFF3CD;
                            color: #856404;
                            border-radius: 4px;
                        }
                    </style>
                </head>
                <body>
                    <div class="message-container">
                        <h1>WhatsApp QR Code</h1>

                        <div class="status">
                            ${connectionStatus === 'connected'
                                ? 'Already connected to WhatsApp. No QR code needed.'
                                : 'Waiting for QR code generation. This page will refresh automatically.'}
                        </div>
                    </div>
                </body>
                </html>
            `);
        }
    });

    // Status endpoint for monitoring
    app.get('/status', (req, res) => {
        res.json({
            status: connectionStatus,
            uptime: getUptime(),
            serverTime: new Date().toISOString(),
            hasQR: !!qrCodeDataURL,
            hasSession: !!sessionData
        });
    });

    // Start the web server
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Open http://localhost:${PORT} in your browser`);

        // Start WhatsApp connection
        connectToWhatsApp();
    });
}

// Start the application
start();