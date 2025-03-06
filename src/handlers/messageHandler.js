const { processCommand } = require('./commandHandler');
const logger = require('../utils/logger');
const config = require('../config/config');

async function messageHandler(sock, message) {
    try {
        console.log('\nReceived message:', message.key.remoteJid);

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

        console.log('Message content:', messageContent);

        // Check if message is a command
        if (messageContent.startsWith(prefix)) {
            const commandText = messageContent.slice(prefix.length).trim();
            if (commandText) {
                console.log('Processing command:', commandText);
                await processCommand(sock, message, commandText);
            }
            return;
        }

        // Only respond to private messages and first-time interactions
        if (!isGroup && !messageContent.startsWith(prefix)) {
            const response = `Welcome! To use the bot, start your message with ${prefix}\nFor example: ${prefix}help`;
            await sock.sendMessage(sender, { text: response });
        }

    } catch (err) {
        console.error('Error in message handler:', err);
    }
}

module.exports = { messageHandler };