const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const logger = require('../utils/logger');
const backupManager = require('../utils/backupManager');

class ConnectionHandler {
    constructor(config = {}) {
        this.config = {
            authDir: './auth_info_baileys',
            printQR: true,
            browser: ['BLACKSKY-MD', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 15000,
            retryRequestDelayMs: 5000,
            maxQRAttempts: 5,
            maxRetries: 10, // Increased from 5 to 10
            healthCheckInterval: 30000,
            circuitBreakerThreshold: 5, // Increased from 3 to 5
            circuitBreakerTimeout: 180000, // Reduced from 5min to 3min
            backupInterval: 15 * 60 * 1000, // 15 minutes
            ...config
        };

        this.retryCount = 0;
        this.maxRetries = this.config.maxRetries;
        this.retryDelay = 3000;
        this.isConnected = false;
        this.socket = null;
        this.messageHandler = null;
        this.connectionAttempts = 0;
        this.lastConnectionTime = 0;
        this.qrDisplayCount = 0;
        this.activeConnections = new Map();
        this.connectionHistory = [];
        this.healthCheckInterval = null;
        this.connectionState = 'disconnected';
        this.lastPingTime = 0;
        this.pingInterval = null;
        this.lastStateCheck = Date.now();
        this.errorCount = 0;
        this.circuitBreakerOpen = false;
        this.lastCircuitBreakerReset = Date.now();
        this.backupInterval = null;

        // Ensure auth directory exists
        if (!fs.existsSync(this.config.authDir)) {
            fs.mkdirSync(this.config.authDir, { recursive: true });
            logger.info(`Created auth directory: ${this.config.authDir}`);
        }

        // Setup backup directories (redundancy)
        for (const dir of [
            './backups', 
            './auth_info_baileys_backup',
            './data/session_backups'
        ]) {
            try {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                    logger.info(`Created backup directory: ${dir}`);
                }
            } catch (err) {
                logger.warn(`Failed to create backup directory ${dir}:`, err.message);
            }
        }

        // Start health monitoring
        this.startHealthCheck();
        
        // Start credential auto-backup
        this.setupCredentialBackup();
    }
    
    // Set up automatic credential backups
    setupCredentialBackup() {
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
        }
        
        this.backupInterval = setInterval(() => {
            try {
                if (this.isConnected && this.socket?.authState?.creds) {
                    backupManager.createBackup(this.socket.authState.creds)
                        .then(success => {
                            if (success) {
                                logger.debug('Scheduled credential backup completed successfully');
                            }
                        })
                        .catch(error => {
                            logger.warn('Scheduled credential backup failed:', error.message);
                        });
                }
            } catch (error) {
                logger.warn('Error in credential backup interval:', error.message);
            }
        }, this.config.backupInterval);
        
        logger.info(`Scheduled automatic backups every ${this.config.backupInterval / (60 * 1000)} minutes`);
    }

    // Add new method to reset QR count
    resetQRCount() {
        this.qrDisplayCount = 0;
        logger.info('Reset QR code counter');
    }

    async connect() {
        try {
            if (this.circuitBreakerOpen) {
                const timeInBreaker = Date.now() - this.lastCircuitBreakerReset;
                if (timeInBreaker < this.config.circuitBreakerTimeout) {
                    logger.warn(`Circuit breaker open, waiting ${Math.ceil((this.config.circuitBreakerTimeout - timeInBreaker) / 1000)}s`);
                    return null;
                }
                this.resetCircuitBreaker();
            }

            if (this.connectionState === 'connecting') {
                logger.warn('Connection attempt already in progress');
                return null;
            }

            this.connectionState = 'connecting';
            logger.info('Initializing WhatsApp connection...');
            
            // Try to restore from backupManager first
            let restoredCreds = null;
            try {
                restoredCreds = await backupManager.restoreBackup();
                if (restoredCreds) {
                    logger.info('Restored credentials from backup system');
                }
            } catch (backupError) {
                logger.warn('Failed to restore from backup manager:', backupError.message);
            }

            // Initialize auth state
            const { state, saveCreds } = await useMultiFileAuthState(this.config.authDir);
            logger.debug('Auth state loaded successfully');
            
            // Set up credential backup on save
            const enhancedSaveCreds = async () => {
                await saveCreds();
                if (state.creds && Object.keys(state.creds).length > 0) {
                    try {
                        await backupManager.createBackup(state.creds);
                    } catch (backupError) {
                        logger.warn('Failed to backup credentials:', backupError.message);
                    }
                }
            };
            
            // If we have restored credentials, merge them with state
            if (restoredCreds && Object.keys(restoredCreds).length > 0) {
                state.creds = {
                    ...state.creds,
                    ...restoredCreds
                };
                await enhancedSaveCreds(); // Save the merged credentials
            }
            
            // Fetch latest baileys version
            const { version } = await fetchLatestBaileysVersion();
            logger.info(`Using WA Web version: ${version.join('.')}`);
            
            // Use cacheable signal key store for better performance
            const socketConfig = {
                auth: {
                    creds: state.creds,
                    // creds are updated whenever a new session is created
                    keys: makeCacheableSignalKeyStore(state.keys, logger),
                },
                printQRInTerminal: true, // Always enable QR printing
                browser: this.config.browser,
                logger: pino({ level: 'warn' }), // Reduce noise but keep warnings
                markOnlineOnConnect: true, // Keep connection alive
                connectTimeoutMs: this.config.connectTimeoutMs,
                keepAliveIntervalMs: 10000, // Increased keep-alive frequency
                retryRequestDelayMs: 2000, // Faster retry
                defaultQueryTimeoutMs: 60000,
                qrTimeout: 60000,
                version: version,
                getMessage: async (key) => {
                    return { conversation: 'Message not found in store' };
                },
                patchMessageBeforeSending: (message) => {
                    return this.enhanceMessage(message);
                },
                shouldIgnoreJid: (jid) => {
                    return this.shouldIgnoreJid(jid);
                },
                linkPreviewImageThumbnailWidth: 300, // Better preview thumbnails
                generateHighQualityLinkPreview: true,
                syncFullHistory: false, // Don't sync full history to save bandwidth
                fireInitQueries: true, // Fire init queries for faster startup
                userDevicesCache: {}, // Pre-allocate device cache
                transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
                options: {
                    autoReconnect: true // Native auto-reconnect
                }
            };
            
            // Create socket with enhanced configuration
            this.socket = makeWASocket(socketConfig);

            logger.debug('Socket created with enhanced settings');

            // Setup event handlers with enhanced monitoring
            this.socket.ev.on('connection.update', async (update) => {
                try {
                    logger.debug('Connection update received:', update);
                    await this.handleConnectionUpdate(update, enhancedSaveCreds);
                } catch (error) {
                    logger.error('Error in connection update handler:', error);
                    await this.handleConnectionError(error);
                }
            });

            this.socket.ev.on('creds.update', async () => {
                try {
                    await enhancedSaveCreds();
                    logger.debug('Credentials updated and saved with backup');
                } catch (error) {
                    logger.error('Error saving credentials:', error);
                    // If enhanced save fails, try the original as fallback
                    try {
                        await saveCreds();
                        logger.info('Fallback credential save successful');
                    } catch (fallbackError) {
                        logger.error('Both primary and fallback credential saves failed:', fallbackError);
                    }
                }
            });

            // Monitor WebSocket events with enhanced error tracking
            if (this.socket.ws) {
                this.socket.ws.on('close', (code, reason) => {
                    logger.warn('WebSocket closed:', { code, reason });
                    this.handleSocketClose(code);
                });

                this.socket.ws.on('error', (error) => {
                    logger.error('WebSocket error:', error);
                    this.handleSocketError(error);
                });

                this.socket.ws.on('ping', () => {
                    this.lastPingTime = Date.now();
                });
            }

            // Start connection monitoring
            this.startPingMonitoring();
            this.startSocketStateMonitoring();

            return this.socket;

        } catch (error) {
            logger.error('Connection error:', error);
            this.connectionState = 'disconnected';
            await this.handleConnectionError(error);
            return null;
        }
    }

    resetCircuitBreaker() {
        this.circuitBreakerOpen = false;
        this.errorCount = 0;
        this.lastCircuitBreakerReset = Date.now();
        logger.info('Circuit breaker reset');
    }

    async handleConnectionError(error) {
        try {
            logger.error('Connection error:', {
                message: error.message,
                stack: error.stack,
                state: this.connectionState,
                attempts: this.connectionAttempts
            });

            this.errorCount++;
            if (this.errorCount >= this.config.circuitBreakerThreshold) {
                this.circuitBreakerOpen = true;
                this.lastCircuitBreakerReset = Date.now();
                logger.warn('Circuit breaker opened due to excessive errors');
                return;
            }

            this.connectionState = 'disconnected';
            await this.implementRecovery();

        } catch (sendError) {
            logger.error('Error in error handler:', sendError);
        }
    }

    async handleConnectionUpdate(update, saveCreds) {
        const { connection, lastDisconnect, qr } = update;
        logger.debug('Processing connection update:', { connection, hasQR: !!qr });

        if (qr) {
            this.qrDisplayCount++;
            if (this.qrDisplayCount <= this.config.maxQRAttempts) {
                logger.info(`Generating QR code (Attempt ${this.qrDisplayCount}/${this.config.maxQRAttempts})`);
                if (this.config.printQR) {
                    qrcode.generate(qr, { small: true });
                    logger.info(`Scan the QR code above to connect (Attempt ${this.qrDisplayCount})`);
                    logger.info('The QR code will expire in 60 seconds');
                }
            } else {
                logger.warn('QR code scanning attempts exceeded. Implementing recovery...');
                await this.implementRecovery();
            }
            return;
        }

        switch (connection) {
            case 'close':
                await this.handleConnectionClose(lastDisconnect);
                break;

            case 'connecting':
                this.connectionState = 'connecting';
                this.connectionAttempts++;
                logger.info(`Connecting to WhatsApp (Attempt ${this.connectionAttempts})`);
                break;

            case 'open':
                await this.handleConnectionOpen();
                break;
        }

        // Save credentials on updates
        if (saveCreds) {
            await saveCreds();
        }
    }

    async handleConnectionClose(lastDisconnect) {
        // Extract detailed error information
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
        const errorName = lastDisconnect?.error?.name || 'Error';
        
        logger.info(`Connection closed with status: ${statusCode}, error: ${errorName} - ${errorMessage}`);
        
        // Handle different types of disconnections differently
        if (statusCode === DisconnectReason.loggedOut) {
            logger.warn('Session logged out. Please scan QR code to reconnect.');
            await this.handleLogout();
            return; // No need to proceed further
        }
        
        // Check if we should attempt reconnection
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        const maxRetriesExceeded = this.retryCount >= this.maxRetries;
        
        // Determine if this is a temporary issue that can be resolved with simple retry
        const isTemporaryIssue = [
            DisconnectReason.connectionClosed,
            DisconnectReason.connectionLost,
            DisconnectReason.connectionReplaced,
            DisconnectReason.timedOut,
            DisconnectReason.restartRequired
        ].includes(statusCode);
        
        if (shouldReconnect) {
            if (maxRetriesExceeded) {
                logger.warn(`Maximum retries (${this.maxRetries}) exceeded, implementing recovery...`);
                await this.implementRecovery();
                return;
            }
            
            // If temporary issue, use exponential backoff for reconnect
            if (isTemporaryIssue) {
                this.retryCount++;
                // Exponential backoff with jitter to prevent thundering herd
                const baseDelay = Math.min(1000 * Math.pow(1.5, this.retryCount - 1), 30000);
                const jitter = Math.floor(Math.random() * 2000); // Add up to 2 seconds of jitter
                const delay = baseDelay + jitter;
                
                logger.info(`Connection closed (temporary issue). Attempting reconnect ${this.retryCount}/${this.maxRetries} in ${(delay/1000).toFixed(1)}s`);
                
                // Schedule reconnection attempt
                setTimeout(() => {
                    if (!this.isConnected) {
                        this.connect().catch(error => {
                            logger.error('Error during scheduled reconnect:', error.message);
                        });
                    }
                }, delay);
            } else {
                // For more serious issues, implement recovery immediately
                logger.warn('Connection closed with non-temporary issue, implementing recovery...');
                await this.implementRecovery();
                return;
            }
        } else {
            logger.warn('Connection closed with permanent reason, implementing recovery...');
            await this.implementRecovery();
        }

        this.connectionState = 'disconnected';
        this.isConnected = false;
    }

    async handleConnectionOpen() {
        this.isConnected = true;
        this.connectionState = 'connected';
        this.retryCount = 0;
        this.connectionAttempts = 0;
        this.lastConnectionTime = Date.now();
        this.qrDisplayCount = 0;
        this.activeConnections.set(Date.now(), this.socket);
        this.resetCircuitBreaker();
        logger.success('Connected successfully!');
    }

    async handleSocketClose(code) {
        logger.warn(`WebSocket closed with code ${code}`);
        if (this.connectionState === 'connected') {
            logger.warn('Unexpected socket closure, attempting recovery...');
            await this.implementRecovery();
        }
    }

    async handleSocketError(error) {
        logger.error('Socket error:', error);
        if (this.isConnected) {
            await this.implementRecovery();
        }
    }

    async handleLogout() {
        logger.info("Handling logout");
        await this.implementRecovery();
    }

    async implementRecovery() {
        try {
            logger.info('Starting connection recovery process...');

            // Try to backup credentials with backupManager first
            let credentialsBacked = false;
            try {
                if (this.socket?.authState?.creds) {
                    await backupManager.createBackup(this.socket.authState.creds);
                    credentialsBacked = true;
                    logger.info('Successfully backed up credentials before recovery');
                }
            } catch (backupError) {
                logger.warn('Failed to backup credentials:', backupError.message);
            }

            // Backup auth directory
            let authDirBackupPath = null;
            if (fs.existsSync(this.config.authDir)) {
                try {
                    const backupDir = `${this.config.authDir}_backup_${Date.now()}`;
                    fs.renameSync(this.config.authDir, backupDir);
                    authDirBackupPath = backupDir;
                    logger.info(`Backed up auth info to: ${backupDir}`);
                } catch (fsError) {
                    logger.error('Error backing up auth directory:', fsError);
                }
            }

            // Reset connection state
            this.retryCount = 0;
            this.connectionAttempts = 0;
            this.qrDisplayCount = 0;
            this.isConnected = false;
            this.connectionState = 'recovery';

            // Clean up socket with error handling
            if (this.socket) {
                try {
                    // Try gentle logout
                    await Promise.race([
                        this.socket.logout().catch(e => logger.warn('Logout failed:', e.message)),
                        new Promise(resolve => setTimeout(resolve, 3000)) // 3s timeout
                    ]);
                    
                    // Try gentle disconnect
                    await Promise.race([
                        this.socket.end(false).catch(e => logger.warn('End failed:', e.message)),
                        new Promise(resolve => setTimeout(resolve, 3000)) // 3s timeout
                    ]);
                } catch (error) {
                    logger.warn('Error during socket cleanup:', error.message);
                }
                
                // Clear references
                this.socket = null;
            }

            // Clear active connections
            this.activeConnections.clear();

            // Create fresh auth directory
            try {
                fs.mkdirSync(this.config.authDir, { recursive: true });
                logger.info('Created fresh auth directory');
            } catch (mkdirError) {
                logger.error('Error creating auth directory:', mkdirError);
                // Try to restore the backup if creating new dir failed
                if (authDirBackupPath && fs.existsSync(authDirBackupPath)) {
                    try {
                        fs.renameSync(authDirBackupPath, this.config.authDir);
                        logger.info('Restored auth directory from backup after mkdir failure');
                    } catch (restoreError) {
                        logger.error('Failed to restore auth directory:', restoreError);
                    }
                }
            }

            // Pause before attempting reconnection
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Attempt fresh connection
            logger.info('Attempting fresh connection after recovery...');
            await this.connect();

        } catch (error) {
            logger.error('Recovery failed:', error);
            this.connectionState = 'failed';
            
            // Schedule a retry after a pause
            setTimeout(() => {
                logger.info('Attempting connection recovery retry...');
                this.connectionState = 'disconnected';
                this.connect().catch(e => logger.error('Recovery retry failed:', e));
            }, 10000); // Wait 10 seconds
        }
    }

    startHealthCheck() {
        this.healthCheckInterval = setInterval(() => {
            try {
                this.checkConnectionHealth();
            } catch (error) {
                logger.error('Error in health check:', error);
            }
        }, this.config.healthCheckInterval);
    }

    startPingMonitoring() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        this.pingInterval = setInterval(async () => {
            try {
                if (this.isConnected && this.socket?.ws) {
                    this.socket.ws.ping();
                    this.lastPingTime = Date.now();
                }
            } catch (error) {
                logger.error('Ping error:', error);
                this.handlePingError();
            }
        }, 30000);
    }

    async handlePingError() {
        this.errorCount++;
        if (this.errorCount >= this.config.circuitBreakerThreshold) {
            this.circuitBreakerOpen = true;
            logger.warn('Circuit breaker opened due to ping failures');
            return;
        }
        await this.implementRecovery();
    }

    async checkConnectionHealth() {
        if (!this.isConnected) return;

        const now = Date.now();
        const timeSinceLastCheck = now - this.lastStateCheck;
        this.lastStateCheck = now;

        const healthStatus = {
            uptime: now - this.lastConnectionTime,
            activeConnections: this.activeConnections.size,
            messageRate: this.connectionHistory.length,
            retryCount: this.retryCount,
            lastPing: now - this.lastPingTime,
            state: this.connectionState,
            timeSinceLastCheck,
            socketState: this.socket?.ws?.readyState,
            qrAttempts: this.qrDisplayCount,
            errorCount: this.errorCount,
            circuitBreakerStatus: this.circuitBreakerOpen ? 'open' : 'closed'
        };

        // Advanced health checks
        if (healthStatus.lastPing > 60000) {
            logger.warn('Connection stale - ping timeout exceeded');
            await this.implementRecovery();
            return;
        }

        if (healthStatus.socketState !== 1) { // 1 = OPEN
            logger.warn('WebSocket not in OPEN state, checking connection...');
            if (timeSinceLastCheck > 300000) { // 5 minutes
                await this.implementRecovery();
                return;
            }
        }

        // Clean up old connections
        const staleConnections = [];
        for (const [timestamp, socket] of this.activeConnections) {
            if (now - timestamp > 3600000) {
                staleConnections.push(timestamp);
            }
        }

        staleConnections.forEach(timestamp => {
            this.activeConnections.delete(timestamp);
            logger.debug(`Cleaned up stale connection from ${new Date(timestamp).toISOString()}`);
        });

        logger.debug('Connection health status:', healthStatus);
    }

    startSocketStateMonitoring() {
        setInterval(() => {
            if (this.socket?.ws) {
                const state = this.socket.ws.readyState;
                if (state !== 1 && this.connectionState === 'connected') {
                    logger.warn('Socket in invalid state:', state);
                    this.handleSocketStateError();
                }
            }
        }, 10000);
    }

    async handleSocketStateError() {
        this.errorCount++;
        if (this.errorCount >= this.config.circuitBreakerThreshold) {
            this.circuitBreakerOpen = true;
            this.lastCircuitBreakerReset = Date.now();
            logger.warn('Circuit breaker opened due to socket state errors');
            return;
        }
        await this.implementRecovery();
    }

    setMessageHandler(handler) {
        this.messageHandler = handler;
    }

    async disconnect(cleanupData = false) {
        // Clear all intervals
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
            this.backupInterval = null;
        }
        
        // Create a final backup before disconnecting
        try {
            if (this.socket?.authState?.creds) {
                await backupManager.createBackup(this.socket.authState.creds);
                logger.info('Created final credential backup before disconnect');
            }
        } catch (backupError) {
            logger.warn('Failed to create final backup:', backupError.message);
        }

        if (this.socket) {
            try {
                // Gracefully logout with timeout
                logger.info('Attempting graceful logout...');
                await Promise.race([
                    this.socket.logout().catch(e => logger.warn('Logout operation failed:', e.message)),
                    new Promise(resolve => setTimeout(resolve, 5000)) // 5 second timeout
                ]);
                
                // Gracefully end the connection with timeout
                logger.info('Terminating connection...');
                await Promise.race([
                    this.socket.end(false).catch(e => logger.warn('End operation failed:', e.message)),
                    new Promise(resolve => setTimeout(resolve, 5000)) // 5 second timeout
                ]);
                
                this.isConnected = false;
                this.connectionState = 'disconnected';
                logger.info('Disconnected successfully');
                
                // Clean up connection data
                this.activeConnections.clear();
                this.socket = null;
                
                // If requested, clean up auth data
                if (cleanupData) {
                    logger.info('Cleaning auth data as requested');
                    // Backup before deletion
                    if (fs.existsSync(this.config.authDir)) {
                        const backupDir = `${this.config.authDir}_final_backup_${Date.now()}`;
                        try {
                            fs.renameSync(this.config.authDir, backupDir);
                            logger.info(`Backed up auth info to: ${backupDir}`);
                            
                            // Create empty auth directory
                            fs.mkdirSync(this.config.authDir, { recursive: true });
                        } catch (fsError) {
                            logger.error('Error cleaning up auth data:', fsError.message);
                        }
                    }
                }
            } catch (error) {
                logger.error('Error during disconnect:', error.message);
                this.connectionState = 'failed';
                this.socket = null; // Force cleanup reference
            }
        } else {
            logger.info('No active socket to disconnect');
        }
        
        // Reset all state
        this.retryCount = 0;
        this.connectionAttempts = 0;
        this.qrDisplayCount = 0;
        this.errorCount = 0;
        this.circuitBreakerOpen = false;
        this.connectionHistory = [];
        
        return true;
    }

    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            retryCount: this.retryCount,
            connectionAttempts: this.connectionAttempts,
            lastConnectionTime: this.lastConnectionTime,
            qrDisplayCount: this.qrDisplayCount,
            maxRetries: this.maxRetries,
            activeConnections: this.activeConnections.size,
            messageRate: this.connectionHistory.length,
            uptime: this.lastConnectionTime ? Date.now() - this.lastConnectionTime : 0,
            state: this.connectionState,
            lastPing: this.lastPingTime ? Date.now() - this.lastPingTime : 0,
            errorCount: this.errorCount,
            circuitBreakerStatus: this.circuitBreakerOpen ? 'open' : 'closed'
        };
    }

    shouldIgnoreJid(jid) {
        return jid.endsWith('@broadcast') || // Ignore broadcast messages
               jid.includes('status@broadcast') || // Ignore status messages
               jid.startsWith('120363'); // Ignore certain message types
    }

    enhanceMessage(message) {
        // Add custom metadata or modify message before sending
        if (message && typeof message === 'object') {
            message.enhanced = true;
            message.timestamp = Date.now();
        }
        return message;
    }
}

module.exports = ConnectionHandler;