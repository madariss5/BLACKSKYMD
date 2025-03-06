const { processCommand } = require('./commandHandler');
const logger = require('../utils/logger');
const config = require('../config/config');

// Cache for help messages to prevent spam
const helpMessageCache = new Map();
const HELP_MESSAGE_COOLDOWN = 5 * 60 * 1000; // 5 minutes

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
        const prefix = config.bot.prefix || '.';

        // Check if message starts with prefix
        if (messageContent.startsWith(prefix)) {
            const commandText = messageContent.slice(prefix.length).trim();
            if (commandText) {
                logger.info(`Processing command: ${commandText} from ${sender}`);
                try {
                    await processCommand(sock, message, commandText);
                } catch (err) {
                    logger.error('Error processing command:', err);
                    await sock.sendMessage(sender, { 
                        text: '❌ Error processing command. Please try again.' 
                    });
                }
            }
        } else if (!isGroup && !message.key.fromMe) {
            // Check if we've sent a help message recently
            const now = Date.now();
            const lastHelpMessage = helpMessageCache.get(sender);

            if (!lastHelpMessage || (now - lastHelpMessage) > HELP_MESSAGE_COOLDOWN) {
                helpMessageCache.set(sender, now);
                const response = `Welcome! To use the bot, start your message with ${prefix}\nExample: ${prefix}help`;
                await sock.sendMessage(sender, { text: response });

                // Clean up old cache entries
                for (const [key, timestamp] of helpMessageCache.entries()) {
                    if (now - timestamp > HELP_MESSAGE_COOLDOWN * 2) { //Clean up older entries to prevent memory leaks.
                        helpMessageCache.delete(key);
                    }
                }
            }
        }

    } catch (err) {
        logger.error('Error in message handler:', err);
    }
}

module.exports = { messageHandler };