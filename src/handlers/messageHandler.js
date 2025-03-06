const { processCommand } = require('./commandHandler');
const logger = require('../utils/logger');

async function messageHandler(sock, message) {
    try {
        const messageContent = message.message?.conversation || 
                             message.message?.extendedTextMessage?.text || 
                             message.message?.imageMessage?.caption;

        if (!messageContent) return;

        const sender = message.key.remoteJid;

        logger.debug(`Received message: ${messageContent} from ${sender}`);

        // Check if message is a command
        if (messageContent.startsWith('!')) {
            logger.info(`Processing command: ${messageContent}`);
            await processCommand(sock, message, messageContent.slice(1));
            return;
        }

        // Handle normal messages
        await handleNormalMessage(sock, sender, messageContent);

    } catch (err) {
        logger.error('Error in message handler:', err);
        // Send error message to user
        await sock.sendMessage(message.key.remoteJid, { 
            text: 'Sorry, there was an error processing your message. Please try again.' 
        });
    }
}

async function handleNormalMessage(sock, sender, content) {
    try {
        logger.debug(`Handling normal message from ${sender}: ${content}`);
        // Auto-response system
        const response = "Thanks for your message! Use !help to see available commands.";
        await sock.sendMessage(sender, { text: response });
    } catch (err) {
        logger.error('Error in normal message handler:', err);
        throw err;
    }
}

module.exports = { messageHandler };