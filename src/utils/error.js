const logger = require('./logger');

/**
 * Handles errors in WhatsApp bot commands
 * @param {Object} sock - WhatsApp socket connection
 * @param {string} jid - Chat JID where error occurred
 * @param {Error} err - Error object
 * @param {string} message - Error message to display to user
 */
const handleError = async (sock, jid, err, message) => {
    logger.error(`${message}:`, err.message);
    logger.error('Stack trace:', err.stack);
    await sock.sendMessage(jid, { text: `❌ ${message}` });
};

module.exports = {
    handleError
};
