const logger = require('../utils/logger');

// Import all command modules
const ownerCommands = require('./owner');
const groupCommands = require('./group');
const userCommands = require('./user');
const basicCommands = require('./basic');
const funCommands = require('./fun');
const mediaCommands = require('./media');
const educationalCommands = require('./educational');
const nsfwCommands = require('./nsfw');
const reactionCommands = require('./reactions');
const utilityCommands = require('./utility');

// Log module loading attempts
logger.info('\nLoading command modules...');

// Helper function to safely load commands
function loadCommandsFromModule(module, name) {
    try {
        if (module && module.commands) {
            logger.info(`✅ Successfully loaded ${name} module`);
            return module.commands;
        } else if (typeof module === 'object') {
            logger.info(`✅ Successfully loaded ${name} module (legacy format)`);
            return module;
        }
        logger.warn(`⚠️ Invalid module format for ${name}`);
        return {};
    } catch (err) {
        logger.error(`❌ Error loading ${name} module:`, err);
        return {};
    }
}

// Combine all commands with proper error handling
const commands = {
    // Basic commands
    ...loadCommandsFromModule(basicCommands, 'basic'),

    // Owner commands
    ...loadCommandsFromModule(ownerCommands, 'owner'),

    // Group commands
    ...loadCommandsFromModule(groupCommands, 'group'),

    // User commands
    ...loadCommandsFromModule(userCommands, 'user'),

    // Fun commands
    ...loadCommandsFromModule(funCommands, 'fun'),

    // Media commands
    ...loadCommandsFromModule(mediaCommands, 'media'),

    // Educational commands
    ...loadCommandsFromModule(educationalCommands, 'educational'),

    // NSFW commands
    ...loadCommandsFromModule(nsfwCommands, 'nsfw'),

    // Reaction commands
    ...loadCommandsFromModule(reactionCommands, 'reactions'),

    // Utility commands
    ...loadCommandsFromModule(utilityCommands, 'utility')
};

// Log total number of commands loaded
const commandCount = Object.keys(commands).length;
logger.info(`\nTotal commands loaded: ${commandCount}`);

module.exports = commands;