/**
 * Command Registry
 * Manages loading, registration and execution of command modules
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const moduleAdapter = require('../utils/moduleAdapter');

class CommandRegistry {
    constructor() {
        this.commands = new Map();
        this.modules = new Map();
        this.initialized = false;
        this.categories = new Set();
    }

    /**
     * Initialize the command registry
     * @returns {Promise<boolean>} Whether initialization was successful
     */
    async initialize() {
        try {
            await this.loadCommandModules();
            this.initialized = true;
            logger.info(`Command registry initialized with ${this.commands.size} commands in ${this.categories.size} categories`);
            return true;
        } catch (error) {
            logger.error('Failed to initialize command registry:', error);
            return false;
        }
    }

    /**
     * Load all command modules from the commands directory
     */
    async loadCommandModules() {
        const commandsDir = path.join(__dirname, '../commands');
        
        if (!fs.existsSync(commandsDir)) {
            logger.warn(`Commands directory not found: ${commandsDir}`);
            fs.mkdirSync(commandsDir, { recursive: true });
            return;
        }

        const commandFiles = fs.readdirSync(commandsDir)
            .filter(file => file.endsWith('.js'));

        logger.info(`Found ${commandFiles.length} command files to load`);

        for (const file of commandFiles) {
            const filePath = path.join(commandsDir, file);
            await this.loadCommandModule(filePath);
        }
    }

    /**
     * Load a single command module
     * @param {string} filePath Path to the command module
     */
    async loadCommandModule(filePath) {
        try {
            const module = await moduleAdapter.loadModuleWithDependencies(filePath);
            
            if (!module) {
                logger.warn(`Failed to load module: ${filePath}`);
                return;
            }
            
            const moduleName = path.basename(filePath, '.js');
            this.registerModule(moduleName, module);
            
            logger.info(`Successfully loaded module: ${moduleName}`);
        } catch (error) {
            logger.error(`Error loading command module ${filePath}:`, error);
        }
    }

    /**
     * Register a module and its commands
     * @param {string} moduleName Name of the module
     * @param {Object} module The module object
     */
    registerModule(moduleName, module) {
        if (!module || !module.commands) {
            logger.warn(`Module ${moduleName} has no commands property`);
            return;
        }

        this.modules.set(moduleName, module);
        this.categories.add(module.category || moduleName);

        for (const [cmdName, cmdFunction] of Object.entries(module.commands)) {
            if (typeof cmdFunction !== 'function') {
                continue;
            }
            this.commands.set(cmdName, {
                execute: cmdFunction,
                module: moduleName,
                category: module.category || moduleName
            });
        }
    }

    /**
     * Get a command by name
     * @param {string} commandName Name of the command
     * @returns {Object|null} Command object or null if not found
     */
    getCommand(commandName) {
        return this.commands.get(commandName) || null;
    }

    /**
     * Execute a command
     * @param {string} commandName Name of the command to execute
     * @param {Object} sock The WhatsApp socket
     * @param {Object} message The message object
     * @param {Array} args Command arguments
     * @returns {Promise<any>} Result of command execution
     */
    async executeCommand(commandName, sock, message, args) {
        const command = this.getCommand(commandName);
        
        if (!command) {
            logger.warn(`Command not found: ${commandName}`);
            return { error: 'Command not found' };
        }
        
        try {
            logger.info(`Executing command: ${commandName}`);
            return await command.execute(sock, message, args);
        } catch (error) {
            logger.error(`Error executing command ${commandName}:`, error);
            return { error: error.message || 'Unknown error' };
        }
    }

    /**
     * Get all available commands
     * @returns {Map<string, Object>} Map of command names to command objects
     */
    getAllCommands() {
        return this.commands;
    }

    /**
     * Get commands by category
     * @param {string} category Category name
     * @returns {Array<string>} Array of command names in that category
     */
    getCommandsByCategory(category) {
        const categoryCommands = [];
        
        for (const [cmdName, cmd] of this.commands.entries()) {
            if (cmd.category === category) {
                categoryCommands.push(cmdName);
            }
        }
        
        return categoryCommands;
    }

    /**
     * Get all categories
     * @returns {Array<string>} Array of category names
     */
    getAllCategories() {
        return [...this.categories];
    }

    /**
     * Get statistics about loaded commands
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            totalCommands: this.commands.size,
            totalModules: this.modules.size,
            categories: this.getAllCategories(),
            commandsPerCategory: this.getAllCategories().map(category => ({
                category,
                commands: this.getCommandsByCategory(category).length
            }))
        };
    }
}

module.exports = new CommandRegistry();