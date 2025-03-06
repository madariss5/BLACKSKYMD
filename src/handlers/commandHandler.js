const { commandLoader } = require('../utils/commandLoader');
const logger = require('../utils/logger');

// Cooldown handling
const cooldowns = new Map();

async function processCommand(sock, message, commandText) {
    try {
        const [commandName, ...args] = commandText.trim().split(' ');
        const sender = message.key.remoteJid;

        logger.info(`Processing command: ${commandName} with args:`, args);

        if (!commandName) {
            logger.warn('Empty command received');
            return;
        }

        // Get command from loader
        const command = await commandLoader.getCommand(commandName.toLowerCase());
        if (!command) {
            logger.warn(`Command '${commandName}' not found`);
            await sock.sendMessage(sender, { 
                text: `*❌ Unknown Command:* ${commandName}\n\nUse ${process.env.BOT_PREFIX || '.'}help to see available commands.` 
            });
            return;
        }

        logger.info(`Found command '${commandName}' in category '${command.category}'`);

        // Check if command is disabled
        if (command.config?.disabled) {
            await sock.sendMessage(sender, {
                text: '*⚠️ This command is currently disabled.*'
            });
            return;
        }

        // Check permissions
        if (!await commandLoader.hasPermission(sender, command.config?.permissions || ['user'])) {
            await sock.sendMessage(sender, {
                text: '*⛔ You do not have permission to use this command.*'
            });
            return;
        }

        // Check cooldown
        const { cooldown = 3 } = command.config || {};
        const now = Date.now();
        const timestamps = cooldowns.get(commandName);
        const cooldownAmount = cooldown * 1000;

        if (timestamps?.has(sender)) {
            const expirationTime = timestamps.get(sender) + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                await sock.sendMessage(sender, { 
                    text: `*⏳ Cooldown:* Please wait ${timeLeft.toFixed(1)} seconds before using ${commandName} again.`
                });
                return;
            }
            timestamps.delete(sender);
        }

        // Set cooldown
        if (!timestamps) {
            cooldowns.set(commandName, new Map());
        }
        cooldowns.get(commandName).set(sender, now);

        logger.info('Executing command...');

        // Execute command with enhanced error handling
        try {
            await command.execute(sock, message, args);
            logger.info('Command executed successfully');
        } catch (execErr) {
            logger.error('Command execution error:', {
                command: commandName,
                error: execErr.message,
                stack: execErr.stack
            });
            await sock.sendMessage(sender, {
                text: '*❌ Error:* Failed to execute command. Please try again later.'
            });
            return;
        }

        // Remove cooldown after command execution
        setTimeout(() => {
            const timestamps = cooldowns.get(commandName);
            if (timestamps) {
                timestamps.delete(sender);
                if (timestamps.size === 0) {
                    cooldowns.delete(commandName);
                }
            }
        }, cooldownAmount);

    } catch (err) {
        logger.error('Error processing command:', {
            error: err.message,
            stack: err.stack,
            command: commandText
        });
        try {
            await sock.sendMessage(message.key.remoteJid, { 
                text: '*❌ Error:* Failed to process command. Please try again.' 
            });
        } catch (sendErr) {
            logger.error('Failed to send error message:', sendErr);
        }
    }
}

module.exports = { processCommand };