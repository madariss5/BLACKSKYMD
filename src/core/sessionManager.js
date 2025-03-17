/**
 * Session Manager for WhatsApp Bot
 * Provides reliable session persistence and backup functionality
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { ensureDirectoryExists, fileExists, readJsonFile, writeJsonFile } = require('../utils/fileUtils');

// Constants
const AUTH_DIR = './auth_info_baileys';
const BACKUP_DIR = './auth_info_baileys_backup';
const DATA_BACKUP_DIR = './data/session_backups';
const LEGACY_BACKUP_DIR = './backups';
const MAX_BACKUPS = 50;
const TIMESTAMP_FORMAT = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
});

class SessionManager {
    constructor() {
        this.ensureDirectories();
    }

    /**
     * Ensure all required directories exist
     */
    ensureDirectories() {
        ensureDirectoryExists(AUTH_DIR);
        ensureDirectoryExists(BACKUP_DIR);
        ensureDirectoryExists(DATA_BACKUP_DIR);
        ensureDirectoryExists(LEGACY_BACKUP_DIR);
    }

    /**
     * Backup current credentials to multiple locations for redundancy
     */
    async backupCredentials() {
        try {
            const timestamp = Date.now();
            const credentialPath = path.join(AUTH_DIR, 'creds.json');
            
            if (!fileExists(credentialPath)) {
                logger.warn('No credentials to backup');
                return false;
            }
            
            const credentials = readJsonFile(credentialPath);
            if (!credentials) {
                logger.error('Failed to read credentials for backup');
                return false;
            }
            
            // Backup file names with timestamps
            const backupFileName = `creds_backup_${timestamp}.json`;
            const standardBackupPath = path.join(BACKUP_DIR, backupFileName);
            const dataBackupPath = path.join(DATA_BACKUP_DIR, backupFileName);
            const legacyBackupPath = path.join(LEGACY_BACKUP_DIR, backupFileName);
            const latestBackupPath = path.join(LEGACY_BACKUP_DIR, 'latest_creds.json');
            
            // Write backup to multiple locations
            const backupResults = [
                writeJsonFile(standardBackupPath, credentials),
                writeJsonFile(dataBackupPath, credentials),
                writeJsonFile(legacyBackupPath, credentials),
                writeJsonFile(latestBackupPath, credentials)
            ];
            
            // Log results
            if (backupResults.every(Boolean)) {
                logger.info(`Backup saved to ${standardBackupPath}`);
                logger.info(`Backup saved to ${dataBackupPath}`);
                logger.info(`Backup saved to ${legacyBackupPath}`);
            } else {
                logger.warn('Some backups failed to save');
            }
            
            // Clean up old backups
            await this.cleanupOldBackups();
            
            return true;
        } catch (err) {
            logger.error('Error during credential backup:', err);
            return false;
        }
    }
    
    /**
     * Restore credentials from the best available backup
     */
    async restoreCredentials() {
        try {
            logger.info('Attempting to restore credentials from backups...');
            
            // Candidate backup locations in priority order
            const candidates = [
                { dir: LEGACY_BACKUP_DIR, file: 'latest_creds.json' },
                { dir: BACKUP_DIR, filter: 'creds_backup_' },
                { dir: DATA_BACKUP_DIR, filter: 'creds_backup_' },
                { dir: LEGACY_BACKUP_DIR, filter: 'creds_backup_' }
            ];
            
            let restoredCreds = null;
            
            for (const candidate of candidates) {
                if (candidate.file) {
                    // Try exact file
                    const filePath = path.join(candidate.dir, candidate.file);
                    if (fileExists(filePath)) {
                        logger.info(`Restored from ${filePath}`);
                        restoredCreds = readJsonFile(filePath);
                        if (restoredCreds) break;
                    }
                } else if (candidate.filter) {
                    // Try latest file matching filter
                    const files = fs.readdirSync(candidate.dir)
                        .filter(f => f.startsWith(candidate.filter) && f.endsWith('.json'))
                        .sort((a, b) => {
                            // Sort by timestamp in filename (descending)
                            const tsA = parseInt(a.replace(/[^0-9]/g, ''));
                            const tsB = parseInt(b.replace(/[^0-9]/g, ''));
                            return tsB - tsA;
                        });
                    
                    if (files.length > 0) {
                        const latestFile = path.join(candidate.dir, files[0]);
                        logger.info(`Restoring from latest backup: ${latestFile}`);
                        restoredCreds = readJsonFile(latestFile);
                        if (restoredCreds) break;
                    }
                }
            }
            
            if (!restoredCreds) {
                logger.warn('No valid backup found to restore credentials');
                return false;
            }
            
            // Write restored credentials to the auth directory
            ensureDirectoryExists(AUTH_DIR);
            const credPath = path.join(AUTH_DIR, 'creds.json');
            const success = writeJsonFile(credPath, restoredCreds);
            
            if (success) {
                logger.info('Restored credentials from backup system');
                return true;
            } else {
                logger.error('Failed to write restored credentials');
                return false;
            }
        } catch (err) {
            logger.error('Error during credential restoration:', err);
            return false;
        }
    }
    
    /**
     * Clean up old backup files to prevent excessive storage use
     */
    async cleanupOldBackups() {
        try {
            const directories = [BACKUP_DIR, DATA_BACKUP_DIR, LEGACY_BACKUP_DIR];
            
            for (const dir of directories) {
                if (!fs.existsSync(dir)) continue;
                
                const files = fs.readdirSync(dir)
                    .filter(f => f.startsWith('creds_backup_') && f.endsWith('.json'))
                    .sort((a, b) => {
                        // Sort by timestamp in filename (descending)
                        const tsA = parseInt(a.replace(/[^0-9]/g, ''));
                        const tsB = parseInt(b.replace(/[^0-9]/g, ''));
                        return tsB - tsA;
                    });
                
                // Keep only the most recent MAX_BACKUPS files
                if (files.length > MAX_BACKUPS) {
                    const filesToDelete = files.slice(MAX_BACKUPS);
                    for (const file of filesToDelete) {
                        fs.unlinkSync(path.join(dir, file));
                    }
                    
                    logger.debug(`Cleaned up ${filesToDelete.length} old backup files in ${dir}`);
                }
            }
            
            return true;
        } catch (err) {
            logger.error('Error cleaning up old backups:', err);
            return false;
        }
    }
    
    /**
     * Calculate a checksum for data verification
     * @param {string|Object} data - Data to hash
     * @returns {string} - SHA-256 hash
     */
    calculateChecksum(data) {
        const content = typeof data === 'string' ? data : JSON.stringify(data);
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    
    /**
     * Create a backup with metadata for better tracking
     * @param {Object} credentials - Credentials object
     * @returns {Object} - Enhanced backup object with metadata
     */
    createMetadataBackup(credentials) {
        return {
            data: credentials,
            metadata: {
                timestamp: Date.now(),
                checksum: this.calculateChecksum(credentials),
                version: '1.0'
            }
        };
    }
}

module.exports = SessionManager;