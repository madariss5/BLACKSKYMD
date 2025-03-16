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

                // Send backup to the bot itself
                try {
                    // Convert credentials to base64 and add checksum for verification
                    const encodedCreds = Buffer.from(credsData).toString('base64');
                    const checksum = crypto
                        .createHash('sha256')
                        .update(credsData)
                        .digest('hex');

                    // Create backup message with metadata
                    const backupMessage = {
                        type: 'BOT_CREDENTIALS_BACKUP',
                        timestamp: Date.now(),
                        sessionId: this.sessionId,
                        data: encodedCreds,
                        checksum: checksum
                    };

                    // Send to bot's own number if available
                    if (process.env.OWNER_NUMBER) {
                        const ownerJid = `${process.env.OWNER_NUMBER}@s.whatsapp.net`;
                        await this.sock.sendMessage(ownerJid, { 
                            text: JSON.stringify(backupMessage, null, 2)
                        });
                        logger.info('Credentials backup sent to bot owner');
                    }
                } catch (backupErr) {
                    logger.error('Failed to send credentials backup:', backupErr);
                }

                // Limit the number of backup files
                try {
                    const files = await fs.readdir(this.sessionsDir);
                    const backupFiles = files.filter(file =>
                        file.includes('backup') &&
                        file.includes(this.sessionId) &&
                        file.includes('_backup_')
                    );

                    // Keep only the 5 newest backups
                    if (backupFiles.length > 5) {
                        backupFiles.sort();
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

    async handleCredentialsBackup(message, sock) {
        try {
            this.sock = sock; // Store sock instance for future use

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

            // Parse the decoded credentials
            const credentials = JSON.parse(decodedCreds);

            // Save backup with timestamp
            await this.saveSession(this.sessionId + "_backup", credentials);

            logger.info(`Credentials backup saved successfully. Timestamp: ${data.timestamp}`);
            return true;
        } catch (err) {
            logger.error('Error in handleCredentialsBackup:', err);
            return false;
        }
    }

    async sendCredentialsToSelf() {
        try {
            if (!this.sock) {
                logger.error('Socket connection not available for sending credentials');
                return false;
            }

            // Read current credentials
            const credsData = await fs.readFile(this.credentialsFile, 'utf8');
            if (!credsData) {
                logger.error('No credentials data found');
                return false;
            }

            // Convert to base64 and create checksum
            const encodedCreds = Buffer.from(credsData).toString('base64');
            const checksum = crypto
                .createHash('sha256')
                .update(credsData)
                .digest('hex');

            // Create backup message
            const backupMessage = {
                type: 'BOT_CREDENTIALS_BACKUP',
                timestamp: Date.now(),
                sessionId: this.sessionId,
                data: encodedCreds,
                checksum: checksum
            };

            // Get bot's own number from the socket
            if (!this.sock.user?.id) {
                logger.error('Bot user ID not available');
                return false;
            }

            // Extract bot's number and create JID
            const botNumber = this.sock.user.id.split(':')[0];
            const botJid = `${botNumber}@s.whatsapp.net`;

            // Send to self
            await this.sock.sendMessage(botJid, { 
                text: JSON.stringify(backupMessage, null, 2)
            });

            logger.info('Successfully sent credentials backup to self');
            return true;
        } catch (err) {
            logger.error('Error sending credentials to self:', err);
            return false;
        }
    }

    async restoreFromBackup() {
        try {
            let backup = null;
            const additionalBackupDirs = [
                './auth_info_baileys_backup',
                './data/session_backups',
                './auth_info_baileys',
                './auth_info_baileys_qr',
                './auth_info_simple_pairing'
            ];
            
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
            
            // Try additional backup directories
            if (!backup) {
                for (const backupDir of additionalBackupDirs) {
                    try {
                        // Ensure directory exists
                        await fs.mkdir(backupDir, { recursive: true });
                        
                        // Check for creds.json or latest backup
                        const possiblePaths = [
                            path.join(backupDir, 'creds.json'),
                            path.join(backupDir, 'latest_creds.json'),
                            path.join(backupDir, `${this.sessionId}_creds.json`)
                        ];
                        
                        for (const possiblePath of possiblePaths) {
                            try {
                                const data = await fs.readFile(possiblePath, 'utf8');
                                backup = JSON.parse(data);
                                logger.info(`Found backup in alternative location: ${possiblePath}`);
                                break;
                            } catch (err) {
                                // Continue to next path
                            }
                        }
                        
                        if (backup) break; // Exit the directory loop if we found a backup
                        
                        // Try to find any JSON file in the directory
                        const files = await fs.readdir(backupDir);
                        const jsonFiles = files.filter(file => 
                            file.endsWith('.json') && 
                            (file.includes('creds') || file.includes('backup') || file.includes('session'))
                        );
                        
                        if (jsonFiles.length > 0) {
                            // Try the newest file
                            jsonFiles.sort().reverse();
                            const latestFile = path.join(backupDir, jsonFiles[0]);
                            const jsonData = await fs.readFile(latestFile, 'utf8');
                            backup = JSON.parse(jsonData);
                            logger.info(`Restored from alternative backup location: ${latestFile}`);
                            break;
                        }
                    } catch (dirErr) {
                        // Continue to next directory
                    }
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
            
            // Also save to multiple locations for redundancy
            for (const backupDir of additionalBackupDirs) {
                try {
                    await fs.mkdir(backupDir, { recursive: true });
                    await fs.writeFile(
                        path.join(backupDir, 'latest_creds.json'),
                        JSON.stringify(backup),
                        'utf8'
                    );
                } catch (writeErr) {
                    // Continue if we can't write to this location
                }
            }

            logger.info('Credentials restored from backup successfully');
            return true;
        } catch (err) {
            logger.error('Error restoring credentials:', err);
            return false;
        }
    }
}

module.exports = {
    SessionManager,
    sendCredentialsToSelf
};