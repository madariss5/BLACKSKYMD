/**
 * WhatsApp Connection Manager
 * Provides robust connection handling with automatic reconnection
 */

const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class ConnectionManager {
    constructor(options = {}) {
        this.options = {
            authDir: options.authDir || './auth_info_baileys',
            printQRInTerminal: options.printQRInTerminal !== false,
            maxReconnectAttempts: options.maxReconnectAttempts || 10,
            reconnectDelay: options.reconnectDelay || 3000,
            onQRUpdate: options.onQRUpdate || null,
            onConnectionUpdate: options.onConnectionUpdate || null,
            onCredentialsUpdate: options.onCredentialsUpdate || null,
        };
        this.sock = null;
        this.authState = null;
        this.saveCreds = null;
        this.isConnected = false;
        this.connectionAttempts = 0;
        this.hasQRBeenScanned = false;
        this.lastError = null;
        this.connectionEventListeners = new Set();
    }

    /**
     * Initialize the connection manager
     * @returns {Promise<boolean>} Whether initialization was successful
     */
    async initialize() {
        try {
            logger.info('Initializing WhatsApp connection manager...');
            
            // Ensure auth directory exists
            if (!fs.existsSync(this.options.authDir)) {
                fs.mkdirSync(this.options.authDir, { recursive: true });
                logger.info(`Created auth directory: ${this.options.authDir}`);
            }
            
            // Initialize auth state
            const { state, saveCreds } = await useMultiFileAuthState(this.options.authDir);
            this.authState = state;
            this.saveCreds = saveCreds;
            
            logger.info('Connection manager initialized successfully');
            return true;
        } catch (error) {
            logger.error('Failed to initialize connection manager:', error);
            return false;
        }
    }

    /**
     * Connect to WhatsApp
     * @returns {Promise<Object>} The WhatsApp socket connection
     */
    async connect() {
        try {
            logger.info('Connecting to WhatsApp...');
            
            if (!this.authState) {
                await this.initialize();
            }
            
            // Create socket
            this.sock = makeWASocket({
                auth: this.authState,
                printQRInTerminal: this.options.printQRInTerminal,
                logger: P({ level: 'silent' }),
            });
            
            // Set up event handlers
            this.setupConnectionEvents();
            this.setupCredentialsEvents();
            
            return this.sock;
        } catch (error) {
            logger.error('Error connecting to WhatsApp:', error);
            throw error;
        }
    }

    /**
     * Set up connection event handlers
     */
    setupConnectionEvents() {
        if (!this.sock) return;
        
        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // Handle QR code
            if (qr && this.options.onQRUpdate) {
                this.options.onQRUpdate(qr);
            }
            
            // Handle connection state changes
            if (connection === 'close') {
                this.isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                logger.info(`Connection closed. Status code: ${statusCode}, Reason: ${lastDisconnect?.error?.message || 'Unknown'}`);
                
                if (shouldReconnect && this.connectionAttempts < this.options.maxReconnectAttempts) {
                    this.connectionAttempts++;
                    const delay = this.options.reconnectDelay;
                    logger.info(`Reconnecting in ${delay/1000}s (Attempt ${this.connectionAttempts}/${this.options.maxReconnectAttempts})...`);
                    
                    setTimeout(() => this.reconnect(), delay);
                } else if (!shouldReconnect) {
                    logger.info('Connection closed permanently. User logged out.');
                    this.notifyConnectionEvent('logout');
                } else {
                    logger.error('Maximum reconnection attempts reached. Giving up.');
                    this.notifyConnectionEvent('max_retries_reached');
                }
            } else if (connection === 'open') {
                this.isConnected = true;
                this.connectionAttempts = 0;
                this.hasQRBeenScanned = true;
                logger.info('Connection established successfully');
                this.notifyConnectionEvent('connected');
            }
            
            // Notify connection update listener if provided
            if (this.options.onConnectionUpdate) {
                this.options.onConnectionUpdate(update);
            }
        });
    }

    /**
     * Set up credentials event handlers
     */
    setupCredentialsEvents() {
        if (!this.sock || !this.saveCreds) return;
        
        this.sock.ev.on('creds.update', async (creds) => {
            await this.saveCreds();
            
            // Notify credentials update listener if provided
            if (this.options.onCredentialsUpdate) {
                this.options.onCredentialsUpdate(creds);
            }
        });
    }

    /**
     * Reconnect to WhatsApp
     * @returns {Promise<Object>} The WhatsApp socket connection
     */
    async reconnect() {
        try {
            logger.info('Attempting to reconnect...');
            
            // Clean up old connection if it exists
            if (this.sock) {
                this.sock.ev.removeAllListeners();
            }
            
            // Connect again
            return await this.connect();
        } catch (error) {
            logger.error('Error during reconnection:', error);
            this.lastError = error;
            this.notifyConnectionEvent('reconnect_error');
            
            // If we haven't reached max attempts, try again
            if (this.connectionAttempts < this.options.maxReconnectAttempts) {
                const delay = this.options.reconnectDelay;
                logger.info(`Retrying in ${delay/1000}s...`);
                setTimeout(() => this.reconnect(), delay);
            } else {
                logger.error('Maximum reconnection attempts reached. Giving up.');
                this.notifyConnectionEvent('max_retries_reached');
            }
            
            return null;
        }
    }

    /**
     * Register a listener for connection events
     * @param {Function} listener The listener function
     */
    onConnectionEvent(listener) {
        this.connectionEventListeners.add(listener);
    }

    /**
     * Remove a connection event listener
     * @param {Function} listener The listener function to remove
     */
    removeConnectionEventListener(listener) {
        this.connectionEventListeners.delete(listener);
    }

    /**
     * Notify all connection event listeners
     * @param {string} event The event name
     * @param {Object} data Additional event data
     */
    notifyConnectionEvent(event, data = {}) {
        for (const listener of this.connectionEventListeners) {
            try {
                listener(event, { ...data, timestamp: Date.now() });
            } catch (error) {
                logger.error('Error in connection event listener:', error);
            }
        }
    }

    /**
     * Get the current connection status
     * @returns {Object} Connection status object
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            connectionAttempts: this.connectionAttempts,
            hasQRBeenScanned: this.hasQRBeenScanned,
            lastError: this.lastError ? {
                message: this.lastError.message,
                stack: this.lastError.stack,
            } : null,
        };
    }

    /**
     * Disconnect from WhatsApp
     */
    async disconnect() {
        if (!this.sock) return;
        
        try {
            logger.info('Disconnecting from WhatsApp...');
            await this.sock.logout();
            this.sock.ev.removeAllListeners();
            this.sock = null;
            this.isConnected = false;
            logger.info('Disconnected successfully');
        } catch (error) {
            logger.error('Error disconnecting from WhatsApp:', error);
        }
    }
}

module.exports = ConnectionManager;