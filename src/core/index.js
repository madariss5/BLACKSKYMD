/**
 * BLACKSKY-MD WhatsApp Bot - Core Entry Point
 * Implements a high-performance, robust WhatsApp bot with modular design
 */

const express = require('express');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const ConnectionManager = require('./connection');
const { messageHandler } = require('./messageHandler');
const commandRegistry = require('./commandRegistry');

// Initialize Express for web interface
const app = express();
const PORT = process.env.PORT || 5000;

// Global state and connection manager
let connectionManager = null;

/**
 * Initialize the bot connection and all components
 */
async function initializeBot() {
    logger.info('Starting WhatsApp bot initialization...');
    
    try {
        // Initialize command registry first
        await commandRegistry.initialize();
        logger.info(`Command registry initialized with ${commandRegistry.commandStats.total} commands`);
        
        // Initialize connection manager
        connectionManager = new ConnectionManager();
        const connected = await connectionManager.initialize();
        
        if (connected) {
            // Get the socket from connection manager
            const sock = connectionManager.getSocket();
            
            // Set up message handler for incoming messages
            sock.ev.on('messages.upsert', ({ messages }) => {
                if (!messages || !messages.length) return;
                
                for (const message of messages) {
                    if (message.key && message.key.fromMe === false) {
                        messageHandler(sock, message);
                    }
                }
            });
            
            logger.info('Bot initialization complete!');
            return true;
        } else {
            logger.error('Failed to initialize bot connection');
            return false;
        }
    } catch (err) {
        logger.error('Error during bot initialization:', err);
        return false;
    }
}

/**
 * Set up Express routes for QR code display and status
 */
function setupWebInterface() {
    // Serve static files
    app.use(express.static(path.join(__dirname, '../../public')));
    
    // Main page with QR code
    app.get('/', (req, res) => {
        res.send(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>WhatsApp Bot QR Code</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { 
                            font-family: Arial, sans-serif;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            min-height: 100vh;
                            margin: 0;
                            background: #f0f2f5;
                            padding: 20px;
                        }
                        .container {
                            background: white;
                            padding: 30px;
                            border-radius: 10px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                            max-width: 500px;
                            width: 100%;
                            text-align: center;
                        }
                        h1 { color: #128C7E; }
                        .qr-container {
                            margin: 20px 0;
                            padding: 20px;
                            border: 2px dashed #ddd;
                            display: inline-block;
                            background: white;
                        }
                        #qr-image {
                            max-width: 300px;
                            height: auto;
                        }
                        .status {
                            margin: 20px 0;
                            padding: 10px;
                            border-radius: 5px;
                            font-weight: bold;
                        }
                        .connected { background: #e8f5e9; color: #2e7d32; }
                        .disconnected { background: #fff3e0; color: #ef6c00; }
                        .error { background: #ffebee; color: #c62828; }
                        .loading { 
                            font-size: 1.2em;
                            color: #666;
                            margin: 20px 0;
                            animation: pulse 1.5s infinite;
                        }
                        @keyframes pulse {
                            0% { opacity: 1; }
                            50% { opacity: 0.5; }
                            100% { opacity: 1; }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>WhatsApp Bot QR Code</h1>
                        <div class="qr-container">
                            <div id="loading" class="loading">Initializing connection...</div>
                            <img id="qr-image" style="display: none;" alt="QR Code">
                        </div>
                        <div id="status" class="status disconnected">
                            Waiting for connection...
                        </div>
                        <div id="commands-info">
                            <p>Available commands: <span id="command-count">Loading...</span></p>
                        </div>
                    </div>
                    <script>
                        function updateQR() {
                            fetch('/status')
                                .then(res => res.json())
                                .then(data => {
                                    const status = document.getElementById('status');
                                    const loading = document.getElementById('loading');
                                    const qrImage = document.getElementById('qr-image');
                                    const commandCount = document.getElementById('command-count');
                                    
                                    status.textContent = data.message;
                                    status.className = 'status ' + data.state;
                                    
                                    if (data.state === 'qr_ready' && data.qrCode) {
                                        qrImage.src = data.qrCode;
                                        qrImage.style.display = 'block';
                                        loading.style.display = 'none';
                                    } else {
                                        qrImage.style.display = 'none';
                                        loading.style.display = 'block';
                                        loading.textContent = data.state === 'connected' ? 
                                            'Connected successfully!' : 'Waiting for QR code...';
                                    }
                                    
                                    if (data.commandStats) {
                                        commandCount.textContent = \`\${data.commandStats.enabled} enabled / \${data.commandStats.total} total\`;
                                    }
                                    
                                    setTimeout(updateQR, data.state === 'qr_ready' ? 20000 : 5000);
                                })
                                .catch(err => {
                                    console.error('Error:', err);
                                    setTimeout(updateQR, 5000);
                                });
                        }
                        
                        updateQR();
                    </script>
                </body>
            </html>
        `);
    });
    
    // Status endpoint with QR code
    app.get('/status', async (req, res) => {
        try {
            if (!connectionManager) {
                return res.json({
                    state: 'initializing',
                    message: 'Initializing bot connection...',
                    qrCode: null,
                    commandStats: null
                });
            }
            
            const state = connectionManager.getState();
            let qrImageDataUrl = null;
            
            if (state.connectionState === 'qr_ready' && state.qrCode) {
                qrImageDataUrl = await generateQrDataUrl(state.qrCode);
            }
            
            res.json({
                state: state.connectionState,
                message: getStatusMessage(state),
                qrCode: qrImageDataUrl,
                commandStats: commandRegistry.commandStats
            });
        } catch (err) {
            logger.error('Error in status endpoint:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    
    // Command list endpoint
    app.get('/commands', (req, res) => {
        const categories = commandRegistry.getAllCategories();
        const result = {};
        
        for (const category of categories) {
            const commands = commandRegistry.getCommandsByCategory(category)
                .map(cmdName => {
                    const cmd = commandRegistry.commands.get(cmdName);
                    if (!cmd || !cmd.config.enabled) return null;
                    
                    return {
                        name: cmdName,
                        description: cmd.config.description,
                        usage: cmd.config.usage
                    };
                })
                .filter(Boolean);
                
            if (commands.length > 0) {
                result[category] = commands;
            }
        }
        
        res.json(result);
    });
    
    // Start the server
    app.listen(PORT, '0.0.0.0', () => {
        logger.info(`Web interface running on port ${PORT}`);
    });
}

/**
 * Generate QR code data URL from text
 * @param {string} text - QR code text
 * @returns {Promise<string>} - Data URL
 */
async function generateQrDataUrl(text) {
    try {
        return await qrcode.toDataURL(text, {
            errorCorrectionLevel: 'H',
            margin: 1,
            scale: 8,
            color: {
                dark: '#128C7E',
                light: '#FFFFFF'
            }
        });
    } catch (err) {
        logger.error('Error generating QR code:', err);
        return null;
    }
}

/**
 * Get a user-friendly status message
 * @param {Object} state - Connection state
 * @returns {string} - Status message
 */
function getStatusMessage(state) {
    switch (state.connectionState) {
        case 'connected':
            return 'Connected to WhatsApp! Bot is active.';
        case 'disconnected':
            return `Disconnected. Reason: ${state.lastError || 'Unknown'}. Waiting to reconnect...`;
        case 'connecting':
            return 'Connecting to WhatsApp...';
        case 'qr_ready':
            return 'Please scan the QR code with WhatsApp on your phone';
        case 'error':
            return `Error connecting to WhatsApp: ${state.lastError || 'Unknown error'}. Retrying...`;
        default:
            return 'Initializing...';
    }
}

/**
 * Main entry point
 */
async function main() {
    try {
        // Set up web interface
        setupWebInterface();
        
        // Initialize bot
        await initializeBot();
    } catch (err) {
        logger.error('Critical error in main:', err);
    }
}

// Start the bot
main().catch(err => {
    logger.error('Fatal error:', err);
    process.exit(1);
});

// Export connection manager and main functions for external access
module.exports = {
    connectionManager,
    initializeBot,
    getConnectionManager: () => connectionManager
};