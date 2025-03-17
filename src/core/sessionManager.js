/**
 * WhatsApp Session Manager
 * Provides persistent session storage and backup mechanisms
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

class SessionManager {
    constructor(options = {}) {
        this.options = {
            sessionDir: options.sessionDir || './auth_info_baileys',
            backupDir: options.backupDir || './auth_info_baileys_backup',
            maxBackups: options.maxBackups || 5,
            backupInterval: options.backupInterval || (30 * 60 * 1000), // 30 minutes
            autoBackup: options.autoBackup !== false,
        };
        this.backupTimer = null;
        this.isInitialized = false;
    }

    /**
     * Initialize session manager
     * @returns {Promise<boolean>} Whether initialization was successful
     */
    async initialize() {
        try {
            // Ensure directories exist
            if (!fs.existsSync(this.options.sessionDir)) {
                fs.mkdirSync(this.options.sessionDir, { recursive: true });
                logger.info(`Created session directory: ${this.options.sessionDir}`);
            }
            
            if (!fs.existsSync(this.options.backupDir)) {
                fs.mkdirSync(this.options.backupDir, { recursive: true });
                logger.info(`Created backup directory: ${this.options.backupDir}`);
            }
            
            // Start periodic backup if enabled
            if (this.options.autoBackup) {
                this.startPeriodicBackup();
            }
            
            this.isInitialized = true;
            logger.info('Session manager initialized successfully');
            return true;
        } catch (error) {
            logger.error('Failed to initialize session manager:', error);
            return false;
        }
    }

    /**
     * Start periodic backup
     */
    startPeriodicBackup() {
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
        }
        
        this.backupTimer = setInterval(() => {
            this.backupSession().catch(err => {
                logger.error('Error during automatic session backup:', err);
            });
        }, this.options.backupInterval);
        
        logger.info(`Automatic session backup enabled (interval: ${this.options.backupInterval/60000} minutes)`);
    }

    /**
     * Stop periodic backup
     */
    stopPeriodicBackup() {
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
            this.backupTimer = null;
            logger.info('Automatic session backup disabled');
        }
    }

    /**
     * Backup the current session
     * @returns {Promise<string>} Path to the backup directory
     */
    async backupSession() {
        try {
            const timestamp = Date.now();
            const backupPath = `${this.options.backupDir}_${timestamp}`;
            
            // Create backup directory
            if (!fs.existsSync(backupPath)) {
                fs.mkdirSync(backupPath, { recursive: true });
            }
            
            // Copy session files to backup
            await this.copyDirectory(this.options.sessionDir, backupPath);
            
            // Create latest backup link
            const credFile = path.join(backupPath, 'creds.json');
            if (fs.existsSync(credFile)) {
                await this.saveLatestBackup(credFile);
            }
            
            logger.info(`Session backup created: ${backupPath}`);
            
            // Clean up old backups
            await this.cleanupOldBackups();
            
            return backupPath;
        } catch (error) {
            logger.error('Error backing up session:', error);
            throw error;
        }
    }

    /**
     * Copy a directory recursively
     * @param {string} src Source directory
     * @param {string} dest Destination directory
     * @returns {Promise<void>}
     */
    async copyDirectory(src, dest) {
        const entries = fs.readdirSync(src, { withFileTypes: true });
        
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                fs.mkdirSync(destPath, { recursive: true });
                await this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    /**
     * Save the latest backup credentials
     * @param {string} credFile Path to the credentials file
     */
    async saveLatestBackup(credFile) {
        try {
            const latestPath = path.join(this.options.backupDir, 'latest_creds.json');
            fs.copyFileSync(credFile, latestPath);
            
            // Calculate and save checksum
            const fileBuffer = fs.readFileSync(credFile);
            const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            fs.writeFileSync(path.join(this.options.backupDir, 'latest_checksum.txt'), hash);
            
            logger.info('Latest backup credentials saved');
        } catch (error) {
            logger.error('Error saving latest backup:', error);
        }
    }

    /**
     * Clean up old backups to prevent excessive disk usage
     */
    async cleanupOldBackups() {
        try {
            const dirPattern = new RegExp(`^${path.basename(this.options.backupDir)}_\\d+$`);
            const backupDirs = fs.readdirSync(path.dirname(this.options.backupDir))
                .filter(dir => dirPattern.test(dir))
                .map(dir => ({
                    name: dir,
                    path: path.join(path.dirname(this.options.backupDir), dir),
                    timestamp: parseInt(dir.split('_')[1]) || 0
                }))
                .sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp, newest first
            
            // Keep only the specified number of backups
            if (backupDirs.length > this.options.maxBackups) {
                const dirsToRemove = backupDirs.slice(this.options.maxBackups);
                for (const dir of dirsToRemove) {
                    this.removeDirectory(dir.path);
                    logger.info(`Removed old backup: ${dir.path}`);
                }
            }
        } catch (error) {
            logger.error('Error cleaning up old backups:', error);
        }
    }

    /**
     * Remove a directory recursively
     * @param {string} dir Directory to remove
     */
    removeDirectory(dir) {
        if (!fs.existsSync(dir)) return;
        
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                this.removeDirectory(fullPath);
            } else {
                fs.unlinkSync(fullPath);
            }
        }
        
        fs.rmdirSync(dir);
    }

    /**
     * Restore session from latest backup
     * @returns {Promise<boolean>} Whether restore was successful
     */
    async restoreFromLatestBackup() {
        try {
            const latestCredsPath = path.join(this.options.backupDir, 'latest_creds.json');
            
            if (!fs.existsSync(latestCredsPath)) {
                logger.warn('No latest backup found to restore from');
                return false;
            }
            
            // Verify checksum if available
            const checksumPath = path.join(this.options.backupDir, 'latest_checksum.txt');
            if (fs.existsSync(checksumPath)) {
                const expectedHash = fs.readFileSync(checksumPath, 'utf8');
                const fileBuffer = fs.readFileSync(latestCredsPath);
                const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
                
                if (expectedHash !== actualHash) {
                    logger.error('Backup checksum verification failed');
                    return false;
                }
            }
            
            // Clear current session
            this.clearSession();
            
            // Copy latest backup to session directory
            const credsData = fs.readFileSync(latestCredsPath, 'utf8');
            fs.writeFileSync(path.join(this.options.sessionDir, 'creds.json'), credsData);
            
            logger.info('Session restored from latest backup');
            return true;
        } catch (error) {
            logger.error('Error restoring from backup:', error);
            return false;
        }
    }

    /**
     * Clear current session
     */
    clearSession() {
        try {
            if (fs.existsSync(this.options.sessionDir)) {
                this.removeDirectory(this.options.sessionDir);
                fs.mkdirSync(this.options.sessionDir, { recursive: true });
                logger.info('Current session cleared');
            }
        } catch (error) {
            logger.error('Error clearing session:', error);
        }
    }

    /**
     * Check if a valid session exists
     * @returns {boolean} Whether a valid session exists
     */
    hasValidSession() {
        try {
            const credsPath = path.join(this.options.sessionDir, 'creds.json');
            
            if (!fs.existsSync(credsPath)) {
                return false;
            }
            
            // Basic validation of creds.json
            try {
                const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
                return !!(creds && creds.me && creds.me.id);
            } catch (err) {
                logger.warn('Invalid session credentials format');
                return false;
            }
        } catch (error) {
            logger.error('Error checking session validity:', error);
            return false;
        }
    }

    /**
     * Get session statistics
     * @returns {Object} Session statistics
     */
    getStats() {
        try {
            const stats = {
                hasValidSession: this.hasValidSession(),
                backupCount: 0,
                latestBackupTimestamp: null,
                autoBackupEnabled: !!this.backupTimer,
            };
            
            // Get backup count
            const dirPattern = new RegExp(`^${path.basename(this.options.backupDir)}_\\d+$`);
            const backupDirs = fs.readdirSync(path.dirname(this.options.backupDir))
                .filter(dir => dirPattern.test(dir))
                .map(dir => ({
                    name: dir,
                    timestamp: parseInt(dir.split('_')[1]) || 0
                }))
                .sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp, newest first
            
            stats.backupCount = backupDirs.length;
            
            if (backupDirs.length > 0) {
                stats.latestBackupTimestamp = backupDirs[0].timestamp;
            }
            
            return stats;
        } catch (error) {
            logger.error('Error getting session stats:', error);
            return {
                hasValidSession: false,
                backupCount: 0,
                latestBackupTimestamp: null,
                autoBackupEnabled: !!this.backupTimer,
                error: error.message
            };
        }
    }
}

module.exports = SessionManager;