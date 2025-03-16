/**
 * Command Module Adapter
 * 
 * This utility helps standardize command modules with different formats
 * to ensure consistent usage throughout the application.
 */

// Load logger if available
let logger;
try {
    logger = require('./logger');
} catch (err) {
    // Fallback to console if logger isn't available
    logger = {
        info: console.log,
        error: console.error,
        warn: console.warn,
        debug: console.log
    };
}

/**
 * Standardize command module to the modern format
 * @param {Object} module - The command module to standardize
 * @param {string} moduleName - Name of the module (for logging)
 * @returns {Object} - Standardized module with commands property
 */
function standardizeCommandModule(module, moduleName) {
    if (!module) {
        logger.warn(`Module ${moduleName} is undefined or null`);
        return { commands: {}, category: moduleName };
    }
    
    // If already in standard format, return as is
    if (module.commands && typeof module.commands === 'object') {
        return module;
    }
    
    // Create a standardized version of the module
    const standardized = {
        commands: {},
        category: module.category || moduleName
    };
    
    // Handle older module formats where commands are directly on the module
    Object.keys(module).forEach(key => {
        if (typeof module[key] === 'function' && key !== 'init') {
            standardized.commands[key] = module[key];
        }
    });
    
    // Copy init function if it exists
    if (typeof module.init === 'function') {
        standardized.init = module.init;
    }
    
    logger.info(`Standardized module ${moduleName} (${Object.keys(standardized.commands).length} commands)`);
    return standardized;
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
    return Object.keys(commands).filter(key => typeof commands[key] === 'function').length;
}

module.exports = {
    standardizeCommandModule,
    extractCommands,
    countCommands
};