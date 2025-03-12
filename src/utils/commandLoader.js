const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class CommandError extends Error {
    constructor(message, command, originalError = null) {
        super(message);
        this.name = 'CommandError';
        this.command = command;
        this.originalError = originalError;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CommandError);
        }
    }

    toString() {
        return `${this.name}: ${this.message}${this.command ? ` (Command: ${this.command})` : ''}${this.originalError ? `\nCaused by: ${this.originalError.message}` : ''}`;
    }
}

class CommandLoader {
    constructor() {
        this.commands = new Map();
        this.commandCache = new Map();
        this.initialized = false;
        this.commandConfigs = new Map();
        this.lastReload = Date.now();
        this.reloadCooldown = 1000;
    }

    async loadModuleSafely(modulePath, file) {
        try {
            // Clear require cache
            delete require.cache[require.resolve(modulePath)];

            logger.info(`Loading module from ${file}...`);
            console.log(`Attempting to load module: ${file}`);
            const module = require(modulePath);
            console.log(`Module loaded successfully: ${file}, module type: ${typeof module}`);
            if (module && typeof module === 'object') {
                console.log(`Module keys: ${Object.keys(module).join(', ')}`);
            }

            // Verify module structure
            if (!module || (typeof module !== 'object' && typeof module !== 'function')) {
                throw new CommandError(`Invalid module format in ${file}: Expected object or function, got ${typeof module}`);
            }

            // Check if module has commands property
            if (module.commands && typeof module.commands === 'object') {
                // Module uses new format with commands property
                if (Object.keys(module.commands).length === 0) {
                    logger.warn(`Module ${file} has empty commands object`);
                }
                
                // Initialize module if it has an init function
                if (module.init && typeof module.init === 'function') {
                    try {
                        logger.info(`Initializing module ${file}...`);
                        await module.init();
                    } catch (initError) {
                        logger.error(`Error initializing module ${file}:`, initError);
                        // Continue loading even if initialization fails
                    }
                }
                
                return {
                    commands: module.commands,
                    category: module.category || file.replace('.js', '')
                };
            } else if (typeof module === 'object') {
                // Check if the module has any function properties that might be commands
                const possibleCommands = Object.entries(module)
                    .filter(([key, value]) => typeof value === 'function' && key !== 'init')
                    .map(([key]) => key);
                
                if (possibleCommands.length > 0) {
                    logger.info(`Module ${file} using legacy format with ${possibleCommands.length} commands`);
                    return {
                        commands: module,
                        category: file.replace('.js', '')
                    };
                } else {
                    logger.warn(`Module ${file} has no valid commands`);
                    return {
                        commands: {},
                        category: file.replace('.js', '')
                    };
                }
            }

            logger.error(`Invalid module structure in ${file}: No valid commands found`);
            return {
                commands: {},
                category: file.replace('.js', '')
            };
        } catch (err) {
            if (err instanceof CommandError) {
                throw err;
            }
            logger.error(`Failed to load module ${file}:`, err);
            logger.error('Stack trace:', err.stack);
            
            // Return empty commands object to prevent the entire module loading from failing
            return {
                commands: {},
                category: file.replace('.js', '')
            };
        }
    }

    async loadCommandHandlers() {
        try {
            if (this.initialized && Date.now() - this.lastReload < this.reloadCooldown) {
                logger.warn(`Command reload attempted too soon, please wait ${this.reloadCooldown}ms between reloads`);
                return false;
            }

            // Clear existing commands but keep cache
            this.commands.clear();
            await this.loadCommandConfigs();

            const commandsPath = path.join(__dirname, '../commands');
            logger.info(`Loading commands from directory: ${commandsPath}`);

            let files;
            try {
                files = await fs.readdir(commandsPath);
            } catch (err) {
                logger.error('Error reading commands directory:', err);
                throw new CommandError('Failed to read commands directory', null, err);
            }

            const loadedHandlers = {};
            logger.info('\nLoading command handlers...');

            for (const file of files) {
                if (!file.endsWith('.js') || file === 'index.js') continue;

                const category = file.replace('.js', '');
                const modulePath = path.join(commandsPath, file);
                
                // Debug: log file being loaded
                console.log(`CommandLoader: Attempting to load file: ${file}, path: ${modulePath}`);

                try {
                    const moduleData = await this.loadModuleSafely(modulePath, file);
                    const commands = moduleData.commands;
                    const moduleCategory = moduleData.category || category;
                    
                    // Add more detailed logging for debugging
                    console.log(`Module ${file} loaded: Category=${moduleCategory}, CommandsType=${typeof commands}, CommandCount=${Object.keys(commands).length}`);
                    console.log(`First few commands: ${Object.keys(commands).slice(0, 3).join(', ')}`);

                    for (const [name, handler] of Object.entries(commands)) {
                        try {
                            if (typeof handler !== 'function') {
                                logger.warn(`Skipping ${name} in ${file} - not a function, got ${typeof handler}`);
                                continue;
                            }

                            // Get or create config
                            const config = this.commandConfigs.get(name) || {
                                name,
                                description: 'No description available',
                                usage: `${process.env.BOT_PREFIX || '.'}${name}`,
                                cooldown: 3,
                                permissions: ['user'],
                                enabled: true
                            };

                            // Validate handler signature
                            if (handler.length > 3) {
                                throw new CommandError(
                                    `Command handler ${name} has too many parameters (max 3)`,
                                    name
                                );
                            }

                            this.commands.set(name, {
                                execute: handler,
                                config,
                                category: moduleCategory
                            });

                            // Update or initialize cache
                            if (!this.commandCache.has(name)) {
                                this.commandCache.set(name, {
                                    lastUsed: Date.now(),
                                    usageCount: 0,
                                    errors: 0,
                                    lastError: null
                                });
                            }

                            loadedHandlers[moduleCategory] = (loadedHandlers[moduleCategory] || 0) + 1;
                            logger.info(`✅ Registered command: ${name} from ${moduleCategory}`);
                        } catch (err) {
                            logger.error(`Failed to register handler for ${name} in ${file}:`, err.toString());
                            if (err.stack) logger.error('Stack trace:', err.stack);
                        }
                    }
                } catch (err) {
                    logger.error(`Error processing module ${file}:`, err.toString());
                    if (err.stack) logger.error('Stack trace:', err.stack);
                    continue;
                }
            }

            logger.info('\nCommand loading summary:');
            for (const [category, count] of Object.entries(loadedHandlers)) {
                logger.info(`${category}: ${count} commands`);
            }
            logger.info('Total commands:', this.commands.size);

            this.initialized = true;
            this.lastReload = Date.now();
            return this.commands.size > 0;
        } catch (err) {
            logger.error('Critical error in loadCommandHandlers:', err.toString());
            if (err.stack) logger.error('Stack trace:', err.stack);
            return false;
        }
    }

    async loadCommandConfigs() {
        try {
            const configPath = path.join(__dirname, '../config/commands');
            const files = await fs.readdir(configPath);
            let loadedCount = 0;

            this.commandConfigs.clear();
            logger.info('Loading command configurations...');

            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const category = file.replace('.json', '');
                        const configContent = await fs.readFile(path.join(configPath, file), 'utf8');
                        const config = JSON.parse(configContent);

                        if (!Array.isArray(config.commands)) {
                            logger.warn(`Invalid config file ${file}: 'commands' is not an array`);
                            continue;
                        }

                        for (const cmd of config.commands) {
                            try {
                                const validatedConfig = await this.validateCommandConfig(cmd, cmd.name);
                                this.commandConfigs.set(cmd.name, {
                                    ...validatedConfig,
                                    category
                                });
                                loadedCount++;
                                logger.debug(`Loaded config for command: ${cmd.name}`);
                            } catch (err) {
                                logger.error(`Error processing command ${cmd.name} in ${file}:`, err);
                            }
                        }
                    } catch (err) {
                        logger.error(`Error reading/parsing config file ${file}:`, err);
                        logger.error('Stack trace:', err.stack);
                        continue;
                    }
                }
            }
            logger.info(`Successfully loaded ${loadedCount} command configs`);
        } catch (err) {
            logger.error('Critical error loading command configs:', err);
            logger.error('Stack trace:', err.stack);
            throw new CommandError('Failed to load command configurations', null, err);
        }
    }

    async validateCommandConfig(config, name) {
        try {
            const requiredFields = ['name', 'description', 'usage'];
            const missingFields = requiredFields.filter(field => !config[field]);

            if (missingFields.length > 0) {
                throw new CommandError(
                    `Invalid command configuration: Missing fields: ${missingFields.join(', ')}`,
                    name
                );
            }

            return {
                ...config,
                cooldown: config.cooldown || 3,
                permissions: config.permissions || ['user'],
                enabled: config.enabled !== false
            };
        } catch (err) {
            logger.error(`Error validating config for command ${name}:`, err);
            throw err;
        }
    }

    async getCommand(name) {
        try {
            if (!this.initialized) {
                await this.loadCommandHandlers();
            }

            const command = this.commands.get(name);
            if (!command) {
                logger.warn(`Command '${name}' not found`);
                return null;
            }

            if (!command.config.enabled) {
                logger.warn(`Command '${name}' is disabled`);
                return null;
            }

            logger.info(`Command '${name}' found in category '${command.category}'`);
            const cacheInfo = this.commandCache.get(name);
            if (cacheInfo) {
                cacheInfo.lastUsed = Date.now();
                cacheInfo.usageCount++;
                this.commandCache.set(name, cacheInfo);
            }
            return command;
        } catch (err) {
            logger.error('Error getting command:', err);
            const cacheInfo = this.commandCache.get(name);
            if (cacheInfo) {
                cacheInfo.errors = (cacheInfo.errors || 0) + 1;
                this.commandCache.set(name, cacheInfo);
            }
            return null;
        }
    }

    async hasPermission(sender, requiredPermissions) {
        try {
            if (!requiredPermissions?.length) {
                return true;
            }

            if (requiredPermissions.includes('owner')) {
                const isOwner = sender === process.env.OWNER_NUMBER;
                logger.info(`Owner permission check for ${sender}: ${isOwner}`);
                return isOwner;
            }

            return requiredPermissions.includes('user');
        } catch (err) {
            logger.error('Error checking permissions:', err);
            return false;
        }
    }

    getCommandStats() {
        const stats = {
            totalCommands: this.commands.size,
            enabledCommands: Array.from(this.commands.values()).filter(cmd => cmd.config.enabled).length,
            commandsByCategory: {},
            mostUsedCommands: [],
            errorStats: {
                totalErrors: 0,
                commandsWithErrors: 0
            }
        };

        for (const [name, cmd] of this.commands) {
            const category = cmd.category;
            stats.commandsByCategory[category] = (stats.commandsByCategory[category] || 0) + 1;
        }

        const usageStats = Array.from(this.commandCache.entries())
            .map(([name, info]) => ({
                name,
                usageCount: info.usageCount,
                lastUsed: info.lastUsed,
                errors: info.errors || 0
            }))
            .sort((a, b) => b.usageCount - a.usageCount)
            .slice(0, 10);

        stats.mostUsedCommands = usageStats;

        // Calculate error stats
        for (const [_, info] of this.commandCache) {
            if (info.errors) {
                stats.errorStats.totalErrors += info.errors;
                stats.errorStats.commandsWithErrors++;
            }
        }

        return stats;
    }

    getAllCommands() {
        return Array.from(this.commands.values())
            .filter(cmd => cmd.config.enabled)
            .sort((a, b) => a.category.localeCompare(b.category));
    }

    async reloadCommands() {
        logger.info('Reloading all commands...');
        const success = await this.loadCommandHandlers();
        if (success) {
            logger.info('Commands reloaded successfully');
        } else {
            logger.error('Failed to reload commands');
        }
        return success;
    }
}

const commandLoader = new CommandLoader();
module.exports = { commandLoader, CommandError };