/**
 * Enhanced WhatsApp Connection Manager
 * Handles session replacement errors (440) and provides robust reconnection
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { sessionManager } = require('./utils/sessionManager');
const logger = require('./utils/logger');
const fs = require('fs').promises;
const path = require('path');
const qrcode = require('qrcode');
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

// QR generation state
let qrGenerated = false;
let sock = null;
let wsClients = [];
let server = null;
let app = null;
let wss = null;

/**
 * Handle WhatsApp connection cleanup
 */
async function cleanup() {
    try {
        if (sock && sock.ev) {
            // Gracefully close the connection if possible
            sock.ev.removeAllListeners();
            await sock.logout().catch(() => {});
        }
    } catch (err) {
        logger.error(`Cleanup error: ${err.message}`);
    }
}

/**
 * Display QR code in terminal and send to WebSocket clients
 */
async function displayQR(qr) {
    qrGenerated = true;
    
    try {
        // Generate QR code in terminal (fallback)
        console.log('\n▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄');
        console.log('█ BLACKSKY-MD WHATSAPP QR CODE █');
        console.log('▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀');
        console.log('\n1. Open WhatsApp on your phone');
        console.log('2. Tap Menu (settings) or Settings > Linked Devices');
        console.log('3. Tap on Link a Device');
        console.log('4. Point your phone camera to this QR code');
        
        // Convert QR to data URL for web display
        const qrImage = await qrcode.toDataURL(qr);
        
        // Send QR code to all WebSocket clients
        wsClients.forEach(client => {
            if (client.readyState === 1) { // OPEN
                client.send(JSON.stringify({
                    type: 'qr',
                    qr: qrImage
                }));
            }
        });
        
        // Log QR URL for easier access
        logger.info(`🔄 New QR code generated. Scan it with WhatsApp on your phone.`);
    } catch (err) {
        logger.error(`Error displaying QR: ${err.message}`);
    }
}

/**
 * Start WhatsApp connection
 */
async function startConnection() {
    try {
        // Clean up existing session if needed
        await cleanup();
        
        // Create fresh auth state folder if getting repeated disconnects
        const authDir = sessionManager.authDir;
        logger.info(`Using auth directory: ${authDir}`);
        
        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        
        // Get connection config from session manager
        const connectionConfig = sessionManager.getConnectionConfig();
        
        // Connect to WhatsApp
        sock = makeWASocket({
            ...connectionConfig,
            auth: state
        });
        
        // Setup save credentials listener
        sock.ev.on('creds.update', async (creds) => {
            await saveCreds();
            
            // Also save to our session manager for extra redundancy
            await sessionManager.saveSession('default', creds);
        });
        
        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // Handle QR code
            if (qr) {
                await displayQR(qr);
            }
            
            // Handle connection status changes
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const reason = lastDisconnect?.error?.output?.payload?.error;
                
                logger.info(`Connection closed with status code: ${statusCode}`);
                
                if (statusCode === 440) {
                    logger.warn(`Session replacement detected (${statusCode})`);
                    
                    // Let session manager handle this error type with a fresh directory
                    const shouldRetry = await sessionManager.handleConnectionError(lastDisconnect?.error, statusCode);
                    
                    if (shouldRetry) {
                        logger.info('Attempting to reconnect...');
                        setTimeout(startConnection, 3000);
                    } else {
                        logger.error('Connection failed, giving up after multiple retries');
                    }
                } else if (statusCode === 401) {
                    logger.warn('Unauthorized session, need to generate new QR code');
                    // For auth errors, create a fresh session
                    await sessionManager.clearSession();
                    setTimeout(startConnection, 3000);
                } else if (statusCode === 428) {
                    logger.warn('Connection closed, connection lost');
                    setTimeout(startConnection, 5000);
                } else {
                    // Generic reconnect logic with retry count handled by session manager
                    const shouldRetry = await sessionManager.handleConnectionError(lastDisconnect?.error, statusCode);
                    
                    if (shouldRetry) {
                        logger.info('Attempting to reconnect...');
                        setTimeout(startConnection, 3000);
                    }
                }
            } else if (connection === 'open') {
                logger.info('Auth state backed up successfully');
                sessionManager.resetRetryCount();
                logger.info('Connection statistics reset after successful connection');
                
                // Broadcast successful connection to WebSocket clients
                wsClients.forEach(client => {
                    if (client.readyState === 1) { // OPEN
                        client.send(JSON.stringify({
                            type: 'connected',
                            message: 'WhatsApp connection successful!'
                        }));
                    }
                });
                
                logger.info('Connection established successfully!');
                
                // Send a message to all WebSocket clients
                wsClients.forEach(client => {
                    if (client.readyState === 1) { // OPEN
                        client.send(JSON.stringify({
                            type: 'status',
                            connected: true,
                            message: 'Connection established successfully!'
                        }));
                    }
                });
            }
        });
        
        // Return the socket for use by bot modules
        return sock;
    } catch (err) {
        logger.error(`Connection error: ${err.message}`);
        
        // Clean up on failed connection
        await cleanup();
        
        // Try again with delay
        setTimeout(startConnection, 5000);
        
        // Return null to indicate failure
        return null;
    }
}

/**
 * Initialize Express server and WebSocket for QR code display
 */
async function initServer(port = 5000) {
    // Create Express app if it doesn't exist
    if (!app) {
        app = express();
        app.use(express.static(path.join(__dirname, '..', 'public')));
        
        // Main route for QR code display
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '..', 'public', 'qr.html'));
        });
        
        // Status route for monitoring
        app.get('/status', (req, res) => {
            res.json({
                status: sock ? 'connected' : 'disconnected',
                qrGenerated: qrGenerated
            });
        });
    }
    
    // Create server if it doesn't exist
    if (!server) {
        server = http.createServer(app);
    }
    
    // Create WebSocket server if it doesn't exist
    if (!wss) {
        wss = new WebSocketServer({ server });
        
        wss.on('connection', (ws) => {
            wsClients.push(ws);
            
            // Send current status
            ws.send(JSON.stringify({
                type: 'status',
                connected: sock ? true : false,
                message: sock ? 'WhatsApp is connected' : 'Waiting for connection'
            }));
            
            // Handle client disconnect
            ws.on('close', () => {
                wsClients = wsClients.filter(client => client !== ws);
            });
        });
    }
    
    // Start server
    if (!server.listening) {
        server.listen(port, () => {
            logger.info(`\n✅ QR Web Server running at http://localhost:${port}`);
            logger.info(`✅ Use this URL to access the WhatsApp QR code scanning interface`);
        });
    }
}

// Export the connection module
module.exports = {
    startConnection,
    cleanup,
    initServer
};