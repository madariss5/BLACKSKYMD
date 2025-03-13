const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const logger = require('./logger');
const globalConfig = require('../config/globalConfig');

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
        this.commandSources = new Map();
    }

    async loadCommandsFromDirectory(dir, category = '') {
        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
        const loadedHandlers = {};

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                // Recursively load commands from subdirectories
                const subCategory = category ? `${category}_${entry.name}` : entry.name;
                const subHandlers = await this.loadCommandsFromDirectory(fullPath, subCategory);
                Object.assign(loadedHandlers, subHandlers);
                continue;
            }

            if (!entry.name.endsWith('.js') || entry.name === 'index.js') continue;

            const currentCategory = category || entry.name.replace('.js', '');

            try {
                delete require.cache[require.resolve(fullPath)];
                const module = require(fullPath);

                if (!module || !module.commands || typeof module.commands !== 'object') {
                    logger.warn(`Invalid module format in ${entry.name}`);
                    continue;
                }

                if (!loadedHandlers[currentCategory]) {
                    loadedHandlers[currentCategory] = {
                        total: 0,
                        loaded: 0,
                        failed: 0
                    };
                }

                for (const [name, handler] of Object.entries(module.commands)) {
                    try {
                        loadedHandlers[currentCategory].total++;

                        if (typeof handler !== 'function') {
                            loadedHandlers[currentCategory].failed++;
                            logger.warn(`Skipping non-function handler for ${name} in ${entry.name}`);
                            continue;
                        }

                        const config = {
                            name,
                            description: `Command: ${name}`,
                            usage: `${globalConfig.prefix}${name}`,
                            cooldown: 3,
                            permissions: module.category === 'owner' ? ['owner'] : ['user'],
                            enabled: true
                        };

                        this.commands.set(name, {
                            execute: handler,
                            config,
                            category: currentCategory
                        });

                        this.commandSources.set(name, fullPath);
                        loadedHandlers[currentCategory].loaded++;

                        if (!this.commandCache.has(name)) {
                            this.commandCache.set(name, {
                                lastUsed: Date.now(),
                                usageCount: 0,
                                errors: 0
                            });
                        }
                    } catch (err) {
                        loadedHandlers[currentCategory].failed++;
                        logger.error(`Failed to register handler for ${name} in ${entry.name}:`, err);
                    }
                }
            } catch (err) {
                logger.error(`Error processing module ${entry.name}:`, err);
            }
        }

        return loadedHandlers;
    }

    async loadCommandHandlers() {
        try {
            if (this.initialized && Date.now() - this.lastReload < this.reloadCooldown) {
                return false;
            }

            this.commands.clear();
            this.commandSources.clear();

            const commandsPath = path.join(__dirname, '../commands');
            const loadedHandlers = await this.loadCommandsFromDirectory(commandsPath);

            // Print loading statistics
            logger.info('\nCommand loading statistics:');
            for (const [category, stats] of Object.entries(loadedHandlers)) {
                logger.info(`\n${category}:`);
                logger.info(`  Total handlers: ${stats.total}`);
                logger.info(`  Successfully loaded: ${stats.loaded}`);
                logger.info(`  Failed to load: ${stats.failed}`);
            }

            this.initialized = true;
            this.lastReload = Date.now();

            const totalCommands = Array.from(this.commands.values()).length;
            logger.info(`\n✅ Total commands loaded: ${totalCommands}`);

            return totalCommands > 0;
        } catch (err) {
            logger.error('Critical error in loadCommandHandlers:', err);
            return false;
        }
    }

    async hasPermission(sender, requiredPermissions) {
        if (!requiredPermissions?.length || requiredPermissions.includes('user')) {
            return true;
        }

        if (requiredPermissions.includes('owner')) {
            return sender === globalConfig.owner;
        }

        return false;
    }

    async getCommand(name) {
        try {
            if (this.initialized) {
                const command = this.commands.get(name);
                if (!command || !command.config.enabled) return null;

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

            await this.loadCommandHandlers();
            const command = this.commands.get(name);
            if (!command || !command.config.enabled) return null;
            return command;
        } catch (err) {
            logger.error('Error getting command:', err);
            return null;
        }
    }

    getCommandStats() {
        return {
            totalCommands: this.commands.size,
            enabledCommands: Array.from(this.commands.values()).filter(cmd => cmd.config.enabled).length,
            commandsByCategory: Array.from(this.commands.values()).reduce((acc, cmd) => {
                acc[cmd.category] = (acc[cmd.category] || 0) + 1;
                return acc;
            }, {}),
            mostUsedCommands: Array.from(this.commandCache.entries())
                .map(([name, info]) => ({
                    name,
                    usageCount: info.usageCount,
                    lastUsed: info.lastUsed
                }))
                .sort((a, b) => b.usageCount - a.usageCount)
                .slice(0, 10)
        };
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