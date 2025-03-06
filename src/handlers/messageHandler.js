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

        if (!messageContent) return;

        const sender = message.key.remoteJid;
        const isGroup = sender.endsWith('@g.us');
        const prefix = config.bot.prefix;

        // Only process messages that start with the command prefix
        if (messageContent.startsWith(prefix)) {
            const commandText = messageContent.slice(prefix.length).trim();
            if (commandText) {
                await processCommand(sock, message, commandText);
            }
            return;
        }

        // Only respond to private messages on first interaction
        if (!isGroup && !messageContent.startsWith(prefix)) {
            const response = `To use the bot, start your message with ${prefix}\nFor example: ${prefix}help`;
            await sock.sendMessage(sender, { text: response });
        }

    } catch (err) {
        logger.error('Error in message handler:', err);
    }
}

module.exports = { messageHandler };