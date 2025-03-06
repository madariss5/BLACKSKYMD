const fs = require('fs').promises;
const logger = require('./logger');

class SessionManager {
    constructor() {
        this.sessionsDir = './sessions';
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
}

const sessionManager = new SessionManager();
module.exports = { sessionManager };
