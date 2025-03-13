const logger = require('../utils/logger');
const config = require('../config/config');
const { processCommand } = require('./commandHandler');

// Initialize message handler
async function init() {
    try {
        logger.info('Starting message handler initialization...');

        // Debug logging for dependencies
        logger.info('Command handler check:', {
            hasProcessCommand: typeof processCommand === 'function',
            hasCommands: !!processCommand.commands,
            commandCount: processCommand.commands?.size,
            prefix: config?.bot?.prefix || '!'
        });

        // Verify minimum requirements
        if (typeof processCommand !== 'function') {
            logger.error('Command processor validation failed:', {
                type: typeof processCommand,
                value: processCommand
            });
            return false;
        }

        if (!config?.bot?.prefix) {
            logger.warn('Bot prefix not found in config, using default: !');
        }

        logger.info('Message handler initialization completed');
        return true;
    } catch (err) {
        logger.error('Message handler initialization failed:', err);
        logger.error('Stack trace:', err.stack);
        return false;
    }
}

async function messageHandler(sock, message) {
    try {
        // Skip if no message content
        if (!message?.message) {
            return;
        }

        // Get message content
        const messageContent = message.message?.conversation ||
                             message.message?.extendedTextMessage?.text ||
                             message.message?.imageMessage?.caption ||
                             message.message?.videoMessage?.caption;

        // Get sender information
        const sender = message.key.remoteJid;
        if (!sender) {
            return;
        }

        // Skip empty messages
        if (!messageContent) {
            return;
        }

        // Get prefix from config
        const prefix = config?.bot?.prefix || '!';

        // Process commands
        if (messageContent.startsWith(prefix)) {
            const commandText = messageContent.slice(prefix.length).trim();
            if (commandText) {
                logger.info('Processing command:', {
                    text: commandText,
                    sender: sender
                });

                try {
                    await processCommand(sock, message, commandText);
                } catch (err) {
                    logger.error('Command execution failed:', err);
                    await sock.sendMessage(sender, {
                        text: '❌ Command failed. Please try again.\n\nUse !help to see available commands.'
                    });
                }
            }
        }
    } catch (err) {
        logger.error('Error in message handler:', err);
    }
}

module.exports = { 
    messageHandler,
    init 
};