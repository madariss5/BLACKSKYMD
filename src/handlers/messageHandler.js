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
            return; // Skip empty messages
        }

        const sender = message.key.remoteJid;
        const isGroup = sender.endsWith('@g.us');
        const prefix = config.bot.prefix;

        // Check if message is a command
        if (messageContent.startsWith(prefix)) {
            const commandText = messageContent.slice(prefix.length).trim();
            if (commandText) {
                await processCommand(sock, message, commandText);
            }
            return;
        }

        // Only respond to private messages, not groups
        if (!isGroup) {
            await handleNormalMessage(sock, sender, messageContent);
        }

    } catch (err) {
        logger.error('Error in message handler:', err);
    }
}

async function handleNormalMessage(sock, sender, content) {
    try {
        if (!content.includes(config.bot.prefix)) {
            // Only send help message for non-command messages
            const response = `To use the bot, start your message with ${config.bot.prefix}\nFor example: ${config.bot.prefix}help`;
            await sock.sendMessage(sender, { text: response });
        }
    } catch (err) {
        logger.error('Error in normal message handler:', err);
    }
}

module.exports = { messageHandler };