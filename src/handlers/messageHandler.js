const { processCommand } = require('./commandHandler');
const logger = require('../utils/logger');

async function messageHandler(sock, message) {
    try {
        const messageContent = message.message?.conversation || 
                             message.message?.extendedTextMessage?.text || 
                             message.message?.imageMessage?.caption;
        
        if (!messageContent) return;

        const sender = message.key.remoteJid;
        
        // Check if message is a command
        if (messageContent.startsWith('!')) {
            await processCommand(sock, message, messageContent.slice(1));
            return;
        }

        // Handle normal messages
        await handleNormalMessage(sock, sender, messageContent);

    } catch (err) {
        logger.error('Error in message handler:', err);
        throw err;
    }
}

async function handleNormalMessage(sock, sender, content) {
    try {
        // Auto-response system
        const response = "Thanks for your message! Use !help to see available commands.";
        await sock.sendMessage(sender, { text: response });
    } catch (err) {
        logger.error('Error in normal message handler:', err);
        throw err;
    }
}

module.exports = { messageHandler };
