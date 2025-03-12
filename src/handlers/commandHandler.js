const { commandLoader } = require('../utils/commandLoader');
const logger = require('../utils/logger');

// Cooldown handling
const cooldowns = new Map();

async function processCommand(sock, message, commandText) {
    try {
        console.log('============ COMMAND PROCESSOR CALLED ============');
        console.log(`Command text received: "${commandText}"`);
        
        const [commandName, ...args] = commandText.trim().split(' ');
        const sender = message.key.remoteJid;

        console.log(`Processing command: ${commandName} with args:`, args);
        console.log(`Sender JID: ${sender}`);

        if (!commandName) {
            console.log('Empty command received');
            return;
        }

        // Verify the command loader is initialized
        if (!commandLoader || !commandLoader.commands || commandLoader.commands.size === 0) {
            console.error('Command loader not initialized or no commands found');
            await sock.sendMessage(sender, { 
                text: '*❌ Error:* Bot command system is not fully initialized. Please try again in a moment.'
            });
            return;
        }

        // Get command from loader
        console.log(`Looking up command: ${commandName.toLowerCase()}`);
        const command = await commandLoader.getCommand(commandName.toLowerCase());
        
        if (!command) {
            console.log(`Command '${commandName}' not found`);
            // Send test message to check if sending works
            await sock.sendMessage(sender, { 
                text: `*❌ Unknown Command:* ${commandName}\n\nUse ${process.env.BOT_PREFIX || '.'}help to see available commands.` 
            });
            console.log('Sent "command not found" message');
            return;
        }

        console.log(`Found command '${commandName}' in category '${command.category}'`);

        // Check if command is disabled
        if (command.config?.disabled) {
            console.log(`Command ${commandName} is disabled`);
            await sock.sendMessage(sender, {
                text: '*⚠️ This command is currently disabled.*'
            });
            return;
        }

        // Check permissions
        const hasPermission = await commandLoader.hasPermission(sender, command.config?.permissions || ['user']);
        console.log(`Permission check for ${commandName}: ${hasPermission ? 'granted' : 'denied'}`);
        
        if (!hasPermission) {
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
                console.log(`Command ${commandName} is on cooldown for ${timeLeft.toFixed(1)} seconds`);
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

        console.log(`Executing command ${commandName}...`);
        
        // Send a direct response to confirm command received (for testing)
        try {
            await sock.sendMessage(sender, { 
                text: `Executing command: ${commandName}...` 
            });
            console.log('Sent execution confirmation message');
        } catch (sendErr) {
            console.error('Error sending confirmation:', sendErr);
        }

        // Execute command with enhanced error handling
        try {
            await command.execute(sock, message, args);
            console.log(`Command ${commandName} executed successfully`);
        } catch (execErr) {
            console.error(`Command execution error for ${commandName}:`, execErr);
            
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