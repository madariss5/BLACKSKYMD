const logger = require('../utils/logger');

// Command storage
const commands = new Map();

// Register basic commands
try {
    logger.info('Registering basic commands...');

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

    logger.info('Basic commands registered successfully:', {
        commandCount: commands.size,
        availableCommands: Array.from(commands.keys())
    });
} catch (err) {
    logger.error('Error registering basic commands:', err);
    logger.error('Stack trace:', err.stack);
    throw err;
}

/**
 * Process incoming commands
 */
function processCommand(sock, message, commandText, options = {}) {
    return new Promise(async (resolve, reject) => {
        try {
            const sender = message.key.remoteJid;

            // Skip if no command text
            if (!commandText?.trim()) {
                return resolve();
            }

            // Split command and args
            const [commandName, ...args] = commandText.trim().split(' ');

            // Get command handler
            const command = commands.get(commandName.toLowerCase());

            if (!command) {
                await sock.sendMessage(sender, {
                    text: `❌ Unknown command: ${commandName}\nUse !help to see available commands.`
                });
                return resolve();
            }

            // Check group-only commands
            if (command.groupOnly && !options.isGroup) {
                await sock.sendMessage(sender, {
                    text: '❌ This command can only be used in groups.'
                });
                return resolve();
            }

            // Execute command
            await command.execute(sock, message, args, options);
            resolve();

        } catch (err) {
            logger.error('Command processing error:', {
                error: err.message,
                stack: err.stack
            });
            reject(err);
        }
    });
}

// Export the module
module.exports = {
    processCommand,
    commands
};