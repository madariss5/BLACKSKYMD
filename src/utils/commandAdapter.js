/**
 * Command Module Adapter
 * 
 * This utility helps standardize command modules with different formats
 * to ensure consistent usage throughout the application.
 */

const logger = require('./logger');

/**
 * Standardize command module to the modern format
 * @param {Object} module - The command module to standardize
 * @param {string} moduleName - Name of the module (for logging)
 * @returns {Object} - Standardized module with commands property
 */
function standardizeCommandModule(module, moduleName) {
    if (!module) {
        logger.warn(`Null or undefined module provided for ${moduleName}`);
        return {
            commands: {},
            category: moduleName,
            init: async () => false
        };
    }

    // If already in modern format, return as is
    if (module.commands && typeof module.commands === 'object') {
        return {
            commands: module.commands,
            category: module.category || moduleName,
            init: typeof module.init === 'function' ? module.init : async () => true
        };
    }

    // Convert legacy format (direct function exports) to modern format
    if (typeof module === 'object') {
        const commands = {};
        let functionCount = 0;

        // Copy all function properties to commands object
        for (const [key, value] of Object.entries(module)) {
            if (typeof value === 'function' && key !== 'init') {
                commands[key] = value;
                functionCount++;
            }
        }

        logger.info(`Adapted legacy module ${moduleName} - found ${functionCount} commands`);

        return {
            commands,
            category: moduleName,
            init: typeof module.init === 'function' ? module.init : async () => true
        };
    }

    // Return empty module as fallback
    logger.warn(`Invalid module format for ${moduleName}`);
    return {
        commands: {},
        category: moduleName,
        init: async () => false
    };
}

/**
 * Get all commands from a standardized module
 * @param {Object} module - The command module
 * @param {string} moduleName - Name of the module
 * @returns {Object} - Object containing all commands
 */
function extractCommands(module, moduleName) {
    const standardized = standardizeCommandModule(module, moduleName);
    return standardized.commands || {};
}

/**
 * Count valid commands in a module
 * @param {Object} module - The command module
 * @param {string} moduleName - Name of the module
 * @returns {number} - Number of valid commands
 */
function countCommands(module, moduleName) {
    const commands = extractCommands(module, moduleName);
    return Object.keys(commands).filter(cmd => 
        typeof commands[cmd] === 'function' && cmd !== 'init'
    ).length;
}

module.exports = {
    standardizeCommandModule,
    extractCommands,
    countCommands
};