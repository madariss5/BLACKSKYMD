const logger = require('../utils/logger');

// Import all command modules
const ownerCommands = require('./owner');
const groupCommands = require('./group');
const groupNewCommands = require('./group_new');
const userCommands = require('./user');
const basicCommands = require('./basic');
const funCommands = require('./fun');
const mediaCommands = require('./media');
const educationalCommands = require('./educational');
const nsfwCommands = require('./nsfw');
const reactionCommands = require('./reactions');
const utilityCommands = require('./utility');
const menuCommands = require('./menu'); // Added menu commands

// Initialize modules in the correct order
async function initializeModules() {
    logger.info('🔄 Starting command module initialization...');

    const modules = [
        { name: 'Basic', module: basicCommands },
        { name: 'Owner', module: ownerCommands },
        { name: 'Group Base', module: groupCommands },
        { name: 'Group Extended', module: groupNewCommands },
        { name: 'User', module: userCommands },
        { name: 'Fun', module: funCommands },
        { name: 'Media', module: mediaCommands },
        { name: 'Educational', module: educationalCommands },
        { name: 'NSFW', module: nsfwCommands },
        { name: 'Reactions', module: reactionCommands },
        { name: 'Utility', module: utilityCommands },
        { name: 'Menu', module: menuCommands }
    ];

    // Initialize each module
    for (const { name, module } of modules) {
        try {
            if (module && typeof module.init === 'function') {
                const success = await module.init();
                if (!success) {
                    logger.error(`❌ Failed to initialize ${name} module`);
                }
            }
        } catch (err) {
            logger.error(`❌ Error initializing ${name} module:`, err);
        }
    }
}

// Helper function to safely load commands
function loadCommandsFromModule(module, name) {
    try {
        if (module && module.commands) {
            logger.info(`✓ Successfully loaded ${name} commands`);
            return module.commands;
        } else if (typeof module === 'object') {
            logger.info(`✓ Successfully loaded ${name} commands (legacy format)`);
            return module;
        }
        logger.warn(`⚠️ Invalid module format for ${name}`);
        return {};
    } catch (err) {
        logger.error(`❌ Error loading ${name} commands:`, err);
        return {};
    }
}

// Initialize all modules
initializeModules().catch(err => {
    logger.error('❌ Fatal error during module initialization:', err);
});

// Combine all commands with proper error handling
const commands = {
    // Basic commands
    ...loadCommandsFromModule(basicCommands, 'basic'),

    // Owner commands
    ...loadCommandsFromModule(ownerCommands, 'owner'),

    // Group commands - both base and extended
    ...loadCommandsFromModule(groupCommands, 'group_base'),
    ...loadCommandsFromModule(groupNewCommands, 'group_extended'),

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
    ...loadCommandsFromModule(utilityCommands, 'utility'),
    
    // Menu commands
    ...loadCommandsFromModule(menuCommands, 'menu')
};

// Log total number of commands loaded
const commandCount = Object.keys(commands).length;
logger.info(`\n✅ Total commands loaded: ${commandCount}`);

module.exports = commands;