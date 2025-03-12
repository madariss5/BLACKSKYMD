const { commandLoader } = require('../utils/commandLoader');
const logger = require('../utils/logger');

// Cooldown handling
const cooldowns = new Map();

async function processCommand(sock, message, commandText) {
    try {
        // FAST PATH: Immediate processing of the command
        const [commandName, ...args] = commandText.trim().split(' ');
        const sender = message.key.remoteJid;

        if (!commandName) return; // Skip empty commands immediately

        // Skip full verification for speed - assume command loader is available
        if (!commandLoader?.commands) {
            await sock.sendMessage(sender, { 
                text: '*⚡ Bot initializing...* Please try again in a moment.'
            });
            return;
        }

        // Fast command lookup
        const command = await commandLoader.getCommand(commandName.toLowerCase());
        
        if (!command) {
            // Fast "command not found" response
            await sock.sendMessage(sender, { 
                text: `*❌ Unknown:* ${commandName}\nUse ${process.env.BOT_PREFIX || '.'}help to see commands.`
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

        // Optimized permission check
        const hasPermission = await commandLoader.hasPermission(sender, command.config?.permissions || ['user']);        
        if (!hasPermission) {
            await sock.sendMessage(sender, {
                text: '*⛔ Permission denied.*'
            });
            return;
        }

        // Faster cooldown check with simpler logic
        const { cooldown = 3 } = command.config || {};
        const now = Date.now();
        const timestamps = cooldowns.get(commandName);
        const cooldownAmount = cooldown * 1000;

        if (timestamps?.has(sender)) {
            const expirationTime = timestamps.get(sender) + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = Math.ceil((expirationTime - now) / 1000);
                await sock.sendMessage(sender, { 
                    text: `*⏳ Cooldown:* Wait ${timeLeft}s.`
                });
                return;
            }
            timestamps.delete(sender);
        }

        // Set cooldown and execute immediately without confirmation
        if (!timestamps) {
            cooldowns.set(commandName, new Map());
        }
        cooldowns.get(commandName).set(sender, now);

        // Direct execution without confirmation message
        try {
            await command.execute(sock, message, args);
        } catch (execErr) {
            await sock.sendMessage(sender, {
                text: '*❌ Error:* Command failed. Try again.'
            });
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