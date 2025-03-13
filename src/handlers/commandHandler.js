const { commandLoader } = require('../utils/commandLoader');
const logger = require('../utils/logger');
const config = require('../config/config');
const userDatabase = require('../utils/userDatabase');
const { languageManager } = require('../utils/language');

// Cooldown handling
const cooldowns = new Map();

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

// Helper function to normalize phone numbers for comparison
function normalizePhoneNumber(number) {
    if (!number) return '';
    // Remove any WhatsApp suffix and clean the number
    return number.replace(/@s\.whatsapp\.net|@g\.us/g, '').replace(/[^0-9]/g, '').trim();
}

// Helper function to get actual sender ID
function getActualSenderId(message) {
    try {
        // For group messages, use the participant field
        if (message.key.participant) {
            const sender = message.key.participant;
            logger.debug('Group message sender:', sender);
            return sender;
        }

        // For private messages, use the remoteJid
        const sender = message.key.remoteJid;
        logger.debug('Private message sender:', sender);
        return sender;
    } catch (error) {
        logger.error('Error getting actual sender ID:', error);
        return null;
    }
}

async function processCommand(sock, message, commandText) {
    try {
        // Get both prefixes
        const prefix = config.bot.prefix || '!';
        const altPrefix = '.'; // Allow both . and ! prefixes

        // Clean and normalize the command text
        const withoutPrefix = commandText.startsWith(prefix) ? 
            commandText.slice(prefix.length) : 
            (commandText.startsWith(altPrefix) ? commandText.slice(altPrefix.length) : commandText);

        const [commandName, ...args] = withoutPrefix.trim().split(' ');
        const sender = message.key.remoteJid;

        if (!commandName) return; // Skip empty commands

        logger.debug('Processing command:', {
            original: commandText,
            withoutPrefix,
            commandName,
            args,
            sender
        });

        // Skip full verification for speed - assume command loader is available
        if (!commandLoader?.commands) {
            await sock.sendMessage(sender, { 
                text: '*⏳ Bot initializing...* Please try again in a moment.'
            });
            return;
        }

        // Fast command lookup
        const command = await commandLoader.getCommand(commandName.toLowerCase());

        if (!command) {
            await sock.sendMessage(sender, { 
                text: `*❌ Unknown command:* ${commandName}\nUse ${prefix}help to see available commands.`
            });
            return;
        }

        // Quick check for disabled commands
        if (command.config?.disabled) {
            await sock.sendMessage(sender, {
                text: '*⚠️ This command is disabled.*'
            });
            return;
        }

        // Enhanced permission check with better owner validation
        const permissions = command.config?.permissions || ['user'];

        // Special handling for owner permissions
        if (permissions.includes('owner')) {
            const actualSenderId = getActualSenderId(message);
            if (!actualSenderId) {
                logger.error('Could not determine sender ID for permission check');
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* Could not verify permissions.'
                });
                return;
            }

            const senderNumber = normalizePhoneNumber(actualSenderId);
            const ownerNumber = normalizePhoneNumber(config.owner.number);

            logger.debug('Owner Permission Check:', {
                rawSenderId: actualSenderId,
                normalizedSender: senderNumber,
                configOwnerNumber: config.owner.number,
                normalizedOwner: ownerNumber,
                matches: senderNumber === ownerNumber,
                messageKey: message.key
            });

            if (senderNumber !== ownerNumber) {
                logger.warn('Owner permission denied:', {
                    senderNumber,
                    ownerNumber,
                    command: commandName,
                    actualSenderId
                });
                await sock.sendMessage(sender, {
                    text: '*⛔ Owner permission required.*'
                });
                return;
            }
        }

        // Execute the command
        try {
            await command.execute(sock, message, args);
        } catch (execErr) {
            logger.error('Command execution error:', {
                command: commandName,
                error: execErr.message,
                stack: execErr.stack
            });
            await sock.sendMessage(sender, {
                text: '*❌ Error:* Command failed. Try again.'
            });
        }

    } catch (err) {
        logger.error('Error processing command:', {
            error: err.message,
            stack: err.stack,
            command: commandText
        });
        try {
            const errorJid = sender.includes('@g.us') ? sender : sender;
            await sock.sendMessage(errorJid, { text: '*❌ Error:* Command failed. Try again.' });
        } catch (sendErr) {
            logger.error('Failed to send error message:', sendErr);
        }
    }
}

module.exports = { processCommand, getUserLanguage };