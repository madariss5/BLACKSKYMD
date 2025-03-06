const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class CommandLoader {
    constructor() {
        this.commands = new Map();
        this.commandConfigs = new Map();
        this.configPath = path.join(__dirname, '../config/commands');
    }

    async loadCommandConfigs() {
        try {
            const files = await fs.readdir(this.configPath);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const category = file.replace('.json', '');
                    logger.info(`Loading command configuration for category: ${category}`);

                    const configContent = await fs.readFile(path.join(this.configPath, file), 'utf8');
                    const config = JSON.parse(configContent);
                    this.commandConfigs.set(config.category, config.commands);

                    logger.info(`Loaded ${config.commands.length} command configs for ${category}`);
                }
            }
            logger.info('Command configurations loaded successfully');
        } catch (err) {
            logger.error('Error loading command configs:', err);
            throw err;
        }
    }

    async loadCommandHandlers() {
        try {
            const commandsPath = path.join(__dirname, '../commands');
            const files = await fs.readdir(commandsPath);
            let totalCommands = 0;

            for (const file of files) {
                if (file.endsWith('.js') && file !== 'index.js') {
                    const category = file.replace('.js', '');
                    logger.info(`Loading command handlers for category: ${category}`);

                    const handlers = require(path.join(commandsPath, file));

                    // Get config for this category
                    const config = this.commandConfigs.get(category) || [];

                    // Register each command with its configuration
                    for (const [name, handler] of Object.entries(handlers)) {
                        const cmdConfig = config.find(cmd => cmd.name === name) || {
                            name,
                            description: 'No description available',
                            usage: `!${name}`,
                            cooldown: 3,
                            permissions: ['user']
                        };

                        this.commands.set(name, {
                            handler,
                            config: cmdConfig,
                            category
                        });

                        logger.debug(`Registered command: ${name} (${category})`);
                        totalCommands++;
                    }

                    logger.info(`Loaded ${Object.keys(handlers).length} commands from ${category}`);
                }
            }
            logger.info(`Total commands loaded: ${totalCommands}`);
        } catch (err) {
            logger.error('Error loading command handlers:', err);
            throw err;
        }
    }

    getCommand(name) {
        const command = this.commands.get(name);
        if (command) {
            logger.debug(`Command found: ${name} (${command.category})`);
        } else {
            logger.debug(`Command not found: ${name}`);
        }
        return command;
    }

    getAllCommands() {
        return Array.from(this.commands.values());
    }

    getCommandsByCategory(category) {
        return Array.from(this.commands.values())
            .filter(cmd => cmd.category === category);
    }

    // Check if user has permission to use command
    hasPermission(command, userRole) {
        const cmd = this.commands.get(command);
        if (!cmd) {
            logger.debug(`Permission check failed: command ${command} not found`);
            return false;
        }
        const hasPermission = cmd.config.permissions.includes(userRole);
        logger.debug(`Permission check for ${command}: ${userRole} -> ${hasPermission}`);
        return hasPermission;
    }
}

const commandLoader = new CommandLoader();
module.exports = { commandLoader };