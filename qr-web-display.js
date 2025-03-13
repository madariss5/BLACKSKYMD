/**
 * Web QR Display for WhatsApp Bot Connection
 * - Creates a web server to display the QR code
 * - Updates the QR code in real-time
 * - Shows connection status
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const logger = pino({ level: 'info' });

// Auth directory - use the same one as bot-handler.js
const AUTH_DIR = './auth_info_qr';
const PORT = 5000; // This is the port that will be accessible in Replit's webview

// Make sure auth directory exists
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Create Express app
const app = express();
app.use(express.static('public'));

// Create public directory if it doesn't exist
if (!fs.existsSync('public')) {
    fs.mkdirSync('public', { recursive: true });
}

// Create HTML file for QR code display
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp QR Code</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
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
            max-width: 600px;
            width: 100%;
        }
        h1 {
            color: #128C7E; /* WhatsApp green */
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
        .timer {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>BLACKSKY-MD WhatsApp QR Code</h1>
        <div class="instructions">
            <h3>Anleitung:</h3>
            <ol>
                <li>Öffne WhatsApp auf deinem Smartphone</li>
                <li>Tippe auf Einstellungen oder Menü und wähle "Verknüpfte Geräte"</li>
                <li>Tippe auf "Gerät verknüpfen"</li>
                <li>Scanne den QR-Code mit deinem Smartphone</li>
            </ol>
        </div>
        <div class="qr-container">
            <img id="qrcode" src="/qrcode.png" alt="QR Code">
            <div class="timer">Der QR-Code aktualisiert sich automatisch alle 20 Sekunden</div>
        </div>
        <div id="status" class="status disconnected">
            Status: Warte auf Scan des QR-Codes...
        </div>
    </div>

    <script>
        // Auto-refresh the QR code image every 5 seconds
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
                    } else if (data.state === 'error') {
                        statusElement.classList.add('error');
                    } else {
                        statusElement.classList.add('disconnected');
                    }
                })
                .catch(err => console.error('Error fetching status:', err));
        }, 5000);
    </script>
</body>
</html>
`;

// Write HTML to public directory
fs.writeFileSync('public/index.html', htmlContent);

// Global variables
let sock = null;
let lastQR = null;
let connectionState = {
    state: 'disconnected',
    message: 'Waiting for QR code scan',
    qrCode: null
};

// API endpoints
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
        // If no QR code is available yet, send a placeholder or error image
        res.status(503).send('QR code not yet available');
    }
});

app.get('/status', (req, res) => {
    res.json(connectionState);
});

async function startWhatsAppConnection() {
    try {
        connectionState.state = 'initializing';
        connectionState.message = 'Initializing connection...';

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        
        // Create WhatsApp socket connection
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: ['BLACKSKY-MD', 'Chrome', '121.0.0'],
            version: [2, 3000, 1019707846], // Use the latest version
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            logger: pino({ level: 'silent' }),
            emitOwnEvents: false,
            defaultQueryTimeoutMs: 60000,
            phoneNumber: process.env.BOT_NUMBER
        });
        
        // Handle connection updates
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                lastQR = qr; // Save QR code for web display
                connectionState.state = 'qr_ready';
                connectionState.message = 'QR Code bereit zum Scannen';
                logger.info('New QR code generated');
            }
            
            if (connection === 'open') {
                connectionState.state = 'connected';
                connectionState.message = 'Verbindung hergestellt! Du kannst diese Seite jetzt schließen.';
                logger.info('✅ CONNECTED SUCCESSFULLY!');
                logger.info('Your BLACKSKY-MD bot is now authenticated.');
                logger.info('Bot is now ready to use!');
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                connectionState.state = 'disconnected';
                connectionState.message = `Verbindung getrennt (${statusCode}). Versuche erneut...`;
                
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                logger.info(`Connection closed with status: ${lastDisconnect?.error?.message}`);
                
                if (shouldReconnect) {
                    logger.info('Reconnecting in 5 seconds...');
                    setTimeout(startWhatsAppConnection, 5000);
                } else {
                    connectionState.state = 'error';
                    connectionState.message = 'Ausgeloggt. Bitte lade die Seite neu.';
                    logger.info('Cannot reconnect - logged out');
                }
            }
        });
        
        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);
        
    } catch (err) {
        logger.error('Error in WhatsApp connection:', err);
        connectionState.state = 'error';
        connectionState.message = 'Verbindungsfehler. Bitte lade die Seite neu.';
        
        // Retry after delay
        setTimeout(startWhatsAppConnection, 10000);
    }
}

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    logger.info(`QR code server started on port ${PORT}`);
    logger.info(`Open the web app to see the QR code`);
    startWhatsAppConnection();
});