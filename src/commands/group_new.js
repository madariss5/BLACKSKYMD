const logger = require('../utils/logger');
const { isAdmin, isBotAdmin } = require('../utils/permissions');
const { downloadMediaMessage } = require('../utils/helpers');
const path = require('path');
const fs = require('fs').promises;

// Helper functions can go here
function parseDuration(str) {
    const match = str.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return null;

    const num = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 's': return num;
        case 'm': return num * 60;
        case 'h': return num * 60 * 60;
        case 'd': return num * 24 * 60 * 60;
        default: return null;
    }
}

function formatDuration(seconds) {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
}

// Group command handlers (empty for now, to be implemented)
const groupCommands = {};

module.exports = {
    commands: groupCommands,
    category: 'group_new',
    async init() {
        try {
            logger.info('Initializing group_new command handler...');

            // Verify required modules with better error handling
            const requiredDeps = {
                isAdmin: isAdmin,
                isBotAdmin: isBotAdmin,
                downloadMediaMessage: downloadMediaMessage,
                fs: fs.promises,
                path: path,
                logger: logger
            };

            for (const [name, dep] of Object.entries(requiredDeps)) {
                if (!dep) {
                    logger.error(`Missing dependency: ${name}`);
                    throw new Error(`Required dependency '${name}' is not initialized`);
                }
            }

            // Create necessary directories with error handling
            const dataDir = path.join(__dirname, '../../data/groups');
            try {
                await fs.mkdir(dataDir, { recursive: true });
                logger.info(`Created directory: ${dataDir}`);
            } catch (err) {
                logger.error(`Failed to create directory ${dataDir}:`, err);
                throw err;
            }

            // Initialize settings storage
            const groupSettings = new Map();

            logger.info('Group_new command handler initialized successfully');
            return true;
        } catch (err) {
            logger.error('Error initializing group_new command handler:', err.message);
            logger.error('Stack trace:', err.stack);
            throw err;
        }
    }
};