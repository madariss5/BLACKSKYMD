const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class CommandLoader {
    constructor() {
        this.commands = new Map();
        this.commandConfigs = new Map();
        this.configPath = path.join(__dirname, '../config/commands');
        this.commandCache = new Map(); // Cache for frequently used commands
    }

    async loadCommandConfigs() {
        try {
            const startTime = Date.now();
            const files = await fs.readdir(this.configPath);
            let totalCommands = 0;
            let categoryStats = {};

            logger.info('Starting command configuration loading...');

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const category = file.replace('.json', '');
                    logger.info(`Loading command configuration for category: ${category}`);

                    try {
                        const configContent = await fs.readFile(path.join(this.configPath, file), 'utf8');
                        const config = JSON.parse(configContent);

                        // Validate category structure
                        if (!config.category || !Array.isArray(config.commands)) {
                            logger.error(`Invalid config structure in ${file}`);
                            continue;
                        }

                        this.commandConfigs.set(config.category, config.commands);

                        // Track statistics
                        totalCommands += config.commands.length;
                        categoryStats[category] = config.commands.length;

                        logger.info(`Loaded ${config.commands.length} command configs for ${category}`);

                        // Validate command structure
                        this.validateCommandConfigs(config.commands, category);
                    } catch (err) {
                        logger.error(`Error loading config file ${file}:`, err);
                        continue; // Skip this file but continue loading others
                    }
                }
            }

            const loadTime = Date.now() - startTime;
            logger.info('Command configuration loading completed:');
            logger.info(`Total commands loaded: ${totalCommands}`);
            logger.info(`Loading time: ${loadTime}ms`);
            logger.info('Commands per category:', categoryStats);

            return true;
        } catch (err) {
            logger.error('Critical error in loadCommandConfigs:', err);
            return false;
        }
    }

    validateCommandConfigs(commands, category) {
        for (const cmd of commands) {
            try {
                if (!cmd.name || !cmd.description || !cmd.usage || !cmd.permissions) {
                    logger.warn(`Invalid command config in ${category}: ${cmd.name || 'unnamed'}`);
                    continue;
                }
                if (!Array.isArray(cmd.permissions)) {
                    logger.warn(`Invalid permissions format in ${category}:${cmd.name}`);
                    cmd.permissions = ['user']; // Set default permission
                }
            } catch (err) {
                logger.error(`Error validating command in ${category}:`, err);
            }
        }
    }

    async loadCommandHandlers() {
        try {
            const startTime = Date.now();
            const commandsPath = path.join(__dirname, '../commands');
            const files = await fs.readdir(commandsPath);
            let totalCommands = 0;
            let loadedHandlers = {};

            logger.info('Starting command handler loading...');

            for (const file of files) {
                if (file.endsWith('.js') && file !== 'index.js') {
                    const category = file.replace('.js', '');
                    logger.info(`Loading command handlers for category: ${category}`);

                    try {
                        const handlers = require(path.join(commandsPath, file));
                        const config = this.commandConfigs.get(category) || [];

                        // Track loaded handlers
                        loadedHandlers[category] = 0;

                        // Register each command with its configuration
                        for (const [name, handler] of Object.entries(handlers)) {
                            if (typeof handler !== 'function') {
                                logger.warn(`Invalid handler type for command ${name} in ${category}`);
                                continue;
                            }

                            const cmdConfig = config.find(cmd => cmd.name === name) || {
                                name,
                                description: 'No description available',
                                usage: `.${name}`,
                                cooldown: 3,
                                permissions: ['user']
                            };

                            this.commands.set(name, {
                                handler,
                                config: cmdConfig,
                                category
                            });

                            // Update cache
                            this.commandCache.set(name, {
                                lastUsed: Date.now(),
                                usageCount: 0
                            });

                            logger.debug(`Registered command: ${name} (${category})`);
                            totalCommands++;
                            loadedHandlers[category]++;
                        }

                        logger.info(`Loaded ${loadedHandlers[category]} handlers from ${category}`);
                    } catch (err) {
                        logger.error(`Error loading handlers from ${file}:`, err);
                        // Continue loading other files
                        continue;
                    }
                }
            }

            const loadTime = Date.now() - startTime;
            logger.info('Command handler loading completed:');
            logger.info(`Total handlers loaded: ${totalCommands}`);
            logger.info(`Loading time: ${loadTime}ms`);
            logger.info('Handlers per category:', loadedHandlers);

            return totalCommands > 0;
        } catch (err) {
            logger.error('Critical error in loadCommandHandlers:', err);
            return false;
        }
    }

    getCommand(name) {
        try {
            const command = this.commands.get(name);
            if (command) {
                // Update cache statistics
                const cacheInfo = this.commandCache.get(name);
                if (cacheInfo) {
                    cacheInfo.lastUsed = Date.now();
                    cacheInfo.usageCount++;
                    this.commandCache.set(name, cacheInfo);
                }
                logger.debug(`Command found: ${name} (${command.category})`);
            } else {
                logger.debug(`Command not found: ${name}`);
            }
            return command;
        } catch (err) {
            logger.error(`Error getting command ${name}:`, err);
            return null;
        }
    }

    getAllCommands() {
        return Array.from(this.commands.values());
    }

    getCommandsByCategory(category) {
        return Array.from(this.commands.values())
            .filter(cmd => cmd.category === category);
    }

    hasPermission(command, userRole) {
        try {
            const cmd = this.commands.get(command);
            if (!cmd) {
                logger.debug(`Permission check failed: command ${command} not found`);
                return false;
            }
            const hasPermission = cmd.config.permissions.includes(userRole);
            logger.debug(`Permission check for ${command}: ${userRole} -> ${hasPermission}`);
            return hasPermission;
        } catch (err) {
            logger.error(`Error checking permission for ${command}:`, err);
            return false;
        }
    }

    getCommandStats() {
        try {
            const stats = {
                totalCommands: this.commands.size,
                commandsByCategory: {},
                mostUsedCommands: []
            };

            // Gather category statistics
            for (const [name, cmd] of this.commands) {
                const category = cmd.category;
                stats.commandsByCategory[category] = (stats.commandsByCategory[category] || 0) + 1;
            }

            // Get most used commands from cache
            const usageStats = Array.from(this.commandCache.entries())
                .map(([name, info]) => ({
                    name,
                    usageCount: info.usageCount,
                    lastUsed: info.lastUsed
                }))
                .sort((a, b) => b.usageCount - a.usageCount)
                .slice(0, 10);

            stats.mostUsedCommands = usageStats;

            return stats;
        } catch (err) {
            logger.error('Error getting command stats:', err);
            return {
                totalCommands: 0,
                commandsByCategory: {},
                mostUsedCommands: []
            };
        }
    }
}

const commandLoader = new CommandLoader();
module.exports = { commandLoader };