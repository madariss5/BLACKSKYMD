const logger = require('../utils/logger');
const { processCommand } = require('./commandHandler');
const config = require('../config/config');

/**
 * Main message handler for WhatsApp messages
 */
async function messageHandler(sock, message) {
    try {
        // FAST PATH: Skip protocol messages immediately
        if (message.message?.protocolMessage) {
            return;
        }

        // Extract message content with optimized path for common types
        let messageContent;

        // Fast path for most common message types (ordered by frequency)
        if (message.message?.conversation) {
            messageContent = message.message.conversation;
        } else if (message.message?.extendedTextMessage?.text) {
            messageContent = message.message.extendedTextMessage.text;
        } else if (message.message?.imageMessage?.caption) {
            messageContent = message.message.imageMessage.caption;
        } else if (message.message?.videoMessage?.caption) {
            messageContent = message.message.videoMessage.caption;
        } else {
            // For other message types that don't contain text
            messageContent = null;
        }

        // Get sender information
        const sender = message.key.remoteJid;
        if (!sender) {
            logger.warn('Message without remoteJid, skipping');
            return;
        }

        const prefix = config.bot.prefix || '!';

        // FAST PATH: Skip empty messages immediately
        if (!messageContent) return;

        logger.debug(`Received message from ${sender}: ${messageContent}`);

        // Command processing
        if (messageContent.startsWith(prefix)) {
            const commandText = messageContent.slice(prefix.length).trim();
            if (commandText) {
                logger.info(`Processing command: ${commandText} from ${sender}`);
                try {
                    await processCommand(sock, message, commandText);
                } catch (err) {
                    logger.error('Command execution failed:', err);
                    await sock.sendMessage(sender, { 
                        text: '*❌ Command failed.* Please try again.\n\nUse !help to see available commands.' 
                    });
                }
            }
            return;
        }

    } catch (err) {
        logger.error('Error in message handler:', {
            name: err.name,
            message: err.message,
            stack: err.stack,
            sender: message?.key?.remoteJid,
            messageContent: messageContent
        });
    }
}

module.exports = { messageHandler };