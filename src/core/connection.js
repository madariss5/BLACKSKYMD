/**
 * Enhanced WhatsApp Connection Handler
 * Features from popular MD bots for better stability
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class ConnectionHandler {
    constructor(config = {}) {
        this.config = {
            authDir: './auth_info_baileys',
            printQR: true,
            browser: ['BLACKSKY-MD', 'Chrome', '1.0.0'],
            ...config
        };

        this.retryCount = 0;
        this.maxRetries = 5;
        this.retryDelay = 3000;
        this.isConnected = false;
        this.socket = null;
        this.messageHandler = null;
        this.connectionAttempts = 0;
        this.lastConnectionTime = 0;
        this.qrDisplayCount = 0;
    }

    async connect() {
        try {
            // Ensure auth directory exists
            if (!fs.existsSync(this.config.authDir)) {
                fs.mkdirSync(this.config.authDir, { recursive: true });
            }

            // Initialize auth state
            const { state, saveCreds } = await useMultiFileAuthState(this.config.authDir);

            // Enhanced socket settings from popular MD bots
            this.socket = makeWASocket({
                auth: state,
                printQRInTerminal: this.config.printQR,
                browser: this.config.browser,
                logger: pino({ level: 'silent' }),
                markOnlineOnConnect: true,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 15000,
                retryRequestDelayMs: 2000,
                defaultQueryTimeoutMs: 60000,
                qrTimeout: 40000,
                version: [2, 2329, 9],
                browser: ['BLACKSKY-MD', 'Chrome', '1.0.0'],
                getMessage: async (key) => {
                    return {
                        conversation: 'Message not found in store'
                    };
                }
            });

            // Setup event handlers
            this.socket.ev.on('connection.update', (update) => {
                this.handleConnectionUpdate(update, saveCreds);
            });

            this.socket.ev.on('creds.update', saveCreds);

            // Enhanced message handling with auto-retry
            this.socket.ev.on('messages.upsert', async (m) => {
                try {
                    if (this.messageHandler) {
                        await this.messageHandler.handleMessage(m, this.socket);
                    }
                } catch (error) {
                    logger.error('Error in message handler:', error);
                    // Auto retry for specific errors
                    if (error.message.includes('Connection closed') || error.message.includes('rate-limits')) {
                        setTimeout(() => this.messageHandler.handleMessage(m, this.socket), 2000);
                    }
                }
            });

            logger.info('Connection handler initialized with enhanced features');
            return this.socket;

        } catch (error) {
            logger.error('Connection error:', error);
            await this.handleConnectionError(error);
        }
    }

    async handleConnectionUpdate(update, saveCreds) {
        const { connection, lastDisconnect, qr } = update;

        switch (connection) {
            case 'close':
                const shouldReconnect = (lastDisconnect?.error instanceof Boom) && 
                    lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect) {
                    // Exponential backoff for reconnection
                    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
                    this.retryCount++;

                    logger.info(`Connection closed. Retrying in ${delay/1000}s (Attempt ${this.retryCount})`);
                    setTimeout(() => this.connect(), delay);
                } else if (lastDisconnect.error?.output?.statusCode === DisconnectReason.loggedOut) {
                    logger.warn('Session logged out. Please scan QR code to reconnect.');
                    // Clear auth info for fresh login
                    fs.rmSync(this.config.authDir, { recursive: true, force: true });
                    this.connect();
                }
                break;

            case 'connecting':
                this.connectionAttempts++;
                logger.info(`Connecting to WhatsApp (Attempt ${this.connectionAttempts})...`);
                break;

            case 'open':
                this.isConnected = true;
                this.retryCount = 0;
                this.connectionAttempts = 0;
                this.lastConnectionTime = Date.now();
                logger.success('Connected successfully!');
                break;
        }

        // Enhanced QR code handling
        if (qr) {
            this.qrDisplayCount++;
            if (this.qrDisplayCount <= 5) { // Limit QR code regeneration
                logger.info(`Please scan QR code (Attempt ${this.qrDisplayCount}/5)`);
            } else {
                logger.warn('QR code scanning attempts exceeded. Restarting connection...');
                this.qrDisplayCount = 0;
                await this.disconnect();
                setTimeout(() => this.connect(), 5000);
            }
        }

        // Save credentials on updates
        if (saveCreds) {
            await saveCreds();
        }
    }

    async handleConnectionError(error) {
        logger.error('Connection error:', error);

        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
            logger.info(`Retrying connection in ${delay/1000} seconds...`);
            setTimeout(() => this.connect(), delay);
        } else {
            logger.error('Max retry attempts reached. Please check your connection and restart.');
            // Implement recovery mechanism
            await this.implementRecovery();
        }
    }

    async implementRecovery() {
        try {
            // Clear problematic session data
            if (fs.existsSync(this.config.authDir)) {
                const backupDir = `${this.config.authDir}_backup_${Date.now()}`;
                fs.renameSync(this.config.authDir, backupDir);
                logger.info(`Backed up auth info to: ${backupDir}`);
            }

            // Reset connection state
            this.retryCount = 0;
            this.connectionAttempts = 0;
            this.qrDisplayCount = 0;
            this.isConnected = false;

            // Attempt fresh connection
            logger.info('Attempting fresh connection after recovery...');
            await this.connect();
        } catch (error) {
            logger.error('Recovery failed:', error);
        }
    }

    setMessageHandler(handler) {
        this.messageHandler = handler;
    }

    async disconnect() {
        if (this.socket) {
            try {
                await this.socket.logout();
                await this.socket.end();
                this.isConnected = false;
                logger.info('Disconnected successfully');
            } catch (error) {
                logger.error('Error during disconnect:', error);
            }
        }
    }

    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            retryCount: this.retryCount,
            connectionAttempts: this.connectionAttempts,
            lastConnectionTime: this.lastConnectionTime,
            qrDisplayCount: this.qrDisplayCount
        };
    }
}

module.exports = ConnectionHandler;