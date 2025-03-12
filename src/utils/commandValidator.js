const logger = require('./logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Validates a command module against its JSON configuration
 * @param {Object} module The command module to validate
 * @param {string} moduleName The name of the module
 * @param {Array} requiredCommands List of command names that must be present
 * @returns {Array} List of missing commands
 */
async function validateCommandModule(module, moduleName, requiredCommands) {
    try {
        // Skip validation if module is not available
        if (!module || !module.commands) {
            logger.warn(`⚠️ Cannot validate ${moduleName} module: module or commands property is missing`);
            return requiredCommands; // Consider all commands missing
        }
        
        const commands = module.commands;
        const missingCommands = requiredCommands.filter(cmd => !commands[cmd]);
        
        if (missingCommands.length > 0) {
            logger.warn(`⚠️ Missing ${moduleName} commands:`, missingCommands);
        } else {
            logger.info(`✓ All required ${moduleName} commands are present`);
        }
        
        return missingCommands;
    } catch (err) {
        logger.error(`❌ Error validating ${moduleName} commands:`, err);
        return requiredCommands; // Return all as missing on error
    }
}

/**
 * Load commands from JSON configuration file
 * @param {string} category The category/name of the command file
 * @returns {Promise<Array>} Array of command names
 */
async function loadCommandsFromConfig(category) {
    try {
        const configPath = path.join(__dirname, `../config/commands/${category}.json`);
        const configContent = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configContent);
        
        if (config && Array.isArray(config.commands)) {
            return config.commands.map(cmd => cmd.name);
        }
        
        return [];
    } catch (err) {
        logger.error(`❌ Error loading ${category} command config:`, err);
        return [];
    }
}

/**
 * Validates core group command functionality
 * @param {Object} sock The WhatsApp socket connection
 * @param {string} groupJid The group JID to test
 */
async function validateGroupCommands(sock, groupJid) {
    try {
        logger.info('🔍 Starting group command validation...');

        // Test group settings storage
        const settings = await require('./groupSettings').getGroupSettings(groupJid);
        logger.info('✓ Group settings loaded:', settings);

        // Verify required command handlers exist
        const commands = require('../commands/group').commands;
        const requiredCommands = [
            'kick', 'add', 'promote', 'demote', 'mute', 'unmute',
            'antispam', 'antilink', 'antitoxic', 'antiraid',
            'warn', 'removewarn', 'warnings'
        ];

        const missingCommands = requiredCommands.filter(cmd => !commands[cmd]);
        if (missingCommands.length > 0) {
            logger.warn('⚠️ Missing group commands:', missingCommands);
        } else {
            logger.info('✓ All required group commands are present');
        }

        // Verify extended commands
        const extendedCommands = require('../commands/group_new').commands;
        const requiredExtendedCommands = ['pin', 'unpin', 'pins'];

        const missingExtendedCommands = requiredExtendedCommands.filter(cmd => !extendedCommands[cmd]);
        if (missingExtendedCommands.length > 0) {
            logger.warn('⚠️ Missing extended group commands:', missingExtendedCommands);
        } else {
            logger.info('✓ All required extended group commands are present');
        }

        // Verify group settings structure
        const settingsKeys = ['warnings', 'antispam', 'antilink', 'antitoxic', 'antiraid', 'raidThreshold', 'polls', 'scheduled', 'pinnedMessages'];
        const missingKeys = settingsKeys.filter(key => !(key in settings));

        if (missingKeys.length > 0) {
            logger.warn('⚠️ Missing group settings keys:', missingKeys);
        } else {
            logger.info('✓ Group settings structure is valid');
        }

        logger.info('✅ Group command validation completed');
        return true;
    } catch (err) {
        logger.error('❌ Error during group command validation:', err);
        return false;
    }
}

/**
 * Validates media command functionality
 * @param {Object} sock The WhatsApp socket connection
 */
async function validateMediaCommands(sock) {
    try {
        logger.info('🔍 Starting media command validation...');
        
        // Load commands from config
        const requiredCommands = await loadCommandsFromConfig('media');
        
        // Validate commands
        const mediaModule = require('../commands/media');
        const missingCommands = await validateCommandModule(mediaModule, 'media', requiredCommands);
        
        if (missingCommands.length === 0) {
            // Verify dependencies
            const dependencies = ['sharp', 'ytdl-core', 'yt-search', 'node-webpmux'];
            try {
                dependencies.forEach(dep => {
                    // This will throw if dependency is not available
                    require(dep);
                    logger.info(`✓ Media dependency '${dep}' is available`);
                });
            } catch (err) {
                logger.error(`❌ Media dependency check failed:`, err);
                return false;
            }
            
            logger.info('✅ Media command validation completed successfully');
            return true;
        } else {
            logger.warn(`⚠️ Media module is missing ${missingCommands.length} commands`);
            return false;
        }
    } catch (err) {
        logger.error('❌ Error during media command validation:', err);
        return false;
    }
}

/**
 * Validates educational command functionality
 * @param {Object} sock The WhatsApp socket connection
 */
async function validateEducationalCommands(sock) {
    try {
        logger.info('🔍 Starting educational command validation...');
        
        // Load commands from config
        const requiredCommands = await loadCommandsFromConfig('educational');
        
        // Validate commands
        const educationalModule = require('../commands/educational');
        const missingCommands = await validateCommandModule(educationalModule, 'educational', requiredCommands);
        
        if (missingCommands.length === 0) {
            logger.info('✅ Educational command validation completed successfully');
            return true;
        } else {
            logger.warn(`⚠️ Educational module is missing ${missingCommands.length} commands`);
            return false;
        }
    } catch (err) {
        logger.error('❌ Error during educational command validation:', err);
        return false;
    }
}

module.exports = {
    validateGroupCommands,
    validateMediaCommands,
    validateEducationalCommands,
    validateCommandModule,
    loadCommandsFromConfig
};