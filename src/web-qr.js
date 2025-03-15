/**
 * Web-Based QR Code Generator for WhatsApp
 * Serves a simple web interface to display the QR code
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const app = express();
const port = 5002;

// Constants
const AUTH_DIR = './auth_info_web';
let qrCodeDataURL = '';
let connectionStatus = 'disconnected';
let lastError = '';
let connectionAttempt = 0;
const MAX_ATTEMPTS = 5;

// Create auth directory if it doesn't exist
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Define browser rotation options
const browserOptions = [
    ['Firefox', '115.0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0'],
    ['Chrome', '120.0.0.0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'],
    ['Edge', '120.0.0.0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'],
    ['Safari', '17.0', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'],
    ['Opera', '105.0.0.0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 OPR/105.0.0.0']
];

// Configure express routes
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp QR Code</title>
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
                .qr-container {
                    margin: 30px auto;
                    padding: 20px;
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                    max-width: 350px;
                }
                .qr-code {
                    margin: 20px auto;
                }
                .qr-code img {
                    max-width: 100%;
                    height: auto;
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
                .instructions {
                    margin-top: 20px;
                    text-align: left;
                    padding: 15px;
                    background: #f9f9f9;
                    border-radius: 5px;
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
                }
                .waiting {
                    color: #666;
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
                .browser-info {
                    margin-top: 10px;
                    font-size: 14px;
                    color: #666;
                }
                .error-details {
                    background-color: #f8f8f8;
                    border-left: 3px solid #d9534f;
                    padding: 10px;
                    margin: 10px 0;
                    text-align: left;
                    font-family: monospace;
                    white-space: pre-wrap;
                    font-size: 12px;
                    color: #d9534f;
                    max-height: 100px;
                    overflow-y: auto;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>WhatsApp QR Code Generator</h1>
                
                <div class="status ${connectionStatus}">
                    Status: ${connectionStatus.toUpperCase()}
                    ${connectionStatus === 'connecting' ? ` (Attempt ${connectionAttempt}/${MAX_ATTEMPTS})` : ''}
                </div>
                
                ${lastError ? `<div class="error-details">${lastError}</div>` : ''}
                
                <div class="qr-container">
                    <div class="qr-code">
                        ${qrCodeDataURL ? 
                            `<img src="${qrCodeDataURL}" alt="WhatsApp QR Code">` : 
                            `<p class="waiting">Waiting for QR code... Please wait.</p>`
                        }
                    </div>
                    
                    <div class="browser-info">
                        Using browser: ${browserOptions[connectionAttempt % browserOptions.length][0]}
                    </div>
                    
                    <a href="/" class="button">Refresh QR Code</a>
                </div>
                
                <div class="instructions">
                    <h3>How to Connect:</h3>
                    <ol>
                        <li>Open WhatsApp on your phone</li>
                        <li>Go to Settings → Linked Devices</li>
                        <li>Tap on "Link a Device"</li>
                        <li>Scan the QR code above with your phone</li>
                    </ol>
                    <p><strong>Note:</strong> If you see "Connection Failure (405)" errors, this means WhatsApp is detecting and blocking the cloud environment. Try the local connection method described in the <a href="/local">Local Connection Instructions</a>.</p>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/local', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Local Connection Instructions</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                    color: #333;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }
                h1 { color: #128C7E; }
                h2 { color: #075E54; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
                pre {
                    background-color: #f8f8f8;
                    padding: 10px;
                    border-radius: 5px;
                    overflow-x: auto;
                }
                .steps {
                    counter-reset: step-counter;
                    margin-left: 0;
                    padding-left: 0;
                }
                .steps li {
                    counter-increment: step-counter;
                    list-style-type: none;
                    position: relative;
                    padding-left: 40px;
                    margin-bottom: 20px;
                }
                .steps li::before {
                    content: counter(step-counter);
                    position: absolute;
                    left: 0;
                    top: 0;
                    background-color: #128C7E;
                    color: white;
                    font-weight: bold;
                    border-radius: 50%;
                    width: 25px;
                    height: 25px;
                    line-height: 25px;
                    text-align: center;
                }
                .note {
                    background-color: #ffffcc;
                    padding: 10px;
                    border-left: 3px solid #ffcc00;
                    margin: 10px 0;
                }
                a {
                    color: #128C7E;
                    text-decoration: none;
                }
                a:hover {
                    text-decoration: underline;
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
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Local Connection Instructions</h1>
                
                <div class="note">
                    <strong>Note:</strong> WhatsApp restricts connections from cloud environments like Replit, which is why you're seeing 405 errors. The solution is to generate the QR code locally on your own computer and then transfer the authentication files to Replit.
                </div>
                
                <h2>Step-by-Step Guide</h2>
                
                <ol class="steps">
                    <li>
                        <h3>Download the local connection script</h3>
                        <p>Save the <a href="/download-script">local-connect.js</a> file to your local machine</p>
                    </li>
                    
                    <li>
                        <h3>Install necessary packages</h3>
                        <pre>npm install @whiskeysockets/baileys qrcode-terminal</pre>
                    </li>
                    
                    <li>
                        <h3>Run the local connection script</h3>
                        <pre>node local-connect.js</pre>
                        <p>This will generate a QR code in your terminal</p>
                    </li>
                    
                    <li>
                        <h3>Scan the QR code</h3>
                        <p>Open WhatsApp on your phone, go to Settings → Linked Devices, and scan the QR code</p>
                    </li>
                    
                    <li>
                        <h3>Upload authentication files to Replit</h3>
                        <p>After successful connection, the script will create an <code>auth_info_baileys</code> folder.<br>
                        Upload this entire folder to your Replit project at the root level.</p>
                    </li>
                    
                    <li>
                        <h3>Restart your WhatsApp bot in Replit</h3>
                        <p>With the authentication files in place, your bot should connect without needing to scan a QR code</p>
                    </li>
                </ol>
                
                <h2>Troubleshooting</h2>
                
                <ul>
                    <li><strong>Authentication Expired:</strong> WhatsApp credentials eventually expire. Repeat this process when that happens.</li>
                    <li><strong>Connection Issues:</strong> Make sure your computer has a stable internet connection.</li>
                    <li><strong>Folder Structure:</strong> Ensure the entire auth_info_baileys folder is uploaded to the root of your Replit project.</li>
                </ul>
                
                <a href="/" class="button">Back to QR Generator</a>
            </div>
        </body>
        </html>
    `);
});

app.get('/download-script', (req, res) => {
    const scriptPath = path.join(process.cwd(), 'local-connect.js');
    res.download(scriptPath, 'local-connect.js');
});

app.get('/status', (req, res) => {
    res.json({
        status: connectionStatus,
        qrAvailable: !!qrCodeDataURL,
        attempt: connectionAttempt,
        maxAttempts: MAX_ATTEMPTS,
        error: lastError
    });
});

// Clear auth state
async function clearAuthState() {
    if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        fs.mkdirSync(AUTH_DIR, { recursive: true });
        console.log('[Auth] Auth state cleared');
    }
}

// Start WhatsApp connection
async function startWhatsAppConnection() {
    // Clear previous connection data
    await clearAuthState();
    
    // Update status
    connectionStatus = 'connecting';
    lastError = '';
    
    try {
        // Get auth state
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        
        // Select browser fingerprint based on attempt number
        const browser = browserOptions[connectionAttempt % browserOptions.length];
        console.log(`[Connection] Using ${browser[0]} browser fingerprint (attempt ${connectionAttempt + 1}/${MAX_ATTEMPTS})`);
        
        // Generate a unique device ID
        const deviceId = `BLACKSKY-WEB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        
        // Connect to WhatsApp
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: [deviceId, browser[0], browser[1]],
            version: [2, 2323, 4],
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            emitOwnEvents: false,
            markOnlineOnConnect: false,
            syncFullHistory: false,
            userAgent: browser[2] // Use user agent matching the browser
        });
        
        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // Handle QR code updates
            if (qr) {
                console.log('[QR] New QR code received');
                // Convert QR to data URL for web display
                qrCodeDataURL = await qrcode.toDataURL(qr);
            }
            
            // Handle successful connection
            if (connection === 'open') {
                console.log('[Connection] Successfully connected to WhatsApp');
                connectionStatus = 'connected';
                
                // Save credentials
                await saveCreds();
                
                // Copy to main auth directory for the bot
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
                        fs.copyFileSync(srcPath, destPath);
                    }
                    
                    console.log('[Auth] Copied credentials to main auth directory');
                } catch (err) {
                    console.error('[Auth] Failed to copy credentials:', err);
                }
            }
            
            // Handle disconnection
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
                console.log(`[Connection] Connection closed: ${errorMessage} (Code: ${statusCode})`);
                
                lastError = `${errorMessage} (Status code: ${statusCode})`;
                connectionStatus = 'disconnected';
                
                // Check if this was a 405 Method Not Allowed error
                if (statusCode === 405 || errorMessage.includes('Connection Failure')) {
                    console.log('[Connection] Detected 405 error (cloud environment restriction)');
                    
                    // Try the next browser fingerprint if we haven't reached max attempts
                    if (connectionAttempt < MAX_ATTEMPTS - 1) {
                        connectionAttempt++;
                        console.log(`[Connection] Will try again with a different browser fingerprint (${connectionAttempt + 1}/${MAX_ATTEMPTS})`);
                        
                        // Wait before retrying
                        setTimeout(startWhatsAppConnection, 5000);
                    } else {
                        console.log('[Connection] Max attempts reached, giving up');
                    }
                } else if (statusCode !== DisconnectReason.loggedOut) {
                    // For other disconnects that aren't explicit logouts, try to reconnect
                    console.log('[Connection] Attempting to reconnect...');
                    setTimeout(startWhatsAppConnection, 5000);
                }
            }
        });
        
        // Save credentials on update
        sock.ev.on('creds.update', saveCreds);
        
    } catch (error) {
        console.error('[Error]', error);
        lastError = error.message;
        connectionStatus = 'error';
        
        // Try again if we haven't reached max attempts
        if (connectionAttempt < MAX_ATTEMPTS - 1) {
            connectionAttempt++;
            console.log(`[Connection] Will retry after error (${connectionAttempt + 1}/${MAX_ATTEMPTS})`);
            setTimeout(startWhatsAppConnection, 5000);
        }
    }
}

// Start server and connection
async function startServer() {
    // Start the web server
    app.listen(port, '0.0.0.0', () => {
        console.log(`[Server] Web QR server running at http://localhost:${port}`);
        
        // Start the WhatsApp connection
        connectionAttempt = 0;
        startWhatsAppConnection();
    });
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n[Server] Shutting down...');
    process.exit(0);
});

// Start the server
startServer();