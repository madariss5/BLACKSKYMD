// Simple command storage
const commands = new Map();
const logger = require('../utils/logger');

/**
 * Register basic commands
 */
function registerBasicCommands() {
    try {
        // Register ping command
        commands.set('ping', {
            execute: async (sock, message, args) => {
                try {
                    const sender = message.key.remoteJid;
                    logger.info(`Executing ping command for ${sender}`);
                    await sock.sendMessage(sender, {
                        text: '🏓 Pong! Bot is active and responding.'
                    });
                    logger.info(`Ping command completed for ${sender}`);
                } catch (err) {
                    logger.error('Error executing ping command:', err);
                    throw err;
                }
            }
        });

        // Register help command
        commands.set('help', {
            execute: async (sock, message, args) => {
                try {
                    const sender = message.key.remoteJid;
                    logger.info(`Executing help command for ${sender}`);
                    const commandList = Array.from(commands.keys())
                        .map(cmd => `!${cmd}`)
                        .join('\n');
                    await sock.sendMessage(sender, {
                        text: `*Available Commands:*\n\n${commandList}`
                    });
                    logger.info(`Help command completed for ${sender}`);
                } catch (err) {
                    logger.error('Error executing help command:', err);
                    throw err;
                }
            }
        });

        logger.info('Basic commands registered successfully:', {
            registeredCommands: Array.from(commands.keys())
        });
        return true;
    } catch (err) {
        logger.error('Error registering basic commands:', err);
        return false;
    }
}

// Register basic commands immediately
if (!registerBasicCommands()) {
    throw new Error('Failed to register basic commands');
}

/**
 * Process incoming commands
 */
function processCommand(sock, message, commandText) {
    return new Promise(async (resolve, reject) => {
        try {
            const sender = message.key.remoteJid;

            // Skip if no command text
            if (!commandText?.trim()) {
                logger.debug('Empty command text received');
                return resolve();
            }

            // Split command and args
            const [commandName, ...args] = commandText.trim().split(' ');

            logger.info('Processing command:', {
                command: commandName,
                args: args,
                sender: sender
            });

            // Get command handler
            const command = commands.get(commandName.toLowerCase());

            if (!command) {
                logger.warn(`Unknown command attempted: ${commandName}`);
                await sock.sendMessage(sender, {
                    text: `❌ Unknown command: ${commandName}\nUse !help to see available commands.`
                });
                return resolve();
            }

            // Execute command
            await command.execute(sock, message, args);
            logger.info(`Command executed successfully: ${commandName}`);
            resolve();

        } catch (err) {
            logger.error('Command processing error:', err);
            try {
                await sock.sendMessage(message.key.remoteJid, {
                    text: '❌ An error occurred while processing your command.'
                });
            } catch (sendErr) {
                logger.error('Failed to send error message:', sendErr);
            }
            reject(err);
        }
    });
}

// Make processCommand available for testing
processCommand.commands = commands;

module.exports = {
    processCommand,
    commands
};