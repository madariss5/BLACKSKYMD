/**
 * Safe Message Sending Utility
 * Provides reliable message sending with enhanced JID validation, error handling and retry capability
 */

// Track internal statistics
const stats = {
    sent: 0,
    errors: 0,
    retries: 0,
    successfulRetries: 0,
    validationErrors: 0
};

// Import JID helper utility if available, otherwise use built-in fallback functions
let jidHelper;
try {
    jidHelper = require('./jidHelper');
} catch (error) {
    console.log('[SAFE-SEND] jidHelper module not found, using built-in validation');
    jidHelper = {
        ensureJidString: (jid) => jid ? String(jid) : '',
        formatJidForLogging: (jid) => {
            if (!jid) return '<null>';
            try {
                return String(jid);
            } catch (err) {
                return `<invalid:${typeof jid}>`;
            }
        }
    };
}

/**
 * Validate a JID for message sending
 * @param {any} jid - JID to validate
 * @returns {Object} - Validation result {valid: boolean, message: string, normalizedJid: string}
 */
function validateJid(jid) {
    if (!jid) {
        return { valid: false, message: 'JID is null or undefined', normalizedJid: null };
    }
    
    // Handle case where JID is an object (common error case)
    if (typeof jid === 'object' && jid !== null) {
        // Check if it's a message object with key.remoteJid
        if (jid.key && jid.key.remoteJid) {
            console.log(`[SAFE-SEND] Converting message object to JID: ${jid.key.remoteJid}`);
            jid = jid.key.remoteJid;
        } 
        // If it has remoteJid property directly
        else if (jid.remoteJid) {
            console.log(`[SAFE-SEND] Converting object with remoteJid to JID: ${jid.remoteJid}`);
            jid = jid.remoteJid;
        }
        // If it's a participant object
        else if (jid.id) {
            console.log(`[SAFE-SEND] Converting participant object to JID: ${jid.id}`);
            jid = jid.id;
        }
        // Last fallback - try to convert object to string
        else {
            console.warn(`[SAFE-SEND] Received object instead of JID string: ${JSON.stringify(jid)}`);
            try {
                jid = String(jid);
            } catch (err) {
                return { valid: false, message: `Cannot convert object to JID: ${err.message}`, normalizedJid: null };
            }
        }
    }
    
    // Convert to string
    const stringJid = jidHelper.ensureJidString(jid);
    
    // Basic validation
    if (!stringJid || stringJid.length < 5) {
        return { valid: false, message: 'JID too short', normalizedJid: null };
    }
    
    // Check for @ symbol
    if (!stringJid.includes('@')) {
        return { valid: false, message: 'JID missing @ symbol', normalizedJid: null };
    }
    
    // Check for correct suffixes
    const isGroup = stringJid.endsWith('@g.us');
    const isUser = stringJid.endsWith('@s.whatsapp.net') || stringJid.endsWith('@c.us');
    
    if (!isGroup && !isUser) {
        return { valid: false, message: 'JID has invalid suffix', normalizedJid: null };
    }
    
    // Convert @c.us to @s.whatsapp.net if needed
    let normalizedJid = stringJid;
    if (stringJid.endsWith('@c.us')) {
        normalizedJid = stringJid.replace('@c.us', '@s.whatsapp.net');
    }
    
    return { valid: true, message: 'Valid JID', normalizedJid };
}

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
    if (!text) {
        console.warn('[SAFE-SEND] Empty text message, using placeholder');
        text = '...';
    }
    
    console.log(`[SAFE-SEND] Sending text to ${jidHelper.formatJidForLogging(jid)}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
    return safeSendMessage(sock, jid, { text }, options);
}

/**
 * Safely send a WhatsApp message with enhanced JID validation, error handling and retry
 * @param {Object} sock - WhatsApp socket connection
 * @param {string|Object} jid - Recipient JID
 * @param {Object} content - Message content
 * @param {Object} options - Additional options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 2)
 * @param {number} options.retryDelay - Delay between retries in ms (default: 1000)
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendMessage(sock, jid, content, options = {}) {
    // First validate the sock
    if (!sock) {
        console.error('[SAFE-SEND] Socket is null or undefined');
        return null;
    }
    
    // Then validate the JID
    const validation = validateJid(jid);
    if (!validation.valid) {
        console.error(`[SAFE-SEND] Invalid JID: ${validation.message} (${jidHelper.formatJidForLogging(jid)})`);
        stats.validationErrors++;
        return null;
    }
    
    // Validated JID
    const validJid = validation.normalizedJid;
    const maxRetries = options.maxRetries ?? 2;
    const retryDelay = options.retryDelay ?? 1000;
    
    let lastError = null;
    
    // Try to send the message with retries
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // If this is a retry, log it
            if (attempt > 0) {
                console.log(`[SAFE-SEND] Retry attempt ${attempt}/${maxRetries} for message to ${validJid}`);
                stats.retries++;
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
            
            // Send the message
            const result = await sock.sendMessage(validJid, content);
            
            // If this was a retry, count it as successful
            if (attempt > 0) {
                stats.successfulRetries++;
            }
            
            // Update stats
            stats.sent++;
            
            console.log(`[SAFE-SEND] Message sent successfully to ${validJid}`);
            return result;
        } catch (err) {
            lastError = err;
            stats.errors++;
            console.error(`[SAFE-SEND] Error sending message to ${validJid} (attempt ${attempt + 1}/${maxRetries + 1}): ${err.message}`);
        }
    }
    
    // If we reached here, all attempts failed
    console.error(`[SAFE-SEND] All ${maxRetries + 1} attempts failed when sending to ${validJid}`);
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
    if (!msg || !msg.key || !msg.key.remoteJid) {
        console.error('[SAFE-SEND] Invalid message object for reply, missing key.remoteJid');
        return null;
    }

    const fallbackToDirectMessage = options.fallbackToDirectMessage ?? true;
    const jid = msg.key.remoteJid;
    
    if (!text) {
        console.warn('[SAFE-SEND] Empty reply text, using placeholder');
        text = '...';
    }
    
    console.log(`[SAFE-SEND] Sending reply to ${jidHelper.formatJidForLogging(jid)}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
    
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
 * Safely send an image message
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - Recipient JID
 * @param {Buffer|string} image - Image buffer or URL
 * @param {string} caption - Caption text
 * @param {Object} options - Additional options
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendImage(sock, jid, image, caption = '', options = {}) {
    if (!image) {
        console.error('[SAFE-SEND] Missing image data');
        return null;
    }
    
    const content = { 
        image: image,
        caption: caption || ''
    };
    
    console.log(`[SAFE-SEND] Sending image to ${jidHelper.formatJidForLogging(jid)}${caption ? ': ' + caption.substring(0, 30) + (caption.length > 30 ? '...' : '') : ''}`);
    return safeSendMessage(sock, jid, content, options);
}

/**
 * Safely send a video or GIF message
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - Recipient JID
 * @param {Buffer|string} video - Video buffer or URL
 * @param {string} caption - Caption text
 * @param {Object} options - Additional options
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendVideo(sock, jid, video, caption = '', options = {}) {
    if (!video) {
        console.error('[SAFE-SEND] Missing video data');
        return null;
    }
    
    const content = { 
        video: video,
        caption: caption || '',
        gifPlayback: options.gifPlayback ?? false
    };
    
    console.log(`[SAFE-SEND] Sending video to ${jidHelper.formatJidForLogging(jid)}${caption ? ': ' + caption.substring(0, 30) + (caption.length > 30 ? '...' : '') : ''}`);
    return safeSendMessage(sock, jid, content, options);
}

/**
 * Safely send an animated GIF message
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - Recipient JID
 * @param {Buffer|string} gif - GIF buffer or URL
 * @param {string} caption - Caption text
 * @param {Object} options - Additional options
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendAnimatedGif(sock, jid, gif, caption = '', options = {}) {
    if (!gif) {
        console.error('[SAFE-SEND] Missing GIF data');
        return null;
    }
    
    const gifOptions = {
        ...options,
        gifPlayback: true
    };
    
    console.log(`[SAFE-SEND] Sending animated GIF to ${jidHelper.formatJidForLogging(jid)}${caption ? ': ' + caption.substring(0, 30) + (caption.length > 30 ? '...' : '') : ''}`);
    return safeSendVideo(sock, jid, gif, caption, gifOptions);
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
            : 0,
        validationErrorRate: (stats.validationErrors + stats.sent) > 0
            ? Math.round(stats.validationErrors / (stats.validationErrors + stats.sent) * 100)
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
    stats.validationErrors = 0;
}

module.exports = {
    safeSendText,
    safeSendMessage,
    safeSendReply,
    safeSendImage,
    safeSendVideo,
    safeSendAnimatedGif,
    validateJid,
    getStats,
    resetStats
};