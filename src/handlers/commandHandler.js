const { commandLoader } = require('../utils/commandLoader');
const logger = require('../utils/logger');

// Cooldown handling
const cooldowns = new Map();

async function processCommand(sock, message, commandText) {
    try {
        const [commandName, ...args] = commandText.trim().split(' ');
        const sender = message.key.remoteJid;

        console.log(`\nProcessing command: ${commandName} with args:`, args);

        if (!commandName) {
            console.log('Empty command received');
            return;
        }

        // Get command from loader
        const command = commandLoader.getCommand(commandName);
        if (!command) {
            console.log(`Command '${commandName}' not found in registry`);
            await sock.sendMessage(sender, { 
                text: `Unknown command: ${commandName}\nUse .help to see available commands.` 
            });
            return;
        }

        console.log(`Executing command '${commandName}' from category '${command.category}'`);

        // Check if command is disabled
        if (command.config?.disabled) {
            await sock.sendMessage(sender, {
                text: `This command is currently disabled.`
            });
            return;
        }

        // Check permissions
        if (!commandLoader.hasPermission(sender, command.config?.permissions || ['user'])) {
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

        if (timestamps?.has(sender)) {
            const expirationTime = timestamps.get(sender) + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                await sock.sendMessage(sender, { 
                    text: `Please wait ${timeLeft.toFixed(1)} seconds before using ${commandName} again.`
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

        console.log('About to execute command...');

        // Execute command
        await command.execute(sock, message, args);

        console.log('Command executed successfully');

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
        console.error('Error processing command:', err);
        try {
            await sock.sendMessage(message.key.remoteJid, { 
                text: 'Error processing command. Please try again later.' 
            });
        } catch (sendErr) {
            console.error('Failed to send error message:', sendErr);
        }
    }
}

module.exports = { processCommand };