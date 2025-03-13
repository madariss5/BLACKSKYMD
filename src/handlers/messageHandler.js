const logger = require('../utils/logger');
const { processCommand } = require('./commandHandler');
const config = require('../config/config');
const { languageManager } = require('../utils/language');
const levelingSystem = require('../utils/levelingSystem');
const userDatabase = require('../utils/userDatabase');
const menuCommands = require('../commands/menu').commands;

/**
 * Main message handler for WhatsApp messages
 * @param {Object} sock - WhatsApp socket connection
 * @param {Object} message - Message object from WhatsApp
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
                    // Split command and arguments
                    const [cmd, ...args] = commandText.split(' ');

                    // Log command details for debugging
                    logger.info('Command details:', {
                        command: cmd,
                        args: args,
                        sender: sender,
                        messageType: message.message ? Object.keys(message.message)[0] : 'unknown'
                    });

                    // Check for menu commands first
                    if (menuCommands && menuCommands[cmd]) {
                        logger.info(`Executing menu command: ${cmd}`);
                        await menuCommands[cmd](sock, message, args);
                        return;
                    }

                    // Process other commands
                    await processCommand(sock, message, commandText);
                } catch (err) {
                    logger.error('Command execution failed:', {
                        error: err.message,
                        stack: err.stack,
                        command: commandText,
                        sender: sender
                    });

                    await sock.sendMessage(sender, { 
                        text: '*❌ Command failed.* Please try again.\n\nUse !help to see available commands.' 
                    });
                }
            }
            return;
        }

        // For non-command messages, check if we should update user XP
        if (!sender.endsWith('@g.us')) { // Only for private chats
            try {
                await levelingSystem.updateUserXP(sender);
            } catch (err) {
                logger.error('Error updating user XP:', err);
            }
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

/**
 * Determines the user's preferred language
 * @param {string} sender - The sender's JID
 * @returns {string} The language code (e.g., 'en', 'de')
 */
function getUserLanguage(sender) {
    try {
        // Check if user has a profile with language preference
        const userProfile = userDatabase.getUserProfile(sender);

        if (userProfile && userProfile.language) {
            logger.debug(`User ${sender} has language preference: ${userProfile.language}`);
            return userProfile.language;
        }

        // Fallback to bot default language
        logger.debug(`User ${sender} has no language preference, using default: ${config.bot.language || 'en'}`);
        return config.bot.language || 'en';
    } catch (err) {
        logger.error(`Error determining language for user ${sender}:`, err);
        return 'en'; // Default fallback
    }
}

module.exports = { messageHandler };