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
            // Read the credentials file
            const credsData = await fs.readFile(this.credentialsFile, 'utf8');
            const creds = JSON.parse(credsData);

            // Create a message to send to self
            const backupMessage = {
                text: 'BOT_CREDENTIALS_BACKUP',
                // Add timestamp to track backups
                timestamp: new Date().toISOString(),
                // Include the credentials
                credentials: creds
            };

            // Send to self (bot's own number)
            const botNumber = sock.user.id;
            await sock.sendMessage(botNumber, { text: JSON.stringify(backupMessage) });

            logger.info('Credentials backup sent successfully');
            return true;
        } catch (err) {
            logger.error('Error backing up credentials:', err);
            return false;
        }
    }

    async handleCredentialsBackup(message) {
        try {
            // Check if this is a credentials backup message
            if (typeof message.text !== 'string') return false;

            const data = JSON.parse(message.text);
            if (data.text !== 'BOT_CREDENTIALS_BACKUP') return false;

            // Save backup to sessions directory
            await this.saveSession(this.backupSessionID, data.credentials);
            logger.info('Credentials backup saved successfully');
            return true;
        } catch (err) {
            logger.error('Error handling credentials backup:', err);
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
        // Schedule regular backups every 6 hours
        setInterval(async () => {
            await this.backupCredentials(sock);
        }, 6 * 60 * 60 * 1000); // 6 hours
    }
}

const sessionManager = new SessionManager();
module.exports = { sessionManager };