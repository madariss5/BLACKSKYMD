const fs = require('fs').promises;
const logger = require('./logger');
const config = require('../config/config');
const path = require('path');
const crypto = require('crypto');

class SessionManager {
    constructor() {
        this.sessionsDir = path.join(process.cwd(), 'sessions');
        this.authDir = path.join(process.cwd(), 'auth_info');
        this.credentialsFile = path.join(this.authDir, 'creds.json');
        this.isHeroku = process.env.PLATFORM === 'heroku';
        this.sessionId = process.env.SESSION_ID || 'default-session';
        this.retryAttempts = 0;
        this.maxRetries = 5;

        // Use tmp directory for Heroku's ephemeral filesystem
        if (this.isHeroku) {
            this.sessionsDir = path.join('/tmp', 'whatsapp-sessions');
            this.authDir = path.join('/tmp', process.env.AUTH_DIR || 'whatsapp-auth');
            this.credentialsFile = path.join(this.authDir, 'creds.json');
            logger.info('Running on Heroku, using temporary filesystem paths');
        }
    }

    async initialize() {
        try {
            // Generate unique browser fingerprint
            const timestamp = Date.now();
            const random = crypto.randomBytes(8).toString('hex');
            this.browserFingerprint = `BLACKSKY-${timestamp}-${random}`;

            // Ensure directories exist
            await fs.mkdir(this.sessionsDir, { recursive: true });
            await fs.mkdir(this.authDir, { recursive: true });

            // Clean up old sessions
            await this._cleanupOldSessions();

            if (this.isHeroku) {
                logger.info(`Initialized Heroku session with ID: ${this.sessionId}`);
                // On Heroku, we need to restore from a backup or regenerate session
                const backupExists = await this.restoreFromBackup();
                if (backupExists) {
                    logger.info('Successfully restored session from backup');
                } else {
                    logger.info('No session backup found, will generate new QR code');
                }
            } else {
                logger.info('Local session directories initialized');
            }

            return true;
        } catch (err) {
            logger.error('Failed to initialize session directories:', err);
            return false;
        }
    }

    async _cleanupOldSessions() {
        try {
            const files = await fs.readdir(this.sessionsDir);
            const currentTime = Date.now();
            const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

            for (const file of files) {
                const filePath = path.join(this.sessionsDir, file);
                const stats = await fs.stat(filePath);

                // Remove sessions older than 2 days
                if (currentTime - stats.mtimeMs > TWO_DAYS) {
                    await fs.unlink(filePath);
                    logger.info(`Removed old session file: ${file}`);
                }
            }
        } catch (err) {
            logger.warn('Error during session cleanup:', err);
        }
    }

    getConnectionConfig() {
        return {
            browser: [this.browserFingerprint, 'Chrome', '110.0.0'],
            printQRInTerminal: true,
            auth: {
                creds: this.credentialsFile,
                keys: this.authDir
            },
            logger: require('pino')({ level: 'warn' }),
            markOnlineOnConnect: false,
            connectTimeoutMs: 60000,
            qrTimeout: 40000,
            defaultQueryTimeoutMs: 30000,
            keepAliveIntervalMs: 15000,
            emitOwnEvents: true,
            syncFullHistory: false,
            retryRequestDelayMs: 2000,
            fireAndRetry: true,
            patchMessageBeforeSending: true
        };
    }

    async saveSession(id, data) {
        try {
            await fs.mkdir(this.sessionsDir, { recursive: true });
            const sanitizedData = this._sanitizeSessionData(data);

            // Save with timestamp for versioning
            const timestamp = Date.now();
            const sessionFile = path.join(this.sessionsDir, `${id}_${timestamp}.json`);

            await fs.writeFile(
                sessionFile,
                JSON.stringify(sanitizedData),
                'utf8'
            );

            // Create a symlink to latest version
            const latestLink = path.join(this.sessionsDir, `${id}_latest.json`);
            try {
                await fs.unlink(latestLink);
            } catch (err) {
                // Ignore if link doesn't exist
            }
            await fs.symlink(sessionFile, latestLink);

            logger.info(`Session saved: ${id}`);
            return true;
        } catch (err) {
            logger.error('Error saving session:', err);
            return false;
        }
    }

    async loadSession(id) {
        try {
            const latestLink = path.join(this.sessionsDir, `${id}_latest.json`);
            const data = await fs.readFile(latestLink, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            logger.debug('No existing session found:', err.message);
            return null;
        }
    }

    _sanitizeSessionData(data) {
        const sanitized = JSON.parse(JSON.stringify(data));
        delete sanitized.encKey;
        delete sanitized.macKey;
        return sanitized;
    }

    async handleConnectionError(error, statusCode) {
        logger.error(`Connection error (${statusCode}):`, error);

        if (statusCode === 405) {
            logger.info('Detected authentication failure (405), clearing session');
            await this.clearSession();
            return 'retry';
        }

        if (this.retryAttempts < this.maxRetries) {
            this.retryAttempts++;
            const delay = Math.min(5000 * Math.pow(2, this.retryAttempts - 1), 300000);
            logger.info(`Will retry in ${delay/1000} seconds (attempt ${this.retryAttempts}/${this.maxRetries})`);
            return delay;
        }

        logger.error('Max retry attempts reached');
        return 'abort';
    }

    resetRetryCount() {
        this.retryAttempts = 0;
    }

    async clearSession() {
        try {
            logger.info('Clearing session data...');

            // Backup before clearing if on Heroku
            if (this.isHeroku) {
                await this.backupCredentials();
            }

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

    async backupCredentials() {
        try {
            if (!await this._fileExists(this.credentialsFile)) {
                logger.error('Credentials file not found');
                return false;
            }

            const credsData = await fs.readFile(this.credentialsFile, 'utf8');

            // Save a timestamped backup - useful for recovery if needed
            await fs.writeFile(this._getBackupPath('timestamp'), credsData, 'utf8');

            // For Heroku or any environment, save a standard backup file that we can find later
            await fs.writeFile(this._getBackupPath('standard'), credsData, 'utf8');

            if (this.isHeroku) {
                logger.info(`Heroku persistent backup saved for session: ${this.sessionId}`);

                // If owner number is set, create a safety backup by sending to owner
                if (process.env.OWNER_NUMBER) {
                    try {
                        // We'll handle this in the sendCredsToSelf function which is called after connection
                        logger.info('Backup will be sent to the bot itself after connection');
                    } catch (backupErr) {
                        logger.error('Failed to prepare backup for owner:', backupErr);
                    }
                }

                // Limit the number of backup files to avoid filling up the filesystem
                try {
                    const files = await fs.readdir(this.sessionsDir);
                    const backupFiles = files.filter(file =>
                        file.includes('backup') &&
                        file.includes(this.sessionId) &&
                        file.includes('_backup_')
                    );

                    // If we have more than 5 backup files, remove the oldest ones
                    if (backupFiles.length > 5) {
                        // Sort by creation time (timestamp in filename)
                        backupFiles.sort();

                        // Remove the oldest files, keeping only the 5 newest
                        for (let i = 0; i < backupFiles.length - 5; i++) {
                            const fileToRemove = path.join(this.sessionsDir, backupFiles[i]);
                            await fs.unlink(fileToRemove);
                            logger.debug(`Removed old backup file: ${backupFiles[i]}`);
                        }
                    }
                } catch (cleanupErr) {
                    logger.warn('Error during backup file cleanup:', cleanupErr);
                }
            }

            logger.info('Credentials backup created successfully');
            return true;
        } catch (err) {
            logger.error('Error backing up credentials:', err);
            return false;
        }
    }

    async emergencyCredsSave(state) {
        try {
            // Always save a timestamped emergency backup
            const timestamp = Date.now();
            const timestampEmergencyPath = path.join(this.sessionsDir, `emergency_creds_${timestamp}.json`);
            await fs.writeFile(timestampEmergencyPath, JSON.stringify(state), 'utf8');

            // Also save using our consistent path helper
            await fs.writeFile(this._getBackupPath('emergency'), JSON.stringify(state), 'utf8');

            if (this.isHeroku) {
                logger.info(`Heroku emergency backup saved with session ID: ${this.sessionId}`);

                // Clean up old emergency files to avoid filesystem clutter
                try {
                    const files = await fs.readdir(this.sessionsDir);
                    const emergencyFiles = files.filter(file =>
                        file.includes('emergency_creds_') &&
                        !file.includes(this.sessionId)
                    );

                    // If we have more than 3 emergency files, remove the oldest ones
                    if (emergencyFiles.length > 3) {
                        // Sort by timestamp
                        emergencyFiles.sort();

                        // Remove the oldest files, keeping only the 3 newest
                        for (let i = 0; i < emergencyFiles.length - 3; i++) {
                            const fileToRemove = path.join(this.sessionsDir, emergencyFiles[i]);
                            await fs.unlink(fileToRemove);
                            logger.debug(`Removed old emergency file: ${emergencyFiles[i]}`);
                        }
                    }
                } catch (cleanupErr) {
                    logger.warn('Error during emergency file cleanup:', cleanupErr);
                }
            }

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


    // Helper to get consistent backup paths based on session ID
    _getBackupPath(type = 'standard') {
        switch (type) {
            case 'emergency':
                return path.join(this.sessionsDir, `${this.sessionId}_emergency.json`);
            case 'timestamp':
                return path.join(this.sessionsDir, `${this.sessionId}_backup_${Date.now()}.json`);
            case 'standard':
            default:
                return path.join(this.sessionsDir, `${this.sessionId}_backup.json`);
        }
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
            const checksum = crypto
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
            await this.saveSession(this.sessionId + "_backup", credentials);

            logger.info(`Credentials backup saved successfully. Timestamp: ${data.timestamp}`);
            return true;
        } catch (err) {
            logger.error('Error in handleCredentialsBackup:', err);
            return false;
        }
    }

    async restoreFromBackup() {
        try {
            let backup = null;

            // Try standard backup first
            try {
                const standardBackupPath = this._getBackupPath('standard');
                logger.info(`Attempting to restore from standard backup: ${standardBackupPath}`);
                const backupData = await fs.readFile(standardBackupPath, 'utf8');
                backup = JSON.parse(backupData);
                logger.info(`Found standard backup for session: ${this.sessionId}`);
            } catch (standardErr) {
                logger.warn(`No standard backup found for session: ${this.sessionId}`);

                // Try emergency backup
                try {
                    const emergencyPath = this._getBackupPath('emergency');
                    logger.info(`Attempting to restore from emergency backup: ${emergencyPath}`);
                    const emergencyData = await fs.readFile(emergencyPath, 'utf8');
                    backup = JSON.parse(emergencyData);
                    logger.info(`Restored from emergency backup for session: ${this.sessionId}`);
                } catch (emergencyErr) {
                    logger.warn('No emergency backup found either');
                }
            }

            // If no specific backup found, try the regular session
            if (!backup) {
                try {
                    backup = await this.loadSession(this.sessionId);
                    if (backup) {
                        logger.info(`Restored from regular session data for: ${this.sessionId}`);
                    }
                } catch (legacyErr) {
                    logger.warn('No regular session data found');
                }
            }

            // If still no backup, try to find any backup file with our session ID
            if (!backup) {
                try {
                    const files = await fs.readdir(this.sessionsDir);
                    const backupFiles = files.filter(file =>
                        (file.includes('backup') || file.includes('emergency')) &&
                        file.includes(this.sessionId)
                    );

                    if (backupFiles.length > 0) {
                        // Sort by timestamp (newest first)
                        backupFiles.sort().reverse();
                        const latestBackup = path.join(this.sessionsDir, backupFiles[0]);
                        const backupData = await fs.readFile(latestBackup, 'utf8');
                        backup = JSON.parse(backupData);
                        logger.info(`Restored from latest available backup: ${backupFiles[0]}`);
                    } else {
                        // If still nothing, try any backup file
                        const anyBackupFiles = files.filter(file =>
                            file.includes('backup') || file.includes('emergency')
                        );

                        if (anyBackupFiles.length > 0) {
                            // Sort by timestamp (newest first)
                            anyBackupFiles.sort().reverse();
                            const latestAnyBackup = path.join(this.sessionsDir, anyBackupFiles[0]);
                            const anyBackupData = await fs.readFile(latestAnyBackup, 'utf8');
                            backup = JSON.parse(anyBackupData);
                            logger.info(`Restored from latest available backup (any session): ${anyBackupFiles[0]}`);
                        }
                    }
                } catch (anyErr) {
                    logger.error('Error searching for backup files:', anyErr);
                }
            }

            if (!backup) {
                logger.warn('No backup found, will need to generate new QR code');
                return false;
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

module.exports = SessionManager;