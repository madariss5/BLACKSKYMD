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
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 15000,
            retryRequestDelayMs: 5000,
            maxQRAttempts: 5,
            maxRetries: 5,
            healthCheckInterval: 30000,
            circuitBreakerThreshold: 3,
            circuitBreakerTimeout: 300000, // 5 minutes
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

        // Ensure auth directory exists
        if (!fs.existsSync(this.config.authDir)) {
            fs.mkdirSync(this.config.authDir, { recursive: true });
            logger.info(`Created auth directory: ${this.config.authDir}`);
        }

        // Start health monitoring
        this.startHealthCheck();
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

            // Initialize auth state
            const { state, saveCreds } = await useMultiFileAuthState(this.config.authDir);
            logger.debug('Auth state loaded successfully');

            // Enhanced socket settings
            this.socket = makeWASocket({
                auth: state,
                printQRInTerminal: true, // Always enable QR printing
                browser: this.config.browser,
                logger: pino({ level: 'silent' }), // Reduce noise
                markOnlineOnConnect: false, // Save battery
                connectTimeoutMs: this.config.connectTimeoutMs,
                keepAliveIntervalMs: this.config.keepAliveIntervalMs,
                retryRequestDelayMs: this.config.retryRequestDelayMs,
                defaultQueryTimeoutMs: 60000,
                qrTimeout: 60000,
                version: [2, 2329, 9],
                getMessage: async (key) => {
                    return { conversation: 'Message not found in store' };
                },
                patchMessageBeforeSending: (message) => {
                    return this.enhanceMessage(message);
                },
                shouldIgnoreJid: (jid) => {
                    return this.shouldIgnoreJid(jid);
                }
            });

            logger.debug('Socket created with enhanced settings');

            // Setup event handlers with enhanced monitoring
            this.socket.ev.on('connection.update', async (update) => {
                try {
                    logger.debug('Connection update received:', update);
                    await this.handleConnectionUpdate(update, saveCreds);
                } catch (error) {
                    logger.error('Error in connection update handler:', error);
                    await this.handleConnectionError(error);
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
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect && this.retryCount < this.maxRetries) {
            this.retryCount++;
            const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 30000);
            logger.info(`Connection closed. Attempting reconnect ${this.retryCount}/${this.maxRetries} in ${delay/1000}s`);

            setTimeout(() => {
                if (!this.isConnected) {
                    this.connect();
                }
            }, delay);
        } else if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
            logger.warn('Session logged out. Please scan QR code to reconnect.');
            await this.handleLogout();
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

            // Clean up socket
            if (this.socket) {
                try {
                    await this.socket.logout();
                    await this.socket.end();
                } catch (error) {
                    logger.warn('Error during socket cleanup:', error);
                }
            }

            // Clear active connections
            this.activeConnections.clear();

            // Create fresh auth directory
            fs.mkdirSync(this.config.authDir, { recursive: true });
            logger.info('Created fresh auth directory');

            // Attempt fresh connection
            logger.info('Attempting fresh connection after recovery...');
            await this.connect();

        } catch (error) {
            logger.error('Recovery failed:', error);
            this.connectionState = 'failed';
            throw new Error('Connection recovery failed after multiple attempts');
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

    async disconnect() {
        clearInterval(this.healthCheckInterval);
        clearInterval(this.pingInterval);

        if (this.socket) {
            try {
                await this.socket.logout();
                await this.socket.end();
                this.isConnected = false;
                this.activeConnections.clear();
                this.connectionState = 'disconnected';
                logger.info('Disconnected successfully');
            } catch (error) {
                logger.error('Error during disconnect:', error);
                this.connectionState = 'failed';
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