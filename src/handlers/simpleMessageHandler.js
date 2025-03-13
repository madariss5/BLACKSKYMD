/**
 * Simple Message Handler for WhatsApp Bot - Optimized for Speed
 */

// Initialize logger
const logger = console;

// Use Map for faster command lookup
const commands = new Map();

// Add optimized ping command
commands.set('ping', async (sock, message) => {
    try {
        const sender = message.key.remoteJid;
        await sock.sendMessage(sender, { text: '🏓 Pong!' });
    } catch (err) {
        logger.error('Error in ping command:', err);
    }
});

// Add optimized help command
commands.set('help', async (sock, message) => {
    try {
        const sender = message.key.remoteJid;
        const commandList = Array.from(commands.keys())
            .map(name => `!${name}`)
            .join('\n');
        await sock.sendMessage(sender, {
            text: `*Available Commands:*\n\n${commandList}`
        });
    } catch (err) {
        logger.error('Error in help command:', err);
    }
});

// Add menu1 command
commands.set('menu1', async (sock, message) => {
    try {
        const sender = message.key.remoteJid;
        const menuText = `*🤖 Bot Menu*\n
🔰 *Main Commands*
├ !ping - Check bot response
├ !help - Show all commands
├ !menu1 - Show this menu
└ !status - Check bot status

📝 *Usage*
Just type any command starting with "!"
Example: !ping

⚡ *Status*: Active
🔄 *Response*: Fast Mode`;

        await sock.sendMessage(sender, {
            text: menuText
        });
    } catch (err) {
        logger.error('Error in menu1 command:', err);
    }
});

/**
 * Process incoming messages
 */
async function messageHandler(sock, message) {
    try {
        if (!message?.message || !message.key?.remoteJid) return;

        const messageContent = message.message?.conversation ||
                           message.message?.extendedTextMessage?.text ||
                           message.message?.imageMessage?.caption ||
                           message.message?.videoMessage?.caption;

        if (!messageContent) return;

        // Process commands (using ! prefix)
        if (messageContent.startsWith('!')) {
            const commandText = messageContent.slice(1).trim();
            if (!commandText) return;

            const [commandName, ...args] = commandText.split(' ');
            const command = commands.get(commandName.toLowerCase());

            if (!command) {
                const sender = message.key.remoteJid;
                await sock.sendMessage(sender, {
                    text: `❌ Unknown command. Use !help to see available commands.`
                });
                return;
            }

            await command(sock, message, args);
        }
    } catch (err) {
        logger.error('Error in message handler:', err);
        // Try to notify user of error
        try {
            const sender = message.key.remoteJid;
            await sock.sendMessage(sender, {
                text: '❌ Error processing command. Please try again.'
            });
        } catch (_) {
            // Ignore nested errors
        }
    }
}

/**
 * Initialize the handler
 */
async function init() {
    try {
        // Add status command
        commands.set('status', async (sock, message) => {
            try {
                const sender = message.key.remoteJid;
                await sock.sendMessage(sender, { 
                    text: '✅ Bot Online\n⚡ Fast Response Mode' 
                });
            } catch (err) {
                logger.error('Error in status command:', err);
            }
        });

        logger.info('Simple message handler initialized with commands:', Array.from(commands.keys()));
        return true;
    } catch (err) {
        logger.error('Handler initialization error:', err);
        return false;
    }
}

// Export as named exports to prevent undefined issues
module.exports = {
    messageHandler,
    init,
    commands
};