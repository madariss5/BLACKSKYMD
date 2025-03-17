/**
 * Command Registry
 * Centralizes command registration, discovery, and management
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { ensureDirectoryExists, listFiles } = require('../utils/fileUtils');

// Command structure constants
const COMMANDS_DIR = './src/commands';
const DEFAULT_PREFIX = '.';
const DEFAULT_COOLDOWN = 3;

class CommandRegistry {
    constructor(options = {}) {
        this.commands = new Map();
        this.aliases = new Map();
        this.categories = new Map();
        this.commandStats = {
            total: 0,
            enabled: 0,
            disabled: 0,
            byCategory: {}
        };
        this.prefix = options.prefix || process.env.BOT_PREFIX || DEFAULT_PREFIX;
        this.isInitialized = false;
        this.sourcePaths = new Map();
        this.lastReload = Date.now();
    }

    /**
     * Initialize the command registry
     */
    async initialize() {
        logger.info('Initializing command registry...');
        
        try {
            ensureDirectoryExists(COMMANDS_DIR);
            await this.loadAllCommands();
            this.isInitialized = true;
            this.updateStats();
            
            logger.info(`Command registry initialized with ${this.commandStats.total} commands`);
            logger.info(`Enabled: ${this.commandStats.enabled}, Disabled: ${this.commandStats.disabled}`);
            
            return true;
        } catch (err) {
            logger.error('Failed to initialize command registry:', err);
            return false;
        }
    }

    /**
     * Load all command modules
     */
    async loadAllCommands() {
        logger.info('Loading command modules...');
        
        try {
            // Clear existing commands
            this.commands.clear();
            this.aliases.clear();
            this.categories.clear();
            this.sourcePaths.clear();
            
            // Get all JS files
            const files = await listFiles(COMMANDS_DIR, { 
                recursive: true, 
                extensions: ['.js']
            });
            
            logger.info(`Found ${files.length} potential command files`);
            
            // Filter out non-command files like test files
            const validFiles = files.filter(file => {
                const filename = path.basename(file);
                return !filename.startsWith('_') && 
                       !filename.startsWith('.') && 
                       !filename.includes('.test.') &&
                       !filename.includes('.spec.');
            });
            
            let loadedCount = 0;
            let failedCount = 0;
            
            for (const file of validFiles) {
                try {
                    const relativePath = path.relative(process.cwd(), file);
                    logger.debug(`Loading commands from: ${relativePath}`);
                    
                    // Clear module from cache to ensure fresh load
                    delete require.cache[require.resolve(file)];
                    const module = require(file);
                    
                    // Check if this is a valid command module
                    if (!module) {
                        logger.warn(`Invalid module in ${relativePath} - module is null or undefined`);
                        failedCount++;
                        continue;
                    }
                    
                    const category = this.getCategoryFromPath(file);
                    
                    // Handle different module formats
                    if (module.commands && typeof module.commands === 'object') {
                        // Standard format
                        const moduleCommands = this.registerCommandsFromStandardModule(module, file, category);
                        loadedCount += moduleCommands;
                    } else if (typeof module === 'object' && this.hasCommandFunctions(module)) {
                        // Legacy format (direct export of command functions)
                        const legacyCommands = this.registerCommandsFromLegacyModule(module, file, category);
                        loadedCount += legacyCommands;
                    } else {
                        logger.warn(`Unrecognized module format in ${relativePath}`);
                        failedCount++;
                    }
                } catch (err) {
                    logger.error(`Error loading commands from ${file}:`, err);
                    failedCount++;
                }
            }
            
            logger.info(`Successfully loaded ${loadedCount} commands. Failed: ${failedCount}`);
            
            return loadedCount;
        } catch (err) {
            logger.error('Error loading commands:', err);
            return 0;
        }
    }
    
    /**
     * Register commands from a standard module format
     */
    registerCommandsFromStandardModule(module, filePath, category) {
        let registeredCount = 0;
        
        for (const [name, handler] of Object.entries(module.commands)) {
            // Skip special functions
            if (name === 'init' || typeof handler !== 'function') {
                continue;
            }
            
            try {
                // Create command config with defaults
                const config = {
                    name,
                    description: `${name} command`,
                    usage: `${this.prefix}${name}`,
                    category: module.category || category,
                    cooldown: DEFAULT_COOLDOWN,
                    enabled: true,
                    permissions: module.category === 'owner' ? ['owner'] : ['user'],
                    aliases: []
                };
                
                // Register the command
                this.registerCommand(name, handler, config, filePath);
                registeredCount++;
            } catch (err) {
                logger.error(`Error registering command ${name} from ${filePath}:`, err);
            }
        }
        
        return registeredCount;
    }
    
    /**
     * Register commands from a legacy module format
     */
    registerCommandsFromLegacyModule(module, filePath, category) {
        let registeredCount = 0;
        
        for (const [name, handler] of Object.entries(module)) {
            if (typeof handler !== 'function' || name === 'init') {
                continue;
            }
            
            try {
                // Create command config with defaults
                const config = {
                    name,
                    description: `${name} command`,
                    usage: `${this.prefix}${name}`,
                    category,
                    cooldown: DEFAULT_COOLDOWN,
                    enabled: true,
                    permissions: category === 'owner' ? ['owner'] : ['user'],
                    aliases: []
                };
                
                // Register the command
                this.registerCommand(name, handler, config, filePath);
                registeredCount++;
            } catch (err) {
                logger.error(`Error registering command ${name} from ${filePath}:`, err);
            }
        }
        
        return registeredCount;
    }
    
    /**
     * Register a command with the registry
     */
    registerCommand(name, handler, config, sourcePath) {
        if (!name || typeof handler !== 'function') {
            logger.error(`Invalid command registration: ${name}`);
            return false;
        }
        
        // Validate and normalize command name
        name = name.toLowerCase().trim();
        
        // Skip registration if command is already registered
        if (this.commands.has(name)) {
            logger.warn(`Command '${name}' is already registered. Skipping.`);
            return false;
        }
        
        // Register the command
        this.commands.set(name, {
            execute: handler,
            config
        });
        
        // Register category
        const category = config.category || 'misc';
        if (!this.categories.has(category)) {
            this.categories.set(category, []);
        }
        this.categories.get(category).push(name);
        
        // Register aliases
        if (config.aliases && Array.isArray(config.aliases)) {
            for (const alias of config.aliases) {
                this.aliases.set(alias.toLowerCase().trim(), name);
            }
        }
        
        // Save source path for debugging
        this.sourcePaths.set(name, sourcePath);
        
        logger.debug(`Registered command: ${name} (${category})`);
        return true;
    }
    
    /**
     * Get a command by name or alias
     */
    getCommand(nameOrAlias) {
        if (!nameOrAlias) return null;
        
        nameOrAlias = nameOrAlias.toLowerCase().trim();
        
        // Check direct command name
        if (this.commands.has(nameOrAlias)) {
            const command = this.commands.get(nameOrAlias);
            return command.config.enabled ? command : null;
        }
        
        // Check aliases
        if (this.aliases.has(nameOrAlias)) {
            const commandName = this.aliases.get(nameOrAlias);
            const command = this.commands.get(commandName);
            return command && command.config.enabled ? command : null;
        }
        
        return null;
    }
    
    /**
     * Update command statistics
     */
    updateStats() {
        const totalCommands = this.commands.size;
        const enabledCommands = Array.from(this.commands.values())
            .filter(cmd => cmd.config.enabled).length;
        const disabledCommands = totalCommands - enabledCommands;
        
        const byCategory = {};
        for (const [category, commands] of this.categories.entries()) {
            const enabledCount = commands.filter(cmd => {
                const command = this.commands.get(cmd);
                return command && command.config.enabled;
            }).length;
            
            byCategory[category] = {
                total: commands.length,
                enabled: enabledCount,
                disabled: commands.length - enabledCount
            };
        }
        
        this.commandStats = {
            total: totalCommands,
            enabled: enabledCommands,
            disabled: disabledCommands,
            byCategory
        };
        
        return this.commandStats;
    }
    
    /**
     * Check if a user has permission to use a command
     */
    hasPermission(sender, requiredPermissions = []) {
        if (!requiredPermissions || !requiredPermissions.length || requiredPermissions.includes('user')) {
            return true;
        }
        
        if (requiredPermissions.includes('owner')) {
            return sender === process.env.OWNER_NUMBER;
        }
        
        return false;
    }
    
    /**
     * Check if a module has command functions
     */
    hasCommandFunctions(module) {
        return Object.entries(module).some(([key, value]) => 
            typeof value === 'function' && key !== 'init' && !key.startsWith('_')
        );
    }
    
    /**
     * Get category from file path
     */
    getCategoryFromPath(filePath) {
        const fileName = path.basename(filePath, '.js');
        const dirName = path.basename(path.dirname(filePath));
        
        // If the file is directly in the commands folder, use the filename as category
        if (dirName === 'commands') {
            return fileName;
        }
        
        // Otherwise use the directory name
        return dirName;
    }
    
    /**
     * Get all commands in a category
     */
    getCommandsByCategory(category) {
        return this.categories.get(category) || [];
    }
    
    /**
     * Get all categories
     */
    getAllCategories() {
        return Array.from(this.categories.keys());
    }
    
    /**
     * Reload commands (with cooldown protection)
     */
    async reloadCommands() {
        const now = Date.now();
        const cooldown = 2000; // 2 seconds cooldown
        
        if (now - this.lastReload < cooldown) {
            logger.warn('Command reload requested too soon. Please wait.');
            return false;
        }
        
        this.lastReload = now;
        logger.info('Reloading all commands...');
        
        try {
            await this.loadAllCommands();
            this.updateStats();
            
            logger.info(`Commands reloaded. Total: ${this.commandStats.total}, Enabled: ${this.commandStats.enabled}`);
            return true;
        } catch (err) {
            logger.error('Error reloading commands:', err);
            return false;
        }
    }
}

// Export singleton instance
const registry = new CommandRegistry();
module.exports = registry;