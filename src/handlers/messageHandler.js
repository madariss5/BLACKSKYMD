const { processCommand } = require('./commandHandler');
const logger = require('../utils/logger');
const config = require('../config/config');

async function messageHandler(sock, message) {
    try {
        // Extract message content with support for different message types
        const messageContent = message.message?.conversation || 
                           message.message?.extendedTextMessage?.text || 
                           message.message?.imageMessage?.caption ||
                           message.message?.videoMessage?.caption;

        if (!messageContent) {
            logger.debug('Received message without text content');
            return;
        }

        const sender = message.key.remoteJid;
        const isGroup = sender.endsWith('@g.us');
        const prefix = config.bot.prefix;

        logger.debug(`Received message: ${messageContent} from ${sender}`);

        // Check if message is a command
        if (messageContent.startsWith(prefix)) {
            logger.info(`Processing command: ${messageContent}`);
            const commandText = messageContent.slice(prefix.length).trim();
            await processCommand(sock, message, commandText);
            return;
        }

        // Handle normal messages
        await handleNormalMessage(sock, sender, messageContent, isGroup);

    } catch (err) {
        logger.error('Error in message handler:', err);
        // Send error message to user
        try {
            await sock.sendMessage(message.key.remoteJid, { 
                text: 'Sorry, there was an error processing your message. Please try again.' 
            });
        } catch (sendErr) {
            logger.error('Failed to send error message:', sendErr);
        }
    }
}

async function handleNormalMessage(sock, sender, content, isGroup) {
    try {
        logger.debug(`Handling normal message from ${sender}: ${content}`);

        // Group-specific handling
        if (isGroup) {
            // Add group-specific logic here
            return;
        }

        // Auto-response system for private messages
        const response = `Thanks for your message! Use ${config.bot.prefix}help to see available commands.`;
        await sock.sendMessage(sender, { text: response });
    } catch (err) {
        logger.error('Error in normal message handler:', err);
        throw err;
    }
}

module.exports = { messageHandler };