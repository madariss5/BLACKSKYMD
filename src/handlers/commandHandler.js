const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

// Command storage
const commands = new Map();
const { safeSendText, safeSendMessage, safeSendImage } = require('../utils/jidHelper');

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
            for (const [name, func] of Object.entries(allCommands)) {
                if (typeof func === 'function' && name !== 'init') {
                    try {
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
                    } catch (err) {
                        logger.error(`Error registering command ${name}:`, err);
                    }
                }
            }
            
            logger.info(`Registered ${commands.size} commands from modules`);
        }
        
        // Also load individual command files directly for more reliability
        try {
            // Define command modules to load
            const commandModules = [
                { name: 'basic', module: require('../commands/basic') },
                { name: 'fun', module: require('../commands/fun') },
                { name: 'group', module: require('../commands/group') },
                { name: 'media', module: require('../commands/media') },
                { name: 'menu', module: require('../commands/menu') },
                { name: 'nsfw', module: require('../commands/nsfw') },
                { name: 'owner', module: require('../commands/owner') },
                { name: 'reactions', module: require('../commands/reactions') },
                { name: 'user', module: require('../commands/user') },
                { name: 'user_extended', module: require('../commands/user_extended') },
                { name: 'educational', module: require('../commands/educational') },
                { name: 'utility', module: require('../commands/utility') }
            ];
            
            for (const { name, module } of commandModules) {
                if (module && typeof module === 'object') {
                    // Try to get commands from module
                    const moduleCommands = module.commands || module;
                    
                    if (moduleCommands && typeof moduleCommands === 'object') {
                        // Register each command
                        for (const [cmdName, cmdFunc] of Object.entries(moduleCommands)) {
                            if (typeof cmdFunc === 'function' && cmdName !== 'init') {
                                try {
                                    commands.set(cmdName, {
                                        execute: async (sock, message, args, options = {}) => {
                                            try {
                                                return await cmdFunc(sock, message, args, options);
                                            } catch (err) {
                                                logger.error(`Error executing command ${cmdName} from ${name}:`, err);
                                                throw err;
                                            }
                                        },
                                        cooldown: 5,
                                        groupOnly: name === 'group', // Group commands are group-only
                                        category: name
                                    });
                                } catch (err) {
                                    logger.error(`Error registering command ${cmdName} from ${name}:`, err);
                                }
                            }
                        }
                    }
                }
            }
            
            logger.info(`After direct loading: ${commands.size} total commands registered`);
        } catch (err) {
            logger.error('Error loading individual command modules:', err);
        }
        
        // Add basic commands if they don't exist yet
        if (!commands.has('ping')) {
            commands.set('ping', {
                execute: async (sock, message, args, options = {}) => {
                    try {
                        const sender = message.key.remoteJid;
                        await safeSendText(sock, sender, '🏓 Pong! Bot is active and responding.' 
                        );
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
                        await safeSendText(sock, sender, '🏓 Pong! Bot is active and responding.' 
                        );
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
                        await safeSendText(sock, sender, `*Available Commands:*\n\n!ping - Bot status check\n!help - Show this help message`
                        );
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
        const cmdName = commandName.toLowerCase();

        logger.info('Processing command:', {
            command: cmdName,
            args: args,
            sender: sender,
            options: options
        });

        // Try to get command handler from our Map
        const command = commands.get(cmdName);

        if (!command) {
            // If not found in our Map, try to load from modules directly
            try {
                // Load command modules index
                const commandModules = require('../commands/index');
                
                if (commandModules && commandModules.commands && typeof commandModules.commands[cmdName] === 'function') {
                    logger.info(`Executing command ${cmdName} directly from modules`);
                    await commandModules.commands[cmdName](sock, message, args, options);
                    logger.info(`Command ${cmdName} executed successfully from modules`);
                    return;
                } else {
                    await sock.sendMessage(sender, {
                        text: `❌ Unknown command: ${cmdName}\nUse !help to see available commands.`
                    });
                    return;
                }
            } catch (moduleErr) {
                logger.error(`Error trying to execute command ${cmdName} from modules:`, moduleErr);
                await sock.sendMessage(sender, {
                    text: `❌ Unknown command: ${cmdName}\nUse !help to see available commands.`
                });
                return;
            }
        }

        // Check group-only commands
        if (command.groupOnly && !options.isGroup) {
            await safeSendText(sock, sender, '❌ This command can only be used in groups.'
            );
            return;
        }

        // Execute command
        await command.execute(sock, message, args, options);
        logger.info(`Command ${cmdName} executed successfully`);

    } catch (err) {
        logger.error('Command processing error:', {
            error: err.message,
            command: commandText,
            sender: sender,
            stack: err.stack
        });
        
        try {
            await safeSendText(sock, sender, '❌ Command failed. Please try again.\n\nUse !help to see available commands.'
            );
        } catch (sendErr) {
            logger.error('Error sending error message:', sendErr);
        }
    }
}

/**
 * Check if command handler is properly loaded
 * This is used by the message handler to verify command handler status
 */
function isInitialized() {
    return commands.size > 0;
}

// Export module
module.exports = {
    processCommand,
    commands,
    isInitialized,
    loadCommands // Export for testing or manual reloading
};