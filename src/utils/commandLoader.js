const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class CommandLoader {
    constructor() {
        this.commands = new Map();
        this.commandCache = new Map();
        this.initialized = false;
    }

    async loadCommandHandlers() {
        try {
            if (this.initialized) {
                logger.info('Commands already loaded, skipping initialization');
                return true;
            }

            const commandsPath = path.join(__dirname, '../commands');
            const files = await fs.readdir(commandsPath);
            let loadedHandlers = {};

            logger.info('\nLoading command handlers...');

            for (const file of files) {
                if (file.endsWith('.js') && file !== 'index.js') {
                    const category = file.replace('.js', '');
                    try {
                        logger.info(`Loading commands from ${file}...`);
                        const handlers = require(path.join(commandsPath, file));

                        // Register each command with its configuration
                        for (const [name, handler] of Object.entries(handlers)) {
                            // Skip if not a function
                            if (typeof handler !== 'function') {
                                logger.info(`Skipping ${name} in ${file} - not a function`);
                                continue;
                            }

                            // Add command to registry
                            this.commands.set(name, {
                                execute: handler,
                                config: handler.config || {
                                    name,
                                    description: 'No description available',
                                    usage: `${process.env.BOT_PREFIX || '.'}${name}`,
                                    cooldown: 3,
                                    permissions: ['user']
                                },
                                category
                            });

                            // Update cache
                            this.commandCache.set(name, {
                                lastUsed: Date.now(),
                                usageCount: 0
                            });

                            loadedHandlers[category] = (loadedHandlers[category] || 0) + 1;
                            logger.info(`✅ Registered command: ${name} from ${category}`);
                        }
                    } catch (err) {
                        logger.error(`Error loading handlers from ${file}:`, err);
                        continue;
                    }
                }
            }

            logger.info('\nCommand loading summary:');
            for (const [category, count] of Object.entries(loadedHandlers)) {
                logger.info(`${category}: ${count} commands`);
            }
            logger.info('Total commands:', this.commands.size);

            this.initialized = true;
            return this.commands.size > 0;
        } catch (err) {
            logger.error('Critical error in loadCommandHandlers:', err);
            return false;
        }
    }

    async getCommand(name) {
        try {
            // Ensure commands are loaded
            if (!this.initialized) {
                await this.loadCommandHandlers();
            }

            const command = this.commands.get(name);
            if (command) {
                logger.info(`Command '${name}' found in category '${command.category}'`);
                const cacheInfo = this.commandCache.get(name);
                if (cacheInfo) {
                    cacheInfo.lastUsed = Date.now();
                    cacheInfo.usageCount++;
                    this.commandCache.set(name, cacheInfo);
                }
                return command;
            } else {
                logger.warn(`Command '${name}' not found`);
                return null;
            }
        } catch (err) {
            logger.error('Error getting command:', err);
            return null;
        }
    }

    async hasPermission(sender, requiredPermissions) {
        // For now, all users have basic permissions
        return true;
    }

    getCommandStats() {
        const stats = {
            totalCommands: this.commands.size,
            commandsByCategory: {},
            mostUsedCommands: []
        };

        for (const [name, cmd] of this.commands) {
            const category = cmd.category;
            stats.commandsByCategory[category] = (stats.commandsByCategory[category] || 0) + 1;
        }

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
    }

    getAllCommands() {
        return Array.from(this.commands.values());
    }
}

const commandLoader = new CommandLoader();
module.exports = { commandLoader };