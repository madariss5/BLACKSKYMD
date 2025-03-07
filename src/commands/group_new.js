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
            logger.moduleInit('Group Extended');

            // Check core dependencies first
            const coreDeps = {
                isAdmin,
                isBotAdmin,
                path,
                logger,
                fs: fs.promises
            };

            for (const [name, dep] of Object.entries(coreDeps)) {
                if (!dep) {
                    logger.error(`❌ Core extended group dependency '${name}' is not initialized`);
                    return false;
                }
                logger.info(`✓ Core extended group dependency '${name}' verified`);
            }

            // Check optional dependencies
            const optionalDeps = {
                downloadMediaMessage
            };

            for (const [name, dep] of Object.entries(optionalDeps)) {
                if (!dep) {
                    logger.warn(`⚠️ Optional extended group dependency '${name}' is not available`);
                } else {
                    logger.info(`✓ Optional extended group dependency '${name}' verified`);
                }
            }

            // Ensure required directories exist
            const dataDir = path.join(__dirname, '../../data/groups_extended');
            try {
                await fs.mkdir(dataDir, { recursive: true });
                const stats = await fs.stat(dataDir);
                if (!stats.isDirectory()) {
                    throw new Error('Path exists but is not a directory');
                }
                logger.info(`✓ Directory verified: ${dataDir}`);
            } catch (err) {
                logger.error(`❌ Directory creation failed for ${dataDir}:`, err);
                return false;
            }

            // Initialize settings storage
            const groupSettings = new Map();
            logger.info('✓ Extended group settings map initialized');

            logger.moduleSuccess('Group Extended');
            return true;
        } catch (err) {
            logger.moduleError('Group Extended', err);
            return false;
        }
    }
};