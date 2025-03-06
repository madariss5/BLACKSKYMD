const fs = require('fs').promises;
const logger = require('./logger');

class SessionManager {
    constructor() {
        this.sessionsDir = './sessions';
        this.credentialsFile = 'auth_info/creds.json';
        this.backupSessionID = 'session-backup';
    }

    async saveSession(id, data) {
        try {
            await fs.mkdir(this.sessionsDir, { recursive: true });
            await fs.writeFile(
                `${this.sessionsDir}/${id}.json`,
                JSON.stringify(data),
                'utf8'
            );
        } catch (err) {
            logger.error('Error saving session:', err);
            throw err;
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
            logger.error('Error loading session:', err);
            return null;
        }
    }

    async backupCredentials(sock) {
        try {
            // Verify sock and user exist
            if (!sock?.user?.id) {
                logger.warn('Cannot backup: socket or user ID not available');
                return false;
            }

            logger.info('Starting credentials backup process...');

            // Read and verify the credentials file exists
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
                data: Buffer.from(JSON.stringify(creds)).toString('base64'),
                checksum: require('crypto')
                    .createHash('sha256')
                    .update(credsData)
                    .digest('hex'),
                version: '1.0.0',
                platform: 'heroku'
            };

            // Format bot's own number correctly
            const botNumber = sock.user.id.split(':')[0];
            const formattedNumber = `${botNumber}@s.whatsapp.net`;

            logger.info(`Attempting to send backup to: ${formattedNumber}`);

            // Send backup to self with enhanced metadata
            await sock.sendMessage(formattedNumber, {
                text: JSON.stringify(backupMessage),
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

    // Add helper function to check file existence
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    // Update handleCredentialsBackup with better error handling
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

            // Parse the decoded credentials
            const credentials = JSON.parse(decodedCreds);

            // Save backup with timestamp
            const backupPath = `${this.sessionsDir}/${this.backupSessionID}_${Date.now()}.json`;
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

            // Write back to credentials file
            await fs.writeFile(
                this.credentialsFile,
                JSON.stringify(backup, null, 2),
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
        // Initial backup
        await this.backupCredentials(sock);

        // Schedule regular backups every 6 hours
        setInterval(async () => {
            const success = await this.backupCredentials(sock);
            if (!success) {
                logger.warn('Scheduled backup failed, will retry in next interval');
            }
        }, 6 * 60 * 60 * 1000); // 6 hours

        logger.info('Backup schedule created successfully');
    }
}

const sessionManager = new SessionManager();
module.exports = { sessionManager };