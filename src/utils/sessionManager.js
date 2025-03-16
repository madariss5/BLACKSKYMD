/**
 * Enhanced Session Manager for WhatsApp Connections
 * Handles session replacements and prevents status code 440 errors
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const crypto = require('crypto');

class SessionManager {
    constructor(options = {}) {
        this.authDir = options.authDir || path.join(process.cwd(), 'auth_info_baileys');
        this.backupDir = options.backupDir || path.join(process.cwd(), 'auth_info_backup');
        this.retryCount = 0;
        this.maxRetries = options.maxRetries || 5;
        this.retryDelay = options.retryDelay || 3000;
        this.connectionId = this._generateConnectionId();
        this.locks = new Map();
        
        // Ensure directories exist
        this._createDirectories();
        
        logger.info(`SessionManager initialized with connection ID: ${this.connectionId}`);
        logger.info(`Using auth directory: ${this.authDir}`);
        logger.info(`Using backup directory: ${this.backupDir}`);
    }

    /**
     * Generate a unique connection ID
     * @returns {string} Unique connection ID
     */
    _generateConnectionId() {
        return `connection_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    /**
     * Create necessary directories
     */
    async _createDirectories() {
        try {
            await fs.mkdir(this.authDir, { recursive: true });
            await fs.mkdir(this.backupDir, { recursive: true });
        } catch (err) {
            logger.error(`Error creating directories: ${err.message}`);
        }
    }

    /**
     * Clean up old sessions to prevent conflicts
     */
    async _cleanupOldSessions() {
        try {
            // Get current timestamp for cleaning old sessions
            const now = Date.now();
            
            // Read auth directory for old sessions
            const authDirs = await fs.readdir(process.cwd());
            
            // Find auth info directories
            const oldAuthDirs = authDirs.filter(dir => 
                dir.startsWith('auth_info_') && 
                dir !== 'auth_info_baileys' && 
                dir !== 'auth_info_backup' &&
                !isNaN(dir.split('_').pop())
            );
            
            // Sort by creation time (assuming the timestamp is in the name)
            const sortedDirs = oldAuthDirs.sort((a, b) => {
                const timeA = parseInt(a.split('_').pop()) || 0;
                const timeB = parseInt(b.split('_').pop()) || 0;
                return timeB - timeA; // Most recent first
            });
            
            // Keep the 3 most recent directories and delete the rest
            const dirsToKeep = sortedDirs.slice(0, 3);
            const dirsToDelete = sortedDirs.slice(3);
            
            for (const dir of dirsToDelete) {
                logger.info(`Cleaning up old auth directory: ${dir}`);
                await this._recursiveDelete(path.join(process.cwd(), dir));
            }
            
            return dirsToKeep;
        } catch (err) {
            logger.error(`Error cleaning up old sessions: ${err.message}`);
            return [];
        }
    }
    
    /**
     * Recursively delete a directory
     * @param {string} dirPath - Path to directory
     */
    async _recursiveDelete(dirPath) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    await this._recursiveDelete(fullPath);
                } else {
                    await fs.unlink(fullPath);
                }
            }
            
            await fs.rmdir(dirPath);
        } catch (err) {
            logger.error(`Error deleting directory ${dirPath}: ${err.message}`);
        }
    }

    /**
     * Get configuration for WhatsApp connection
     * @returns {Object} Connection configuration
     */
    getConnectionConfig() {
        return {
            auth: {
                creds: null,
                keys: null
            },
            printQRInTerminal: false,
            browser: ['Firefox (Linux)', 'Firefox', '109'], // Use Firefox browser fingerprint
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: false, // Disable for better performance
            syncFullHistory: false,
            userDevicesCache: false,
            disableDBCache: true, // Disable database cache to prevent disk issues
            usePairingCode: false, // Disable pairing code for QR connection
            transactionOpts: {
                maxCommitRetries: 15, // Increased retries
                delayBetweenTriesMs: 2000 // Shorter delay between retries
            },
            patchMessageBeforeSending: true,
            getMessage: async () => {
                return { conversation: 'Please update your WhatsApp' };
            },
            shouldIgnoreJid: jid => jid.includes('broadcast'),
            fireInitQueries: false, // Disable init queries for better stability
            retryRequestDelayMs: 1500, // Faster retry
            emitOwnEvents: true,
            defaultQueryTimeoutMs: 90000, // 90 seconds timeout (increased for cloud environments)
            customUploadHosts: ['upload.whatsapp.com'],
            mediaCache: false, // Disable media cache for better performance
            shouldSyncHistoryMessage: () => false,
            linkPreviewImageThumbnailWidth: 192, // Smaller thumbnails
            options: {
                maxReconnectTries: 12, // More reconnect attempts
                maxReconnectTime: 180000, // 3 minutes max reconnect time
                connectTimeoutMs: 60000 // 60 seconds connection timeout
            }
        };
    }

    /**
     * Create a lock for a specific operation
     * @param {string} operation - The operation to lock
     * @returns {boolean} Whether the lock was acquired
     */
    async _acquireLock(operation) {
        if (this.locks.has(operation)) {
            return false;
        }
        
        this.locks.set(operation, Date.now());
        return true;
    }
    
    /**
     * Release a lock for a specific operation
     * @param {string} operation - The operation to unlock
     */
    _releaseLock(operation) {
        this.locks.delete(operation);
    }

    /**
     * Save WhatsApp session to disk
     * @param {string} id - Session identifier
     * @param {Object} data - Session data to save
     * @returns {Promise<boolean>} Whether save was successful
     */
    async saveSession(id, data) {
        if (!await this._acquireLock('save')) {
            logger.info('Another save operation in progress, skipping');
            return false;
        }
        
        try {
            // Clean up the session data to ensure it's safe to serialize
            const sanitizedData = this._sanitizeSessionData(data);
            
            // Save to the main auth directory
            const savePath = path.join(this.authDir, 'creds.json');
            await fs.writeFile(savePath, JSON.stringify(sanitizedData, null, 2));
            
            // Also save to a timestamped backup
            const backupPath = path.join(this.backupDir, `creds_${Date.now()}.json`);
            await fs.writeFile(backupPath, JSON.stringify(sanitizedData, null, 2));
            
            logger.info(`Session saved successfully to ${savePath}`);
            
            // Clean up old backup files (keep last 10)
            const backupFiles = await fs.readdir(this.backupDir);
            if (backupFiles.length > 10) {
                const sortedFiles = backupFiles
                    .filter(file => file.startsWith('creds_'))
                    .sort((a, b) => {
                        const timeA = parseInt(a.split('_')[1]) || 0;
                        const timeB = parseInt(b.split('_')[1]) || 0;
                        return timeA - timeB; // Oldest first
                    });
                
                const filesToDelete = sortedFiles.slice(0, sortedFiles.length - 10);
                for (const file of filesToDelete) {
                    await fs.unlink(path.join(this.backupDir, file));
                }
            }
            
            return true;
        } catch (err) {
            logger.error(`Error saving session: ${err.message}`);
            return false;
        } finally {
            this._releaseLock('save');
        }
    }

    /**
     * Load WhatsApp session from disk
     * @param {string} id - Session identifier
     * @returns {Promise<Object|null>} Session data or null if not found
     */
    async loadSession(id) {
        if (!await this._acquireLock('load')) {
            logger.info('Another load operation in progress, skipping');
            return null;
        }
        
        try {
            // Try to load from main auth directory first
            const loadPath = path.join(this.authDir, 'creds.json');
            
            if (await this._fileExists(loadPath)) {
                const data = await fs.readFile(loadPath, 'utf8');
                const sessionData = JSON.parse(data);
                logger.info(`Session loaded successfully from ${loadPath}`);
                this._releaseLock('load');
                return sessionData;
            }
            
            // If main auth fails, try to load from the latest backup
            const backupFiles = await fs.readdir(this.backupDir);
            const credFiles = backupFiles
                .filter(file => file.startsWith('creds_'))
                .sort((a, b) => {
                    const timeA = parseInt(a.split('_')[1]) || 0;
                    const timeB = parseInt(b.split('_')[1]) || 0;
                    return timeB - timeA; // Most recent first
                });
            
            if (credFiles.length > 0) {
                const latestBackup = path.join(this.backupDir, credFiles[0]);
                const data = await fs.readFile(latestBackup, 'utf8');
                const sessionData = JSON.parse(data);
                logger.info(`Session loaded from backup: ${latestBackup}`);
                
                // Copy this backup to the main auth directory
                await fs.writeFile(loadPath, JSON.stringify(sessionData, null, 2));
                
                this._releaseLock('load');
                return sessionData;
            }
            
            logger.warn('No session found to load');
            return null;
        } catch (err) {
            logger.error(`Error loading session: ${err.message}`);
            return null;
        } finally {
            this._releaseLock('load');
        }
    }

    /**
     * Sanitize session data to ensure it can be safely serialized
     * @param {Object} data - Session data to sanitize
     * @returns {Object} Sanitized session data
     */
    _sanitizeSessionData(data) {
        // Handle circular references and non-serializable data
        // We'll create a deep copy with only serializable properties
        if (!data) return null;
        
        const safe = {};
        
        // Copy only serializable properties
        for (const [key, value] of Object.entries(data)) {
            if (
                typeof value !== 'function' && 
                typeof value !== 'symbol' && 
                key !== 'browser' && // Skip browser info which might contain circular refs
                key !== '_events' && // Skip event emitters
                key !== '_eventsCount' &&
                key !== '_maxListeners'
            ) {
                if (typeof value === 'object' && value !== null) {
                    try {
                        // Test if it can be JSON stringified
                        JSON.stringify(value);
                        safe[key] = value;
                    } catch (e) {
                        // Skip properties that can't be stringified
                        logger.warn(`Skipping non-serializable property: ${key}`);
                    }
                } else {
                    safe[key] = value;
                }
            }
        }
        
        return safe;
    }

    /**
     * Handle connection errors with appropriate retry logic
     * @param {Error} error - Connection error
     * @param {number} statusCode - Status code from disconnect
     * @returns {Promise<boolean>} Whether to retry connection
     */
    async handleConnectionError(error, statusCode) {
        // Status code 440 means the session was replaced, so we need to use a new auth directory
        if (statusCode === 440) {
            logger.warn('Session replaced (status code 440), creating a new session directory');
            
            // Create a new auth directory with timestamp
            const timestamp = Date.now();
            const newAuthDir = path.join(process.cwd(), `auth_info_${timestamp}`);
            
            try {
                await fs.mkdir(newAuthDir, { recursive: true });
                
                // Update the auth directory for future connections
                this.authDir = newAuthDir;
                
                // Clean up old session directories to prevent clutter
                await this._cleanupOldSessions();
                
                logger.info(`Created new auth directory: ${newAuthDir}`);
                
                // Reset retry count since we're starting fresh
                this.resetRetryCount();
                return true;
            } catch (err) {
                logger.error(`Error creating new auth directory: ${err.message}`);
            }
        }
        
        // Implement exponential backoff for retries
        this.retryCount++;
        
        if (this.retryCount <= this.maxRetries) {
            const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
            logger.info(`Retrying connection in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
            
            return new Promise(resolve => {
                setTimeout(() => resolve(true), delay);
            });
        }
        
        logger.error(`Maximum retry attempts (${this.maxRetries}) reached, giving up`);
        return false;
    }

    /**
     * Reset the retry counter (usually after successful connection)
     */
    resetRetryCount() {
        this.retryCount = 0;
    }

    /**
     * Clear the current session (used when starting fresh)
     * @returns {Promise<boolean>} Whether clear was successful
     */
    async clearSession() {
        if (!await this._acquireLock('clear')) {
            logger.info('Another clear operation in progress, skipping');
            return false;
        }
        
        try {
            // Create a timestamped backup of current auth directory
            const timestamp = Date.now();
            const backupPath = path.join(process.cwd(), `auth_info_backup_${timestamp}`);
            
            // Only copy if the directory exists and has files
            const authExists = await this._fileExists(this.authDir);
            if (authExists) {
                const files = await fs.readdir(this.authDir);
                if (files.length > 0) {
                    await fs.mkdir(backupPath, { recursive: true });
                    
                    for (const file of files) {
                        const srcPath = path.join(this.authDir, file);
                        const dstPath = path.join(backupPath, file);
                        await fs.copyFile(srcPath, dstPath);
                    }
                    
                    logger.info(`Created backup of auth directory: ${backupPath}`);
                }
            }
            
            // Create a new auth directory
            const newAuthDir = path.join(process.cwd(), `auth_info_${timestamp}`);
            await fs.mkdir(newAuthDir, { recursive: true });
            
            // Update the auth directory for future connections
            this.authDir = newAuthDir;
            
            logger.info(`Session cleared, new auth directory: ${newAuthDir}`);
            
            // Clean up old sessions in the background
            this._cleanupOldSessions().catch(err => {
                logger.error(`Background cleanup error: ${err.message}`);
            });
            
            return true;
        } catch (err) {
            logger.error(`Error clearing session: ${err.message}`);
            return false;
        } finally {
            this._releaseLock('clear');
        }
    }

    /**
     * Check if a file or directory exists
     * @param {string} filePath - Path to check
     * @returns {Promise<boolean>} Whether the file exists
     */
    async _fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch (err) {
            return false;
        }
    }
}

// Create and export singleton instance
const sessionManager = new SessionManager();
module.exports = { sessionManager };