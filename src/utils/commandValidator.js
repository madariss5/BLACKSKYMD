const logger = require('./logger');

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

module.exports = {
    validateGroupCommands
};