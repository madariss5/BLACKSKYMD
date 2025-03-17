/**
 * Enhanced WhatsApp Connection Handler
 * Combines best practices from various MD bots
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
    }

    async connect() {
        try {
            // Ensure auth directory exists
            if (!fs.existsSync(this.config.authDir)) {
                fs.mkdirSync(this.config.authDir, { recursive: true });
            }

            // Initialize auth state
            const { state, saveCreds } = await useMultiFileAuthState(this.config.authDir);

            // Create socket with optimized settings
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
            
            // Message handling
            this.socket.ev.on('messages.upsert', async (m) => {
                if (this.messageHandler) {
                    await this.messageHandler.handleMessage(m, this.socket);
                }
            });

            logger.info('Connection handler initialized');
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
                
                if (shouldReconnect && this.retryCount < this.maxRetries) {
                    this.retryCount++;
                    logger.info(`Connection closed. Retrying (${this.retryCount}/${this.maxRetries})...`);
                    setTimeout(() => this.connect(), this.retryDelay);
                } else if (lastDisconnect.error?.output?.statusCode === DisconnectReason.loggedOut) {
                    logger.warn('Session logged out. Please scan QR code to reconnect.');
                    // Clear auth info for fresh login
                    fs.rmSync(this.config.authDir, { recursive: true, force: true });
                    this.connect();
                }
                break;

            case 'connecting':
                logger.info('Connecting to WhatsApp...');
                break;

            case 'open':
                this.isConnected = true;
                this.retryCount = 0;
                logger.success('Connected successfully!');
                break;
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
}

module.exports = ConnectionHandler;
