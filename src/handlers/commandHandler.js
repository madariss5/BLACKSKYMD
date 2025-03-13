const logger = require('../utils/logger');
const config = require('../config/config');

// Simple command storage
const commands = new Map();

// Register basic commands
commands.set('ping', {
    execute: async (sock, message, args) => {
        const sender = message.key.remoteJid;
        logger.info(`Executing ping command for ${sender}`);
        await sock.sendMessage(sender, {
            text: '🏓 Pong! Bot is active and responding.'
        });
        logger.info(`Ping command completed for ${sender}`);
    }
});

commands.set('help', {
    execute: async (sock, message, args) => {
        const sender = message.key.remoteJid;
        logger.info(`Executing help command for ${sender}`);
        const commandList = Array.from(commands.keys())
            .map(cmd => `!${cmd}`)
            .join('\n');
        await sock.sendMessage(sender, {
            text: `*Available Commands:*\n\n${commandList}`
        });
        logger.info(`Help command completed for ${sender}`);
    }
});

commands.set('info', {
    execute: async (sock, message, args) => {
        const sender = message.key.remoteJid;
        logger.info(`Executing info command for ${sender}`);
        await sock.sendMessage(sender, {
            text: '*Bot Info*\n\n' +
                  '🤖 BLACKSKY-MD Bot\n' +
                  '📱 A WhatsApp Multi-Device Bot\n' +
                  '🔧 Created with @whiskeysockets/baileys'
        });
        logger.info(`Info command completed for ${sender}`);
    }
});

/**
 * Process incoming commands
 */
async function processCommand(sock, message, commandText) {
    try {
        const sender = message.key.remoteJid;

        logger.info('Command processing started:', {
            text: commandText,
            sender: sender
        });

        // Skip if no command text
        if (!commandText?.trim()) {
            logger.debug('Empty command text received');
            return;
        }

        // Split command and args
        const [commandName, ...args] = commandText.trim().split(' ');

        logger.info('Command details:', {
            command: commandName,
            args: args,
            sender: sender,
            availableCommands: Array.from(commands.keys())
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
        logger.info(`Executing command: ${commandName}`);
        await command.execute(sock, message, args);
        logger.info(`Command executed successfully: ${commandName}`);

    } catch (err) {
        logger.error('Command processing error:', {
            error: err.message,
            stack: err.stack,
            command: commandText,
            sender: message.key.remoteJid
        });

        await sock.sendMessage(message.key.remoteJid, {
            text: '❌ An error occurred while processing your command. Please try again.'
        });
    }
}

// Export functions
module.exports = {
    processCommand,
    commands
};