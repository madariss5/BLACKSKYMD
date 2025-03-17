/**
 * Enhanced WhatsApp Connection Handler
 * Features from popular MD bots for better stability
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
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

        // Ensure auth directory exists
        if (!fs.existsSync(this.config.authDir)) {
            fs.mkdirSync(this.config.authDir, { recursive: true });
            logger.info(`Created auth directory: ${this.config.authDir}`);
        }
    }

    async connect() {
        try {
            // Initialize auth state
            const { state, saveCreds } = await useMultiFileAuthState(this.config.authDir);
            logger.debug('Auth state loaded successfully');

            // Enhanced socket settings from popular MD bots
            this.socket = makeWASocket({
                auth: state,
                printQRInTerminal: false, // We'll handle QR display ourselves
                browser: this.config.browser,
                logger: pino({ level: 'silent' }), // Reduce noise in logs
                markOnlineOnConnect: false, // Prevent unnecessary presence updates
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 5000,
                defaultQueryTimeoutMs: 60000,
                qrTimeout: 60000,
                version: [2, 2329, 9],
                getMessage: async (key) => {
                    return {
                        conversation: 'Message not found in store'
                    };
                },
                patchMessageBeforeSending: (message) => {
                    return message;
                }
            });

            logger.debug('Socket created with enhanced settings');

            // Setup event handlers
            this.socket.ev.on('connection.update', async (update) => {
                try {
                    logger.debug('Connection update received:', update);
                    await this.handleConnectionUpdate(update, saveCreds);
                } catch (error) {
                    logger.error('Error in connection update handler:', error);
                }
            });

            this.socket.ev.on('creds.update', async () => {
                try {
                    await saveCreds();
                    logger.debug('Credentials updated and saved');
                } catch (error) {
                    logger.error('Error saving credentials:', error);
                }
            });

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
            return null;
        }
    }

    async handleConnectionUpdate(update, saveCreds) {
        const { connection, lastDisconnect, qr } = update;
        logger.debug('Processing connection update:', { connection, hasQR: !!qr });

        // Enhanced QR code handling
        if (qr) {
            this.qrDisplayCount++;
            if (this.qrDisplayCount <= 5) { // Limit QR code regeneration
                logger.info(`Generating QR code (Attempt ${this.qrDisplayCount}/5)`);
                if (this.config.printQR) {
                    qrcode.generate(qr, { small: true });
                    logger.info('Scan the QR code above to connect');
                }
            } else {
                logger.warn('QR code scanning attempts exceeded. Implementing recovery...');
                await this.implementRecovery();
            }
            return;
        }

        switch (connection) {
            case 'close':
                const shouldReconnect = (lastDisconnect?.error instanceof Boom) && 
                    lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect) {
                    // Exponential backoff for reconnection
                    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 60000);
                    this.retryCount++;

                    if (this.retryCount <= this.maxRetries) {
                        logger.info(`Connection closed. Retrying in ${delay/1000}s (Attempt ${this.retryCount}/${this.maxRetries})`);
                        setTimeout(() => this.connect(), delay);
                    } else {
                        logger.warn('Maximum retry attempts reached. Implementing recovery...');
                        await this.implementRecovery();
                    }
                } else if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
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
                this.qrDisplayCount = 0;
                logger.success('Connected successfully!');
                break;
        }

        // Save credentials on updates
        if (saveCreds) {
            await saveCreds();
        }
    }

    async implementRecovery() {
        try {
            logger.info('Starting connection recovery process...');

            // Backup and clear auth data
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

            // Clean up socket if it exists
            if (this.socket) {
                try {
                    await this.socket.logout();
                    await this.socket.end();
                } catch (error) {
                    logger.warn('Error during socket cleanup:', error.message);
                }
            }

            // Create fresh auth directory
            fs.mkdirSync(this.config.authDir, { recursive: true });
            logger.info('Created fresh auth directory');

            // Attempt fresh connection
            logger.info('Attempting fresh connection after recovery...');
            await this.connect();
        } catch (error) {
            logger.error('Recovery failed:', error);
            throw new Error('Connection recovery failed after multiple attempts');
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
            qrDisplayCount: this.qrDisplayCount,
            maxRetries: this.maxRetries
        };
    }
}

module.exports = ConnectionHandler;