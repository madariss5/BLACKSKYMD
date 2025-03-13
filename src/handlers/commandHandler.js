const { commandLoader } = require('../utils/commandLoader');
const logger = require('../utils/logger');
const config = require('../config/config');
const userDatabase = require('../utils/userDatabase');
const { languageManager } = require('../utils/language');

// Initialize command loader
(async () => {
    try {
        logger.info('Initializing command loader...');
        await commandLoader.loadCommandHandlers();
        logger.info(`Command loader initialized with ${commandLoader.commands.size} commands`);
    } catch (err) {
        logger.error('Failed to initialize command loader:', err);
    }
})();

/**
 * Process a command message
 */
async function processCommand(sock, message, commandText) {
    try {
        const prefix = config.bot.prefix || '!';
        const altPrefix = '.';

        // Clean and normalize the command text
        const withoutPrefix = commandText.startsWith(prefix) ? 
            commandText.slice(prefix.length) : 
            (commandText.startsWith(altPrefix) ? commandText.slice(altPrefix.length) : commandText);

        const [commandName, ...args] = withoutPrefix.trim().split(' ');
        const sender = message.key.remoteJid;

        if (!commandName) return;

        logger.debug('Processing command:', {
            original: commandText,
            withoutPrefix,
            commandName,
            args,
            sender
        });

        // Get command object
        const command = await commandLoader.getCommand(commandName.toLowerCase());

        if (!command) {
            logger.warn(`Unknown command attempted: ${commandName}`);
            await sock.sendMessage(sender, { 
                text: `*❌ Unknown command:* ${commandName}\nUse ${prefix}help to see available commands.`
            });
            return;
        }

        // Check if command is disabled
        if (command.config?.disabled) {
            logger.info(`Attempted to use disabled command: ${commandName}`);
            await sock.sendMessage(sender, {
                text: '*⚠️ This command is disabled.*'
            });
            return;
        }

        // Permission check
        const permissions = command.config?.permissions || ['user'];
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
            const ownerNumber = normalizePhoneNumber(process.env.OWNER_NUMBER);

            if (senderNumber !== ownerNumber) {
                logger.warn('Owner permission denied for command:', commandName);
                await sock.sendMessage(sender, {
                    text: '*⛔ Owner permission required.*'
                });
                return;
            }
        }

        // Execute command
        try {
            logger.info(`Executing command: ${commandName}`);
            await command.execute(sock, message, args);
            logger.info(`Command executed successfully: ${commandName}`);
        } catch (err) {
            logger.error('Command execution error:', {
                command: commandName,
                error: err.message,
                stack: err.stack
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
        await sock.sendMessage(sender, { text: '*❌ Error:* Command failed. Try again.' });
    }
}

function getActualSenderId(message) {
    try {
        if (message.key.participant) {
            return message.key.participant;
        }
        return message.key.remoteJid;
    } catch (error) {
        logger.error('Error getting actual sender ID:', error);
        return null;
    }
}

function normalizePhoneNumber(number) {
    if (!number) return '';
    return number.replace(/@s\.whatsapp\.net|@g\.us/g, '').replace(/[^0-9]/g, '').trim();
}

module.exports = { processCommand };