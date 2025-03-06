const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class CommandLoader {
    constructor() {
        this.commands = new Map();
        this.commandCache = new Map();
    }

    async loadCommandHandlers() {
        try {
            const commandsPath = path.join(__dirname, '../commands');
            const files = await fs.readdir(commandsPath);
            let loadedHandlers = {};

            console.log('\nLoading command handlers...');

            for (const file of files) {
                if (file.endsWith('.js') && file !== 'index.js') {
                    const category = file.replace('.js', '');
                    try {
                        console.log(`Loading commands from ${file}...`);
                        const handlers = require(path.join(commandsPath, file));

                        // Register each command with its configuration
                        for (const [name, handler] of Object.entries(handlers)) {
                            // Skip if not a function
                            if (typeof handler !== 'function') {
                                console.log(`Skipping ${name} in ${file} - not a function`);
                                continue;
                            }

                            this.commands.set(name, {
                                execute: handler,
                                config: handler.config || {
                                    name,
                                    description: 'No description available',
                                    usage: `.${name}`,
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
                            console.log(`Registered command: ${name} from ${category}`);
                        }
                    } catch (err) {
                        console.error(`Error loading handlers from ${file}:`, err);
                        continue;
                    }
                }
            }

            console.log('\nCommand loading summary:');
            for (const [category, count] of Object.entries(loadedHandlers)) {
                console.log(`${category}: ${count} commands`);
            }
            console.log('Total commands:', this.commands.size);

            return Object.keys(loadedHandlers).length > 0;
        } catch (err) {
            console.error('Critical error in loadCommandHandlers:', err);
            return false;
        }
    }

    getCommand(name) {
        const command = this.commands.get(name);
        if (command) {
            console.log(`Command '${name}' found in category '${command.category}'`);
            const cacheInfo = this.commandCache.get(name);
            if (cacheInfo) {
                cacheInfo.lastUsed = Date.now();
                cacheInfo.usageCount++;
                this.commandCache.set(name, cacheInfo);
            }
        } else {
            console.log(`Command '${name}' not found`);
        }
        return command;
    }

    hasPermission(sender, requiredPermissions) {
        // For now, allow all users
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