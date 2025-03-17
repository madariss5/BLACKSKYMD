/**
 * Session Handler
 * Manages WhatsApp sessions, authentication, and persistent connections
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

class SessionHandler {
    constructor(config = {}) {
        this.config = {
            sessionsDir: './sessions',
            backupDir: './session_backups',
            backupInterval: 6 * 60 * 60 * 1000, // 6 hours
            maxBackups: 5,
            ...config
        };

        this.sessions = new Map();
        this.setupDirectories();
        this.startBackupInterval();
    }

    setupDirectories() {
        [this.config.sessionsDir, this.config.backupDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    async createSession(sessionId, options = {}) {
        try {
            const sessionPath = path.join(this.config.sessionsDir, `${sessionId}.json`);
            
            // Generate unique authentication data
            const authData = {
                id: sessionId,
                created: Date.now(),
                authKey: crypto.randomBytes(32).toString('hex'),
                ...options
            };

            // Save session data
            fs.writeFileSync(sessionPath, JSON.stringify(authData, null, 2));
            this.sessions.set(sessionId, authData);

            logger.info(`Created new session: ${sessionId}`);
            return authData;

        } catch (error) {
            logger.error(`Error creating session ${sessionId}:`, error);
            throw error;
        }
    }

    async loadSession(sessionId) {
        try {
            const sessionPath = path.join(this.config.sessionsDir, `${sessionId}.json`);
            
            if (!fs.existsSync(sessionPath)) {
                logger.warn(`Session ${sessionId} not found`);
                return null;
            }

            const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
            this.sessions.set(sessionId, sessionData);

            logger.info(`Loaded session: ${sessionId}`);
            return sessionData;

        } catch (error) {
            logger.error(`Error loading session ${sessionId}:`, error);
            throw error;
        }
    }

    async updateSession(sessionId, updates) {
        try {
            const sessionPath = path.join(this.config.sessionsDir, `${sessionId}.json`);
            
            if (!this.sessions.has(sessionId)) {
                throw new Error(`Session ${sessionId} not found`);
            }

            const currentData = this.sessions.get(sessionId);
            const updatedData = {
                ...currentData,
                ...updates,
                lastUpdated: Date.now()
            };

            fs.writeFileSync(sessionPath, JSON.stringify(updatedData, null, 2));
            this.sessions.set(sessionId, updatedData);

            logger.info(`Updated session: ${sessionId}`);
            return updatedData;

        } catch (error) {
            logger.error(`Error updating session ${sessionId}:`, error);
            throw error;
        }
    }

    async deleteSession(sessionId) {
        try {
            const sessionPath = path.join(this.config.sessionsDir, `${sessionId}.json`);
            
            if (fs.existsSync(sessionPath)) {
                fs.unlinkSync(sessionPath);
            }

            this.sessions.delete(sessionId);
            logger.info(`Deleted session: ${sessionId}`);

        } catch (error) {
            logger.error(`Error deleting session ${sessionId}:`, error);
            throw error;
        }
    }

    async backupSessions() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(this.config.backupDir, `backup_${timestamp}`);
            
            fs.mkdirSync(backupPath);

            // Copy all session files
            const sessionFiles = fs.readdirSync(this.config.sessionsDir);
            for (const file of sessionFiles) {
                fs.copyFileSync(
                    path.join(this.config.sessionsDir, file),
                    path.join(backupPath, file)
                );
            }

            // Cleanup old backups
            this.cleanupOldBackups();

            logger.info(`Created session backup: ${timestamp}`);

        } catch (error) {
            logger.error('Error creating session backup:', error);
        }
    }

    cleanupOldBackups() {
        try {
            const backups = fs.readdirSync(this.config.backupDir)
                .filter(dir => dir.startsWith('backup_'))
                .map(dir => ({
                    name: dir,
                    time: fs.statSync(path.join(this.config.backupDir, dir)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time);

            // Remove excess backups
            if (backups.length > this.config.maxBackups) {
                backups.slice(this.config.maxBackups).forEach(backup => {
                    fs.rmSync(path.join(this.config.backupDir, backup.name), { recursive: true });
                    logger.info(`Removed old backup: ${backup.name}`);
                });
            }

        } catch (error) {
            logger.error('Error cleaning up old backups:', error);
        }
    }

    startBackupInterval() {
        setInterval(() => this.backupSessions(), this.config.backupInterval);
    }

    getActiveSessions() {
        return Array.from(this.sessions.entries()).map(([id, data]) => ({
            id,
            created: new Date(data.created).toISOString(),
            lastUpdated: data.lastUpdated ? new Date(data.lastUpdated).toISOString() : null
        }));
    }
}

module.exports = SessionHandler;
