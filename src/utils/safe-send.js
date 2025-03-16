/**
 * Safe Message Sending Utility
 * Provides reliable message sending with error handling and retry capability
 */

// Track internal statistics
const stats = {
    sent: 0,
    errors: 0,
    retries: 0,
    successfulRetries: 0
};

/**
 * Safely send a text message with error handling and retry
 * @param {Object} sock - WhatsApp socket connection
 * @param {string} jid - Recipient JID
 * @param {string} text - Message text
 * @param {Object} options - Additional options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 2)
 * @param {number} options.retryDelay - Delay between retries in ms (default: 1000)
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendText(sock, jid, text, options = {}) {
    console.log(`[SAFE-SEND] Sending text to ${jid}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
    return safeSendMessage(sock, jid, { text }, options);
}

/**
 * Safely send a WhatsApp message with error handling and retry
 * @param {Object} sock - WhatsApp socket connection
 * @param {string} jid - Recipient JID
 * @param {Object} content - Message content
 * @param {Object} options - Additional options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 2)
 * @param {number} options.retryDelay - Delay between retries in ms (default: 1000)
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendMessage(sock, jid, content, options = {}) {
    const maxRetries = options.maxRetries ?? 2;
    const retryDelay = options.retryDelay ?? 1000;
    
    let lastError = null;
    
    // Try to send the message with retries
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // If this is a retry, log it
            if (attempt > 0) {
                console.log(`[SAFE-SEND] Retry attempt ${attempt}/${maxRetries} for message to ${jid}`);
                stats.retries++;
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
            
            // Send the message
            const result = await sock.sendMessage(jid, content);
            
            // If this was a retry, count it as successful
            if (attempt > 0) {
                stats.successfulRetries++;
            }
            
            // Update stats
            stats.sent++;
            
            console.log(`[SAFE-SEND] Message sent successfully to ${jid}`);
            return result;
        } catch (err) {
            lastError = err;
            stats.errors++;
            console.error(`[SAFE-SEND] Error sending message to ${jid} (attempt ${attempt + 1}/${maxRetries + 1}): ${err.message}`);
        }
    }
    
    // If we reached here, all attempts failed
    console.error(`[SAFE-SEND] All ${maxRetries + 1} attempts failed when sending to ${jid}`);
    return null;
}

/**
 * Safely send a reply to a message with error handling and retry
 * @param {Object} sock - WhatsApp socket connection
 * @param {Object} msg - Original message to reply to
 * @param {string} text - Reply text
 * @param {Object} options - Additional options
 * @param {boolean} options.fallbackToDirectMessage - Whether to fall back to a direct message if reply fails
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendReply(sock, msg, text, options = {}) {
    const fallbackToDirectMessage = options.fallbackToDirectMessage ?? true;
    const jid = msg.key.remoteJid;
    
    console.log(`[SAFE-SEND] Sending reply to ${jid}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
    
    try {
        // Try to send as a reply
        const result = await safeSendMessage(sock, jid, {
            text,
            quoted: msg
        });
        
        return result;
    } catch (err) {
        console.error(`[SAFE-SEND] Error sending reply: ${err.message}`);
        
        // If we should fall back to a direct message
        if (fallbackToDirectMessage) {
            console.log(`[SAFE-SEND] Falling back to direct message`);
            return safeSendText(sock, jid, text);
        }
        
        return null;
    }
}

/**
 * Get messaging statistics
 * @returns {Object} - Current stats
 */
function getStats() {
    return {
        ...stats,
        successRate: stats.sent > 0 
            ? Math.round((stats.sent - stats.errors) / stats.sent * 100) 
            : 100,
        retrySuccessRate: stats.retries > 0
            ? Math.round(stats.successfulRetries / stats.retries * 100)
            : 0
    };
}

/**
 * Reset messaging statistics
 */
function resetStats() {
    stats.sent = 0;
    stats.errors = 0;
    stats.retries = 0;
    stats.successfulRetries = 0;
}

module.exports = {
    safeSendText,
    safeSendMessage,
    safeSendReply,
    getStats,
    resetStats
};