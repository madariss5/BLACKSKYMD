const logger = require('../utils/logger');
const { isAdmin, isBotAdmin } = require('../utils/permissions');
const { downloadMediaMessage } = require('../utils/helpers');
const path = require('path');
const fs = require('fs').promises;

// Group command handlers (empty for now, to be implemented)
const groupNewCommands = {};

module.exports = {
    commands: groupNewCommands,
    category: 'group_extended',  // Different category to avoid conflict
    async init() {
        try {
            logger.info('Initializing extended group command handler...');

            // Verify required modules
            const requiredDeps = {
                isAdmin,
                isBotAdmin,
                downloadMediaMessage,
                path,
                logger
            };

            // Check dependencies
            for (const [name, dep] of Object.entries(requiredDeps)) {
                if (!dep) {
                    logger.error(`Missing extended group dependency: ${name}`);
                    throw new Error(`Required extended group dependency '${name}' is not initialized`);
                }
            }

            // Create necessary directories
            const dataDir = path.join(__dirname, '../../data/groups_extended');
            try {
                await fs.mkdir(dataDir, { recursive: true });
                logger.info(`Created directory: ${dataDir}`);
            } catch (err) {
                logger.error(`Failed to create directory ${dataDir}:`, err);
                throw err;
            }

            // Initialize settings storage
            const groupSettings = new Map();

            logger.info('Extended group command handler initialized successfully');
            return true;
        } catch (err) {
            logger.error('Error initializing extended group command handler:', err.message);
            logger.error('Stack trace:', err.stack);
            return false; // Return false instead of throwing to allow other modules to load
        }
    }
};