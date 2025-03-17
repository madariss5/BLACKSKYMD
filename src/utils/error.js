/**
 * Error Handler Utility
 * Provides standardized error handling for WhatsApp bot commands
 */

/**
 * Handles errors in WhatsApp bot commands
 * @param {Object} sock - WhatsApp socket connection
 * @param {string} jid - Chat JID where error occurred
 * @param {Error} err - Error object
 * @param {string} message - Error message to display to user
 */
async function handleError(sock, jid, err, message = 'An error occurred while processing your command') {
  // Log the error for debugging
  console.error(`Error in command:`, err);
  
  // Send user-friendly error message
  try {
    await sock.sendMessage(jid, { text: `❌ ${message}` });
  } catch (sendError) {
    console.error('Error sending error message:', sendError);
  }
}

module.exports = { handleError };