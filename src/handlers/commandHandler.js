const { commandLoader } = require('../utils/commandLoader');
const logger = require('../utils/logger');

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
                text: `Unknown command: ${commandName}\nUse !help to see available commands.` 
            });
            return;
        }

        // Check cooldown
        const { cooldown = 3 } = command.config;
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

        // Execute command
        await command.handler(sock, sender, args);

    } catch (err) {
        logger.error('Error processing command:', err);
        await sock.sendMessage(message.key.remoteJid, { 
            text: 'Error processing command. Please try again later.' 
        });
    }
}

module.exports = { processCommand };