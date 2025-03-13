const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

// Command storage
const commands = new Map();

// Load all commands from the commands directory
async function loadCommands() {
    try {
        logger.info('Loading commands from modules...');
        
        // First, load the index.js module
        const commandsIndex = require('../commands/index');
        
        if (commandsIndex && commandsIndex.commands) {
            const allCommands = commandsIndex.commands;
            const commandCount = Object.keys(allCommands).length;
            
            logger.info(`Found ${commandCount} commands in commands/index.js`);
            
            // Register each command from the index
            Object.entries(allCommands).forEach(([name, func]) => {
                if (typeof func === 'function' && name !== 'init') {
                    commands.set(name, {
                        execute: async (sock, message, args, options = {}) => {
                            try {
                                return await func(sock, message, args, options);
                            } catch (err) {
                                logger.error(`Error executing command ${name}:`, err);
                                throw err;
                            }
                        },
                        cooldown: 5,
                        groupOnly: false
                    });
                }
            });
            
            logger.info(`Registered ${commands.size} commands from modules`);
        }
        
        // Add basic commands if they don't exist yet
        if (!commands.has('ping')) {
            commands.set('ping', {
                execute: async (sock, message, args, options = {}) => {
                    try {
                        const sender = message.key.remoteJid;
                        await sock.sendMessage(sender, { 
                            text: '🏓 Pong! Bot is active and responding.' 
                        });
                    } catch (err) {
                        logger.error('Error executing ping command:', err);
                        throw err;
                    }
                },
                cooldown: 5,
                groupOnly: false
            });
        }
        
        if (!commands.has('help')) {
            commands.set('help', {
                execute: async (sock, message, args, options = {}) => {
                    try {
                        const sender = message.key.remoteJid;
                        const commandList = Array.from(commands.entries())
                            .filter(([_, cmd]) => !options.isGroup || !cmd.groupOnly)
                            .map(([name, cmd]) => {
                                const cooldown = cmd.cooldown || 3;
                                const groupOnly = cmd.groupOnly ? '(Group Only)' : '';
                                return `!${name} - ${cooldown}s cooldown ${groupOnly}`;
                            })
                            .join('\n');
        
                        await sock.sendMessage(sender, {
                            text: `*Available Commands:*\n\n${commandList}`
                        });
                    } catch (err) {
                        logger.error('Error executing help command:', err);
                        throw err;
                    }
                },
                cooldown: 10,
                groupOnly: false
            });
        }
        
        // Initialize all modules
        if (commandsIndex.initializeModules) {
            logger.info('Initializing all command modules...');
            await commandsIndex.initializeModules(null); // null for sock, will be provided later
        }
        
        logger.info('All commands loaded successfully:', {
            commandCount: commands.size,
            availableCommands: Array.from(commands.keys())
        });
        
        return true;
    } catch (err) {
        logger.error('Error loading commands:', err);
        logger.error('Stack trace:', err.stack);
        
        // Register fallback basic commands
        if (commands.size === 0) {
            logger.info('Registering fallback basic commands...');
            
            commands.set('ping', {
                execute: async (sock, message, args, options = {}) => {
                    try {
                        const sender = message.key.remoteJid;
                        await sock.sendMessage(sender, { 
                            text: '🏓 Pong! Bot is active and responding.' 
                        });
                    } catch (err) {
                        logger.error('Error executing ping command:', err);
                        throw err;
                    }
                },
                cooldown: 5,
                groupOnly: false
            });
            
            commands.set('help', {
                execute: async (sock, message, args, options = {}) => {
                    try {
                        const sender = message.key.remoteJid;
                        await sock.sendMessage(sender, {
                            text: `*Available Commands:*\n\n!ping - Bot status check\n!help - Show this help message`
                        });
                    } catch (err) {
                        logger.error('Error executing help command:', err);
                        throw err;
                    }
                },
                cooldown: 10,
                groupOnly: false
            });
            
            logger.info('Fallback commands registered successfully');
        }
        
        return false;
    }
}

// Initialize by loading commands
(async () => {
    try {
        await loadCommands();
    } catch (err) {
        logger.error('Failed to initialize command handler:', err);
    }
})();

/**
 * Process incoming commands
 */
async function processCommand(sock, message, commandText, options = {}) {
    const sender = message.key.remoteJid;

    try {
        // Skip if no command text
        if (!commandText?.trim()) {
            return;
        }

        // Split command and args
        const [commandName, ...args] = commandText.trim().split(' ');

        logger.info('Processing command:', {
            command: commandName,
            args: args,
            sender: sender,
            options: options
        });

        // Get command handler
        const command = commands.get(commandName.toLowerCase());

        if (!command) {
            await sock.sendMessage(sender, {
                text: `❌ Unknown command: ${commandName}\nUse !help to see available commands.`
            });
            return;
        }

        // Check group-only commands
        if (command.groupOnly && !options.isGroup) {
            await sock.sendMessage(sender, {
                text: '❌ This command can only be used in groups.'
            });
            return;
        }

        // Execute command
        await command.execute(sock, message, args, options);
        logger.info(`Command ${commandName} executed successfully`);

    } catch (err) {
        logger.error('Command processing error:', {
            error: err.message,
            command: commandText,
            sender: sender,
            stack: err.stack
        });
        throw err;
    }
}

// Export module
module.exports = {
    processCommand,
    commands
};