const { commandLoader } = require('../utils/commandLoader');
const logger = require('../utils/logger');
const config = require('../config/config');

// Cooldown handling
const cooldowns = new Map();

async function processCommand(sock, message, commandText) {
    try {
        const [commandName, ...args] = commandText.trim().split(' ');
        const sender = message.key.remoteJid;

        // Get command from loader
        const command = commandLoader.getCommand(commandName);
        if (!command) {
            await sock.sendMessage(sender, { 
                text: `Unknown command: ${commandName}\nUse ${config.bot.prefix}help to see available commands.` 
            });
            return;
        }

        // Check if command is disabled
        if (command.config?.disabled) {
            await sock.sendMessage(sender, {
                text: `This command is currently disabled.`
            });
            return;
        }

        // Check permissions
        if (!commandLoader.hasPermission(commandName, 'user')) {
            await sock.sendMessage(sender, {
                text: 'You do not have permission to use this command.'
            });
            return;
        }

        // Check cooldown
        const { cooldown = 3 } = command.config || {};
        const now = Date.now();
        const timestamps = cooldowns.get(commandName);
        const cooldownAmount = cooldown * 1000;

        if (timestamps && timestamps.has(sender)) {
            const expirationTime = timestamps.get(sender) + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                await sock.sendMessage(sender, { 
                    text: `Please wait ${timeLeft.toFixed(1)} seconds before using ${commandName} again.`
                });
                return;
            }
        }

        // Set cooldown
        if (!timestamps) {
            cooldowns.set(commandName, new Map());
        }
        cooldowns.get(commandName).set(sender, now);
        setTimeout(() => cooldowns.get(commandName).delete(sender), cooldownAmount);

        // Execute command with logging
        logger.info(`Executing command: ${commandName} with args: ${args.join(' ')}`);
        await command.handler(sock, sender, args);
        logger.info(`Command ${commandName} executed successfully`);

    } catch (err) {
        logger.error('Error processing command:', err);
        await sock.sendMessage(message.key.remoteJid, { 
            text: 'Error processing command. Please try again later.' 
        }).catch(err => logger.error('Failed to send error message:', err));
    }
}

module.exports = { processCommand };