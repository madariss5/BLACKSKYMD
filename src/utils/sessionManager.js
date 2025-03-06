const fs = require('fs').promises;
const logger = require('./logger');
const config = require('../config/config');
const path = require('path');

class SessionManager {
    constructor() {
        this.sessionsDir = path.join(process.cwd(), 'sessions');
        this.authDir = path.join(process.cwd(), 'auth_info');
        this.credentialsFile = path.join(this.authDir, 'creds.json');
    }

    async initialize() {
        try {
            // Ensure directories exist
            await fs.mkdir(this.sessionsDir, { recursive: true });
            await fs.mkdir(this.authDir, { recursive: true });

            logger.info('Session directories initialized');
            return true;
        } catch (err) {
            logger.error('Failed to initialize session directories:', err);
            return false;
        }
    }

    async clearSession() {
        try {
            logger.info('Clearing session data...');

            // Clear auth directory
            await fs.rm(this.authDir, { recursive: true, force: true });
            await fs.mkdir(this.authDir, { recursive: true });

            // Clear sessions directory
            await fs.rm(this.sessionsDir, { recursive: true, force: true });
            await fs.mkdir(this.sessionsDir, { recursive: true });

            logger.info('Session data cleared successfully');
            return true;
        } catch (err) {
            logger.error('Error clearing session:', err);
            return false;
        }
    }

    async saveSession(id, data) {
        try {
            await fs.mkdir(this.sessionsDir, { recursive: true });

            // Remove sensitive data before saving
            const sanitizedData = this._sanitizeSessionData(data);

            // Compact JSON and save
            await fs.writeFile(
                path.join(this.sessionsDir, `${id}.json`),
                JSON.stringify(sanitizedData),
                'utf8'
            );

            logger.info(`Session saved: ${id}`);
            return true;
        } catch (err) {
            logger.error('Error saving session:', err);
            return false;
        }
    }

    async loadSession(id) {
        try {
            const data = await fs.readFile(
                path.join(this.sessionsDir, `${id}.json`),
                'utf8'
            );
            return JSON.parse(data);
        } catch (err) {
            logger.debug('No existing session found:', err.message);
            return null;
        }
    }

    async backupCredentials() {
        try {
            if (!await this._fileExists(this.credentialsFile)) {
                logger.error('Credentials file not found');
                return false;
            }

            const credsData = await fs.readFile(this.credentialsFile, 'utf8');
            const backupPath = path.join(this.sessionsDir, `creds_backup_${Date.now()}.json`);

            await fs.writeFile(backupPath, credsData, 'utf8');
            logger.info('Credentials backup created successfully');

            return true;
        } catch (err) {
            logger.error('Error backing up credentials:', err);
            return false;
        }
    }

    async emergencyCredsSave(state) {
        try {
            const emergencyPath = path.join(this.sessionsDir, `emergency_creds_${Date.now()}.json`);
            await fs.writeFile(emergencyPath, JSON.stringify(state), 'utf8');
            logger.info('Emergency credentials save successful');
            return true;
        } catch (err) {
            logger.error('Emergency credentials save failed:', err);
            return false;
        }
    }

    async _fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    _sanitizeSessionData(data) {
        // Deep clone the data
        const sanitized = JSON.parse(JSON.stringify(data));

        // Remove sensitive fields
        delete sanitized.encKey;
        delete sanitized.macKey;

        return sanitized;
    }

    async createBackupSchedule() {
        try {
            // Initial backup
            await this.backupCredentials();
            logger.info('Initial session backup created');

            // Schedule regular backups
            setInterval(async () => {
                const success = await this.backupCredentials();
                if (!success) {
                    logger.warn('Scheduled backup failed');
                }
            }, 3600000); // Every hour

            logger.info('Backup schedule created successfully');
            return true;
        } catch (err) {
            logger.error('Error creating backup schedule:', err);
            return false;
        }
    }

    async handleCredentialsBackup(message) {
        try {
            if (!message?.text) {
                logger.debug('Skipping non-text message in handleCredentialsBackup');
                return false;
            }

            let data;
            try {
                data = JSON.parse(message.text);
            } catch (err) {
                logger.debug('Message is not a valid JSON in handleCredentialsBackup');
                return false;
            }

            if (data.type !== 'BOT_CREDENTIALS_BACKUP') {
                logger.debug('Message is not a credentials backup');
                return false;
            }

            logger.info('Processing credentials backup message...');

            // Decode and verify the backup
            const decodedCreds = Buffer.from(data.data, 'base64').toString();
            const checksum = require('crypto')
                .createHash('sha256')
                .update(decodedCreds)
                .digest('hex');

            if (checksum !== data.checksum) {
                logger.error('Backup checksum verification failed');
                return false;
            }

            // Parse the decoded credentials and ensure it's in one line without spaces
            const credentials = JSON.parse(decodedCreds);

            // Save backup with timestamp and ensure it's in one line without spaces
            await this.saveSession(this.backupSessionID, credentials);

            logger.info(`Credentials backup saved successfully. Timestamp: ${data.timestamp}`);
            return true;
        } catch (err) {
            logger.error('Error in handleCredentialsBackup:', err);
            return false;
        }
    }

    async restoreFromBackup() {
        try {
            // Load the backup session
            const backup = await this.loadSession(this.backupSessionID);
            if (!backup) {
                throw new Error('No backup found');
            }

            // Write back to credentials file in one line without spaces
            await fs.writeFile(
                this.credentialsFile,
                JSON.stringify(backup).replace(/\s+/g, ''),
                'utf8'
            );

            logger.info('Credentials restored from backup successfully');
            return true;
        } catch (err) {
            logger.error('Error restoring credentials:', err);
            return false;
        }
    }
}

const sessionManager = new SessionManager();
module.exports = { sessionManager };