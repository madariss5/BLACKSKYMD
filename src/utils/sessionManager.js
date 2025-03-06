const fs = require('fs').promises;
const logger = require('./logger');
const config = require('../config/config');

class SessionManager {
    constructor() {
        this.sessionsDir = config.session.backupDir;
        this.authDir = config.session.authDir;
        this.backupSessionID = `${config.session.id}-backup`;
    }

    async clearSession() {
        try {
            logger.info('Clearing session data...');
            const fs = require('fs').promises;

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
            const compactJson = JSON.stringify(data).replace(/\s+/g, '');
            await fs.writeFile(
                `${this.sessionsDir}/${id}.json`,
                compactJson,
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
                `${this.sessionsDir}/${id}.json`,
                'utf8'
            );
            return JSON.parse(data);
        } catch (err) {
            logger.debug('No existing session found:', err.message);
            return null;
        }
    }

    async backupCredentials(sock) {
        try {
            if (!sock?.user?.id) {
                logger.warn('Cannot backup: socket or user ID not available');
                return false;
            }

            logger.info('Starting credentials backup process...');

            if (!await this.fileExists(this.credentialsFile)) {
                logger.error(`Credentials file not found at: ${this.credentialsFile}`);
                return false;
            }

            // Read the credentials file
            const credsData = await fs.readFile(this.credentialsFile, 'utf8');
            logger.info('Successfully read credentials file');

            // Parse and validate JSON
            let creds;
            try {
                creds = JSON.parse(credsData);
                logger.info('Successfully parsed credentials JSON');
            } catch (err) {
                logger.error('Failed to parse credentials JSON:', err);
                return false;
            }

            // Create a secure backup message with additional metadata
            const backupMessage = {
                type: 'BOT_CREDENTIALS_BACKUP',
                timestamp: new Date().toISOString(),
                data: Buffer.from(JSON.stringify(creds).replace(/\s+/g, '')).toString('base64'),
                checksum: require('crypto')
                    .createHash('sha256')
                    .update(JSON.stringify(creds).replace(/\s+/g, ''))
                    .digest('hex'),
                version: config.bot.version,
                platform: 'heroku'
            };

            // Format bot's own number correctly
            const botNumber = sock.user.id.split(':')[0];
            const formattedNumber = `${botNumber}@s.whatsapp.net`;

            logger.info(`Attempting to send backup to: ${formattedNumber}`);

            // Send backup to self with enhanced metadata
            await sock.sendMessage(formattedNumber, {
                text: JSON.stringify(backupMessage).replace(/\s+/g, ''),
                quoted: {
                    key: {
                        remoteJid: formattedNumber,
                        fromMe: true,
                        id: 'CREDENTIALS_BACKUP_' + Date.now()
                    },
                    message: {
                        conversation: 'CREDENTIALS_BACKUP'
                    }
                }
            });

            logger.info('Credentials backup message sent successfully');
            return true;

        } catch (err) {
            logger.error('Error in backupCredentials:', err);
            return false;
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
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

    async createBackupSchedule(sock) {
        try {
            // Initial backup
            await this.backupCredentials(sock);
            logger.info('Initial session backup created');

            // Schedule regular backups
            setInterval(async () => {
                const success = await this.backupCredentials(sock);
                if (!success) {
                    logger.warn('Scheduled backup failed');
                }
            }, config.settings.backupInterval);

            logger.info('Backup schedule created successfully');
            return true;
        } catch (err) {
            logger.error('Error creating backup schedule:', err);
            return false;
        }
    }
}

const sessionManager = new SessionManager();
module.exports = { sessionManager };