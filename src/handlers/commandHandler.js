const commands = require('../commands');
const logger = require('../utils/logger');

async function processCommand(sock, message, commandText) {
    try {
        const [command, ...args] = commandText.trim().split(' ');
        const sender = message.key.remoteJid;

        if (!commands[command]) {
            await sock.sendMessage(sender, { 
                text: `Unknown command: ${command}\nUse !help to see available commands.` 
            });
            return;
        }

        await commands[command](sock, sender, args);

    } catch (err) {
        logger.error('Error processing command:', err);
        await sock.sendMessage(message.key.remoteJid, { 
            text: 'Error processing command. Please try again later.' 
        });
    }
}

module.exports = { processCommand };
