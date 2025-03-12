/**
 * WhatsApp Bot QR Code Server for Replit
 * - Serves a web interface for the QR code
 * - Handles WhatsApp authentication via QR code
 * - Provides status updates via API
 */

const express = require('express');
const http = require('http');
const path = require('path');
const qrcode = require('qrcode');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const pino = require('pino');

// Create Express app
const app = express();
const server = http.createServer(app);
const PORT = 5000; // Use the standard Replit port for webview

// WhatsApp connection state
let whatsAppState = {
    qrCode: null,
    status: 'disconnected', // disconnected, connecting, connected
    lastUpdated: Date.now()
};

// Auth directory
const AUTH_DIRECTORY = path.join(process.cwd(), 'auth_info');

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIRECTORY)) {
    fs.mkdirSync(AUTH_DIRECTORY, { recursive: true });
}

// Serve static files from public directory
app.use(express.static('public'));

// QR code API endpoint
app.get('/qrcode', (req, res) => {
    res.json({
        qrCode: whatsAppState.qrCode,
        status: whatsAppState.status,
        lastUpdated: whatsAppState.lastUpdated
    });
});

// Generate QR code
async function displayQR(qr) {
    try {
        // Generate QR code as data URL
        whatsAppState.qrCode = await qrcode.toDataURL(qr);
        whatsAppState.status = 'connecting';
        whatsAppState.lastUpdated = Date.now();
        console.log(`\nQR Code generated and ready to view!\n`);
    } catch (err) {
        console.error('Failed to generate QR code:', err);
    }
}

// Start WhatsApp connection
async function startWhatsAppConnection() {
    try {
        console.log('Starting WhatsApp connection...');
        
        // Clear any previous state
        whatsAppState.qrCode = null;
        whatsAppState.status = 'disconnected';
        whatsAppState.lastUpdated = Date.now();
        
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIRECTORY);
        
        // Create WhatsApp socket connection with improved settings
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: ['WhatsApp Bot', 'Chrome', '100.0.0'],
            logger: pino({ level: 'warn' }),
            connectTimeoutMs: 60000,
            qrTimeout: 40000, 
            defaultQueryTimeoutMs: 60000,
            retryRequestDelayMs: 250
        });
        
        // Handle connection events
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            console.log('Connection update:', update);
            
            if (qr) {
                // We received a QR code to authenticate
                console.log('QR code received, converting to data URL...');
                await displayQR(qr);
                console.log('QR code ready for display');
            }
            
            if (connection === 'open') {
                // Successfully connected to WhatsApp
                whatsAppState.status = 'connected';
                whatsAppState.qrCode = null;
                whatsAppState.lastUpdated = Date.now();
                
                await saveCreds();
                console.log('\nWhatsApp connection established successfully!\n');
                
                // Forward the sock instance to the main WhatsApp bot
                global.whatsAppSock = sock;
            }
            
            if (connection === 'close') {
                // Connection closed
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                whatsAppState.status = 'disconnected';
                whatsAppState.lastUpdated = Date.now();
                
                console.log(`\nConnection closed: ${lastDisconnect?.error?.message || 'Unknown reason'}\n`);
                console.log('Status code:', statusCode);
                
                if (shouldReconnect) {
                    console.log('Reconnecting to WhatsApp in 5 seconds...');
                    setTimeout(startWhatsAppConnection, 5000);
                } else {
                    console.log('Not reconnecting - user logged out');
                    
                    // Force reconnection anyway for Replit environment
                    console.log('Forcing reconnection attempt in 10 seconds...');
                    setTimeout(() => {
                        console.log('Attempting forced reconnection...');
                        startWhatsAppConnection();
                    }, 10000);
                }
            }
        });
        
        sock.ev.on('creds.update', async (creds) => {
            console.log('Credentials updated, saving...');
            await saveCreds();
        });
        
        return sock;
    } catch (err) {
        console.error('Error starting WhatsApp connection:', err);
        whatsAppState.status = 'disconnected';
        whatsAppState.lastUpdated = Date.now();
        
        // Retry connection after delay
        console.log('Retrying connection in 10 seconds due to error...');
        setTimeout(startWhatsAppConnection, 10000);
        return null;
    }
}

// Start the server and WhatsApp connection
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\nWhatsApp QR Server running at http://localhost:${PORT}`);
    console.log('Access this URL to view the QR code and connect to WhatsApp\n');
    
    // Start WhatsApp connection
    startWhatsAppConnection()
        .then(sock => {
            // Make WhatsApp socket available globally
            global.whatsAppSock = sock;
            console.log('WhatsApp connection initialized');
        })
        .catch(err => {
            console.error('Failed to initialize WhatsApp connection:', err);
        });
});

// Handle SIGTERM
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Handle SIGINT
process.on('SIGINT', () => {
    console.log('SIGINT received, closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = { server };