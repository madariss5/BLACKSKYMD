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