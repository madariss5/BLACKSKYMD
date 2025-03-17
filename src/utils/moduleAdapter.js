/**
 * Module Adapter for Command Files
 * Provides backwards compatibility for existing command modules
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Common utility modules needed by command files
const os = require('os');
const { proto } = require('@whiskeysockets/baileys');
const jidHelper = require('./jidHelper');
const languageManager = { getText: (key) => key };

// Create mock language manager if the real one doesn't exist
try {
    const langModule = require('./language');
    if (langModule && langModule.languageManager) {
        Object.assign(languageManager, langModule.languageManager);
    }
} catch (err) {
    logger.warn('Could not load language manager, using fallback');
}

/**
 * Load a command module with error handling and dependency injection
 * @param {string} filePath - Path to the command module
 * @returns {Object|null} - The loaded module or null if it failed
 */
function loadCommandModule(filePath) {
    try {
        // Clear module from cache to ensure fresh load
        delete require.cache[require.resolve(filePath)];
        
        // Load the module
        const module = require(filePath);
        return module;
    } catch (err) {
        // Special handling for common errors
        if (err.code === 'MODULE_NOT_FOUND') {
            const missingModule = (err.message.match(/Cannot find module '([^']+)'/) || [])[1];
            logger.error(`Module not found while loading ${filePath}: ${missingModule}`);
            
            // Create a lightweight mock module to avoid breaking the system
            if (path.basename(filePath) === 'basic.js') {
                logger.info('Creating basic command module mock for compatibility');
                return createBasicCommandMock();
            }
            
            // For other modules, return a minimal mock
            return createMinimalMock(path.basename(filePath, '.js'));
        } else {
            logger.error(`Error loading command module ${filePath}:`, err);
            return null;
        }
    }
}

/**
 * Create a basic command module mock for compatibility
 * @returns {Object} - Mock basic command module
 */
function createBasicCommandMock() {
    return {
        commands: {
            ping: async (sock, message) => {
                await jidHelper.safeSendText(sock, message.key.remoteJid, 'Pong! Bot is running.');
            },
            help: async (sock, message) => {
                await jidHelper.safeSendText(sock, message.key.remoteJid, 'Commands help: Use .menu to see available commands.');
            }
        },
        category: 'basic',
        async init() {
            logger.info('Basic command mock initialized successfully');
            return true;
        }
    };
}

/**
 * Create a minimal mock module with the given category
 * @param {string} category - The module category
 * @returns {Object} - Mock module
 */
function createMinimalMock(category) {
    return {
        commands: {},
        category,
        async init() {
            logger.info(`Mock ${category} command module initialized`);
            return true;
        }
    };
}

/**
 * Check if a module has a valid command structure
 * @param {Object} module - The module to check
 * @returns {boolean} - Whether it's a valid command module
 */
function isValidCommandModule(module) {
    return module && 
           (module.commands || 
            (typeof module === 'object' && Object.values(module).some(v => typeof v === 'function')));
}

/**
 * Convert a legacy module to the standard command format
 * @param {Object} module - The module to convert
 * @param {string} category - The module category
 * @returns {Object} - Converted module
 */
function convertLegacyModule(module, category) {
    if (module.commands) {
        return module;
    }
    
    const commands = {};
    
    for (const [key, value] of Object.entries(module)) {
        if (typeof value === 'function' && !key.startsWith('_') && key !== 'init') {
            commands[key] = value;
        }
    }
    
    return {
        commands,
        category,
        init: module.init || (async () => true)
    };
}

/**
 * Load module with dependency injection
 * @param {string} filePath - Path to module file
 * @returns {Promise<Object|null>} - Loaded module or null
 */
async function loadModuleWithDependencies(filePath) {
    try {
        // First try direct loading
        const module = loadCommandModule(filePath);
        
        if (!module) {
            return null;
        }
        
        const category = path.basename(filePath, '.js');
        
        // Standarize the module format
        const standardizedModule = convertLegacyModule(module, category);
        
        // Initialize if needed
        if (typeof standardizedModule.init === 'function') {
            try {
                await standardizedModule.init();
            } catch (err) {
                logger.error(`Error initializing module ${filePath}:`, err);
            }
        }
        
        return standardizedModule;
    } catch (err) {
        logger.error(`Failed to load module with dependencies ${filePath}:`, err);
        return null;
    }
}

module.exports = {
    loadCommandModule,
    loadModuleWithDependencies,
    isValidCommandModule,
    convertLegacyModule
};