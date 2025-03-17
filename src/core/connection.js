/**
 * Enhanced WhatsApp Connection Manager
 * Provides robust connection handling with auto-recovery and session persistence
 */

const { 
    default: makeWASocket, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    isJidBroadcast
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

// Import utilities
const logger = require('../utils/logger');
const { ensureDirectoryExists } = require('../utils/fileUtils');
const SessionManager = require('./sessionManager');

// Constants
const CONNECTION_TIMEOUT_MS = 60000;
const RECONNECT_INTERVAL = 3000;
const SESSION_DIR = './auth_info_baileys';
const BACKUP_DIR = './auth_info_baileys_backup';
const MAX_QR_ATTEMPTS = 5;
const MAX_RETRIES = 10;

class ConnectionManager {
    constructor(options = {}) {
        this.sock = null;
        this.qrCode = null;
        this.connectionState = 'disconnected';
        this.qrAttempts = 0;
        this.retryCount = 0;
        this.isReconnecting = false;
        this.lastDisconnectReason = null;
        this.sessionManager = new SessionManager();
        this.connectionOptions = {
            printQRInTerminal: true,
            browser: ['BLACKSKY-Bot', 'Chrome', '110.0.0'], // Updated Chrome version
            syncFullHistory: false,
            connectTimeoutMs: CONNECTION_TIMEOUT_MS,
            auth: null,
            logger: pino({ level: 'silent' }),
            markOnlineOnConnect: true,
            keepAliveIntervalMs: 15000,
            defaultQueryTimeoutMs: 30000,
            ...options
        };
        
        // Ensure session directories exist
        ensureDirectoryExists(SESSION_DIR);
        ensureDirectoryExists(BACKUP_DIR);
    }

    /**
     * Initialize connection and listeners
     */
    async initialize() {
        logger.info('Starting connection initialization...');
        
        try {
            // Get the latest version of Baileys
            const { version } = await fetchLatestBaileysVersion();
            logger.info(`Using Baileys version: ${version.join('.')}`);
            
            // Set up auth state
            const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
            
            // Advanced key store with caching for better performance
            const keyStore = makeCacheableSignalKeyStore(state.keys, logger);
            
            // Creating socket with optimized configuration
            this.sock = makeWASocket({
                ...this.connectionOptions,
                auth: {
                    creds: state.creds,
                    keys: keyStore
                },
                version,
                getMessage: async key => {
                    return { conversation: 'Message not loaded' };
                }
            });
            
            // Set up connection listener with robust error handling
            this.sock.ev.on('connection.update', async (update) => {
                await this.handleConnectionUpdate(update, saveCreds);
            });
            
            // Set up credentials update handler
            this.sock.ev.on('creds.update', async () => {
                await saveCreds();
                await this.sessionManager.backupCredentials();
            });
            
            // Set up messages.upsert handler in the main index.js file
            
            return true;
        } catch (err) {
            logger.error('Failed to initialize connection:', err);
            if (err.code === 'ERR_INVALID_ARG_TYPE') {
                logger.warn('Credential format issue detected - attempting recovery');
                await this.resetCredentials();
            }
            return false;
        }
    }
    
    /**
     * Handle connection updates
     */
    async handleConnectionUpdate(update, saveCreds) {
        const { connection, lastDisconnect, qr } = update;
        logger.debug('Connection update:', update);
        
        if (qr) {
            this.qrCode = qr;
            this.connectionState = 'qr_ready';
            this.qrAttempts++;
            logger.info(`New QR code received (Attempt ${this.qrAttempts}/${MAX_QR_ATTEMPTS})`);
            
            if (this.qrAttempts >= MAX_QR_ATTEMPTS) {
                logger.warn('Maximum QR attempts reached, resetting credentials');
                await this.resetCredentials();
                this.qrAttempts = 0;
            }
        }
        
        if (connection === 'open') {
            this.connectionState = 'connected';
            this.qrCode = null;
            this.qrAttempts = 0;
            this.retryCount = 0;
            this.isReconnecting = false;
            logger.info('Connection established successfully!');
            
            // Backup credentials after successful connection
            await this.sessionManager.backupCredentials();
        }
        
        if (connection === 'close') {
            this.connectionState = 'disconnected';
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const reason = lastDisconnect?.error?.output?.payload?.error;
            this.lastDisconnectReason = reason || 'unknown';
            
            logger.info(`Connection closed. Status code: ${statusCode}, Reason: ${this.lastDisconnectReason}`);
            
            // Implement different handling based on disconnect reason
            const shouldReconnect = this.shouldAttemptReconnect(statusCode);
            
            if (shouldReconnect) {
                this.retryCount++;
                const delay = Math.min(RECONNECT_INTERVAL * Math.pow(1.5, this.retryCount - 1), 30000);
                
                if (this.retryCount > MAX_RETRIES) {
                    logger.warn(`Too many retries (${this.retryCount}), resetting credentials`);
                    await this.resetCredentials();
                    this.retryCount = 0;
                } else {
                    logger.info(`Reconnecting in ${delay/1000}s (Attempt ${this.retryCount}/${MAX_RETRIES})...`);
                    setTimeout(() => this.reconnect(), delay);
                }
            } else {
                logger.warn(`Cannot reconnect due to ${this.lastDisconnectReason}. Manual restart required.`);
                // Optional: For complete automation, could implement a reset after a timeout
                setTimeout(() => this.resetAndReconnect(), 60000);
            }
        }
    }
    
    /**
     * Determine if we should reconnect based on disconnect code
     */
    shouldAttemptReconnect(statusCode) {
        // Always reconnect except for specific error codes
        return statusCode !== DisconnectReason.loggedOut && 
               statusCode !== 428 && // Bad auth
               statusCode !== 440; // Forbidden, typically from banned account
    }
    
    /**
     * Reconnect to WhatsApp
     */
    async reconnect() {
        if (this.isReconnecting) {
            logger.debug('Already attempting to reconnect...');
            return;
        }
        
        try {
            this.isReconnecting = true;
            this.connectionState = 'connecting';
            logger.info('Attempting to reconnect...');
            
            await this.initialize();
        } catch (err) {
            logger.error('Reconnection error:', err);
            this.isReconnecting = false;
            this.connectionState = 'error';
            
            // Schedule another retry
            const delay = Math.min(RECONNECT_INTERVAL * Math.pow(1.5, this.retryCount), 60000);
            setTimeout(() => this.reconnect(), delay);
        }
    }
    
    /**
     * Reset credentials and reconnect
     */
    async resetCredentials() {
        try {
            logger.info('Resetting credentials...');
            
            // Backup existing credentials first
            await this.sessionManager.backupCredentials();
            
            // Delete auth files
            if (fs.existsSync(SESSION_DIR)) {
                fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            }
            
            // Recreate directory
            ensureDirectoryExists(SESSION_DIR);
            
            logger.info('Credentials reset completed. Reconnecting...');
            this.qrAttempts = 0;
            this.retryCount = 0;
            setTimeout(() => this.reconnect(), 1000);
        } catch (err) {
            logger.error('Error resetting credentials:', err);
        }
    }
    
    /**
     * Reset everything and reconnect
     */
    async resetAndReconnect() {
        await this.resetCredentials();
        this.reconnect();
    }
    
    /**
     * Get the current connection state
     */
    getState() {
        return {
            connectionState: this.connectionState,
            qrCode: this.qrCode,
            lastError: this.lastDisconnectReason
        };
    }
    
    /**
     * Get the socket instance
     */
    getSocket() {
        return this.sock;
    }
}

module.exports = ConnectionManager;