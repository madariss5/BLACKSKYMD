const logger = require('../utils/logger');
const config = require('../config/config');

// Simple command storage
const commands = new Map();

// Initialize basic commands with error handling
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

    // Register info command
    commands.set('info', {
        execute: async (sock, message, args) => {
            try {
                const sender = message.key.remoteJid;
                logger.info(`Executing info command for ${sender}`);
                await sock.sendMessage(sender, {
                    text: '*Bot Info*\n\n' +
                          '🤖 BLACKSKY-MD Bot\n' +
                          '📱 A WhatsApp Multi-Device Bot\n' +
                          '🔧 Created with @whiskeysockets/baileys'
                });
                logger.info(`Info command completed for ${sender}`);
            } catch (err) {
                logger.error('Error executing info command:', err);
                throw err;
            }
        }
    });

    logger.info(`Successfully registered ${commands.size} basic commands`);
} catch (err) {
    logger.error('Error initializing commands:', err);
    throw err;
}

/**
 * Process incoming commands
 */
async function processCommand(sock, message, commandText) {
    try {
        const sender = message.key.remoteJid;

        // Skip if no command text
        if (!commandText?.trim()) {
            logger.debug('Empty command text received');
            return;
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
            return;
        }

        // Execute command
        try {
            await command.execute(sock, message, args);
            logger.info(`Command executed successfully: ${commandName}`);
        } catch (execErr) {
            logger.error('Command execution error:', {
                command: commandName,
                error: execErr.message,
                stack: execErr.stack
            });
            await sock.sendMessage(sender, {
                text: '❌ Command failed. Please try again.'
            });
        }

    } catch (err) {
        logger.error('Command processing error:', err);
        try {
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ An error occurred while processing your command.'
            });
        } catch (sendErr) {
            logger.error('Failed to send error message:', sendErr);
        }
    }
}

module.exports = {
    processCommand,
    commands
};