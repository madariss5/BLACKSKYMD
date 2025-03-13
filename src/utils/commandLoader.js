const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const logger = require('./logger');

class CommandError extends Error {
    constructor(message, command, originalError = null) {
        super(message);
        this.name = 'CommandError';
        this.command = command;
        this.originalError = originalError;
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
        this.fs = fs;
        this.fsPromises = fsPromises;

        // Track command registration sources
        this.commandSources = new Map();
    }

    async initializeDirectories() {
        const dirs = [
            path.join(__dirname, '../../data'),
            path.join(__dirname, '../../temp'),
            path.join(__dirname, '../../temp/media'),
            path.join(__dirname, '../../temp/stickers'),
            path.join(__dirname, '../../auth_info'),
            path.join(__dirname, '../../data/educational'),
            path.join(__dirname, '../../data/groups'),
            path.join(__dirname, '../config/commands')
        ];

        try {
            for (const dir of dirs) {
                if (!fs.existsSync(dir)) {
                    await fsPromises.mkdir(dir, { recursive: true });
                    logger.info(`Created directory: ${dir}`);
                }
            }
            return true;
        } catch (err) {
            logger.error('Failed to initialize directories:', err);
            return false;
        }
    }

    async loadModuleSafely(modulePath, file) {
        try {
            delete require.cache[require.resolve(modulePath)];
            const module = require(modulePath);

            if (!module || (typeof module !== 'object' && typeof module !== 'function')) {
                throw new CommandError(`Invalid module format in ${file}`);
            }

            if (module.commands && typeof module.commands === 'object') {
                // Inject fs instances if module needs them
                if (module.init && typeof module.init === 'function') {
                    try {
                        // Provide fs instances to module
                        module.fs = this.fs;
                        module.fsPromises = this.fsPromises;
                        await module.init();
                    } catch (initError) {
                        logger.error(`Error initializing module ${file}:`, initError);
                    }
                }

                return {
                    commands: module.commands,
                    category: module.category || file.replace('.js', '')
                };
            } else if (typeof module === 'object') {
                const possibleCommands = Object.entries(module)
                    .filter(([key, value]) => typeof value === 'function' && key !== 'init')
                    .map(([key]) => key);

                if (possibleCommands.length > 0) {
                    return {
                        commands: module,
                        category: file.replace('.js', '')
                    };
                }
            }

            return {
                commands: {},
                category: file.replace('.js', '')
            };
        } catch (err) {
            if (err instanceof CommandError) {
                throw err;
            }
            logger.error(`Failed to load module ${file}:`, err);
            return {
                commands: {},
                category: file.replace('.js', '')
            };
        }
    }

    async loadCommandHandlers() {
        try {
            if (this.initialized && Date.now() - this.lastReload < this.reloadCooldown) {
                return false;
            }

            // Initialize directories first
            const dirsInitialized = await this.initializeDirectories();
            if (!dirsInitialized) {
                throw new Error('Failed to initialize directories');
            }

            this.commands.clear();
            this.commandSources.clear();
            await this.loadCommandConfigs();

            const commandsPath = path.join(__dirname, '../commands');
            let files;
            try {
                files = await fsPromises.readdir(commandsPath);
            } catch (err) {
                throw new CommandError('Failed to read commands directory', null, err);
            }

            const loadedHandlers = {};
            const duplicateCommands = new Set();

            for (const file of files) {
                if (!file.endsWith('.js') || file === 'index.js') continue;

                const category = file.replace('.js', '');
                const modulePath = path.join(commandsPath, file);

                try {
                    const moduleData = await this.loadModuleSafely(modulePath, file);
                    const commands = moduleData.commands;
                    const moduleCategory = moduleData.category || category;

                    // Track handlers per category
                    if (!loadedHandlers[moduleCategory]) {
                        loadedHandlers[moduleCategory] = {
                            total: 0,
                            loaded: 0,
                            duplicates: 0,
                            failed: 0
                        };
                    }

                    for (const [name, handler] of Object.entries(commands)) {
                        try {
                            if (typeof handler !== 'function') {
                                loadedHandlers[moduleCategory].failed++;
                                logger.warn(`Skipping non-function handler for ${name} in ${file}`);
                                continue;
                            }

                            loadedHandlers[moduleCategory].total++;

                            // Check for duplicates
                            if (this.commands.has(name)) {
                                const existingSource = this.commandSources.get(name);
                                duplicateCommands.add(name);
                                loadedHandlers[moduleCategory].duplicates++;
                                logger.warn(`Duplicate command "${name}" found in ${file}, already registered from ${existingSource}`);
                                continue;
                            }

                            const config = this.commandConfigs.get(name) || {
                                name,
                                description: 'No description available',
                                usage: `${process.env.BOT_PREFIX || '.'}${name}`,
                                cooldown: 3,
                                permissions: ['user'],
                                enabled: true
                            };

                            this.commands.set(name, {
                                execute: handler,
                                config,
                                category: moduleCategory
                            });

                            // Track command source
                            this.commandSources.set(name, file);

                            if (!this.commandCache.has(name)) {
                                this.commandCache.set(name, {
                                    lastUsed: Date.now(),
                                    usageCount: 0,
                                    errors: 0,
                                    lastError: null
                                });
                            }

                            loadedHandlers[moduleCategory].loaded++;
                        } catch (err) {
                            loadedHandlers[moduleCategory].failed++;
                            logger.error(`Failed to register handler for ${name} in ${file}:`, err);
                        }
                    }
                } catch (err) {
                    logger.error(`Error processing module ${file}:`, err);
                    continue;
                }
            }

            // Print detailed loading statistics
            logger.info('\nCommand loading statistics:');
            for (const [category, stats] of Object.entries(loadedHandlers)) {
                logger.info(`\n${category}:`);
                logger.info(`  Total handlers: ${stats.total}`);
                logger.info(`  Successfully loaded: ${stats.loaded}`);
                logger.info(`  Duplicates skipped: ${stats.duplicates}`);
                logger.info(`  Failed to load: ${stats.failed}`);
            }

            if (duplicateCommands.size > 0) {
                logger.warn('\nDuplicate commands found:', Array.from(duplicateCommands));
            }

            this.initialized = true;
            this.lastReload = Date.now();
            return this.commands.size > 0;
        } catch (err) {
            logger.error('Critical error in loadCommandHandlers:', err);
            return false;
        }
    }

    async loadCommandConfigs() {
        try {
            const configPath = path.join(__dirname, '../config/commands');
            if (!fs.existsSync(configPath)) {
                await fsPromises.mkdir(configPath, { recursive: true });
            }

            const files = await fsPromises.readdir(configPath);
            let loadedCount = 0;

            this.commandConfigs.clear();

            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const configContent = await fsPromises.readFile(path.join(configPath, file), 'utf8');
                        const config = JSON.parse(configContent);

                        if (!Array.isArray(config.commands)) {
                            continue;
                        }

                        for (const cmd of config.commands) {
                            const validatedConfig = await this.validateCommandConfig(cmd, cmd.name);
                            this.commandConfigs.set(cmd.name, {
                                ...validatedConfig,
                                category: file.replace('.json', '')
                            });
                            loadedCount++;
                        }
                    } catch (err) {
                        logger.error(`Error reading/parsing config file ${file}:`, err);
                        continue;
                    }
                }
            }
            logger.info(`Successfully loaded ${loadedCount} command configs`);
        } catch (err) {
            logger.error('Critical error loading command configs:', err);
            throw new CommandError('Failed to load command configurations', null, err);
        }
    }

    async validateCommandConfig(config, name) {
        try {
            const requiredFields = ['name', 'description', 'usage'];
            const missingFields = requiredFields.filter(field => !config[field]);

            if (missingFields.length > 0) {
                logger.error(`Invalid command configuration for ${name}: Missing fields: ${missingFields.join(', ')}`);
                throw new CommandError(
                    `Invalid command configuration: Missing fields: ${missingFields.join(', ')}`,
                    name
                );
            }

            // Additional validation for handler field
            if (config.handler && typeof config.handler !== 'string') {
                logger.error(`Invalid handler format for command ${name}: handler must be a string`);
                throw new CommandError('Invalid handler format', name);
            }

            // Validate permissions array
            if (config.permissions && (!Array.isArray(config.permissions) || config.permissions.length === 0)) {
                logger.error(`Invalid permissions format for command ${name}: must be a non-empty array`);
                throw new CommandError('Invalid permissions format', name);
            }

            return {
                ...config,
                cooldown: config.cooldown || 3,
                permissions: config.permissions || ['user'],
                enabled: config.enabled !== false
            };
        } catch (err) {
            logger.error(`Error validating config for command ${name}:`, err);
            logger.error('Config object:', JSON.stringify(config, null, 2));
            throw err;
        }
    }

    async getCommand(name) {
        // Fast path - direct lookup without any overhead
        try {
            // Skip initialization check if already initialized
            if (this.initialized) {
                const command = this.commands.get(name);

                // Fast enabled check - return null immediately if not usable
                if (!command || !command.config.enabled) return null;

                // Optional cache update - separated to reduce critical path latency
                if (this.commandCache.has(name)) {
                    setTimeout(() => {
                        try {
                            const cacheInfo = this.commandCache.get(name);
                            if (cacheInfo) {
                                cacheInfo.lastUsed = Date.now();
                                cacheInfo.usageCount++;
                                this.commandCache.set(name, cacheInfo);
                            }
                        } catch (e) {
                            // Silently fail - caching is non-critical
                        }
                    }, 0);
                }

                return command;
            }

            // Slower path for first-time initialization
            await this.loadCommandHandlers();
            const command = this.commands.get(name);
            if (!command || !command.config.enabled) return null;
            return command;
        } catch (err) {
            // Minimal error handling for speed
            return null;
        }
    }

    async hasPermission(sender, requiredPermissions) {
        // Fast path - most common case first
        if (!requiredPermissions?.length || requiredPermissions.includes('user')) {
            return true;
        }

        // Owner check - only needed for admin commands
        if (requiredPermissions.includes('owner')) {
            return sender === process.env.OWNER_NUMBER;
        }

        return false;
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