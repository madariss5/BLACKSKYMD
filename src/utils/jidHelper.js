/**
 * JID Helper Utility - Safe WhatsApp JID functions
 * Prevents "jid.endsWith is not a function" error
 */

/**
 * Safely check if a JID is a group JID - High-performance optimized
 * @param {any} jid - JID to check
 * @returns {boolean} - Whether the JID is a group
 */
function isJidGroup(jid) {
    if (!jid) return false;
    const stringJid = String(jid);
    return stringJid.endsWith('@g.us');
}

/**
 * Safely check if a JID is a user JID - High-performance optimized
 * @param {any} jid - JID to check
 * @returns {boolean} - Whether the JID is a user
 */
function isJidUser(jid) {
    if (!jid) return false;
    const stringJid = String(jid);
    return stringJid.endsWith('@s.whatsapp.net');
}

/**
 * Normalize a JID to ensure it's properly formatted - High-performance optimized
 * @param {any} jid - JID to normalize
 * @returns {string} - Normalized JID
 */
function normalizeJid(jid) {
    if (!jid) return '';
    
    const stringJid = String(jid);
    if (stringJid.endsWith('@c.us')) {
        return stringJid.replace('@c.us', '@s.whatsapp.net');
    }
    
    return stringJid;
}

/**
 * Ensure a JID is a string - High-performance optimized
 * @param {any} jid - The JID to stringify
 * @returns {string} - The JID as a string or empty string if invalid
 */
function ensureJidString(jid) {
    if (!jid) return '';
    return String(jid);
}

/**
 * Extract user ID from JID - High-performance optimized
 * @param {any} jid - The JID to extract from
 * @returns {string} - User ID portion of the JID
 */
function extractUserIdFromJid(jid) {
    if (!jid) return '';
    
    const stringJid = String(jid);
    const atIndex = stringJid.indexOf('@');
    
    if (atIndex !== -1) {
        return stringJid.substring(0, atIndex);
    }
    
    return stringJid;
}

/**
 * Format a JID for logging to prevent [object Object] - High-performance optimized
 * @param {any} jid - JID to format for log messages
 * @returns {string} - Formatted JID safe for logging
 */
function formatJidForLogging(jid) {
    if (!jid) return '<null>';
    
    try {
        return String(jid);
    } catch (err) {
        return `<invalid:${typeof jid}>`;
    }
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
            console.log(`[JID-HELPER] Converting message object to JID: ${jid.key.remoteJid}`);
            jid = jid.key.remoteJid;
        } 
        // If it has remoteJid property directly
        else if (jid.remoteJid) {
            console.log(`[JID-HELPER] Converting object with remoteJid to JID: ${jid.remoteJid}`);
            jid = jid.remoteJid;
        }
        // If it's a participant object
        else if (jid.id) {
            console.log(`[JID-HELPER] Converting participant object to JID: ${jid.id}`);
            jid = jid.id;
        }
        // Last fallback - try to convert object to string
        else {
            console.warn(`[JID-HELPER] Received object instead of JID string: ${JSON.stringify(jid)}`);
            try {
                jid = String(jid);
            } catch (err) {
                return { valid: false, message: `Cannot convert object to JID: ${err.message}`, normalizedJid: null };
            }
        }
    }
    
    // Convert to string
    const stringJid = ensureJidString(jid);
    
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
 * Safe message sending with enhanced JID validation and error handling
 * Fixed to address "Cannot destructure property 'user'" error
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {Object} content - Message content
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendMessage(sock, jid, content) {
    // First validate the sock
    if (!sock) {
        console.error('[JID-HELPER] Socket is null or undefined');
        return null;
    }
    
    // Then validate the JID
    const validation = validateJid(jid);
    if (!validation.valid) {
        console.error(`[JID-HELPER] Invalid JID: ${validation.message} (${formatJidForLogging(jid)})`);
        return null;
    }
    
    // Validated JID
    const validJid = validation.normalizedJid;
    
    try {
        // Use a timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Message sending timed out')), 10000)
        );
        
        // Race between message sending and timeout
        return await Promise.race([
            sock.sendMessage(validJid, content),
            timeoutPromise
        ]);
    } catch (err) {
        console.error(`[JID-HELPER] Error sending message to ${formatJidForLogging(jid)}: ${err.message}`);
        
        // If the error is related to jidDecode, log additional information
        if (err.message.includes('jidDecode') || err.message.includes('Cannot destructure property')) {
            console.error(`[JID-HELPER] JID decode error with ${formatJidForLogging(jid)}, this may indicate an issue with the format of the JID.`);
            console.error(`[JID-HELPER] Attempted to use JID: ${validJid} (${typeof validJid})`);
        }
        
        return null;
    }
}

/**
 * Safe text message sending with JID validation
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {string} text - Text message
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendText(sock, jid, text) {
    return await safeSendMessage(sock, jid, { text });
}

/**
 * Safe image message sending with JID validation
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {Buffer|string} image - Image buffer or URL
 * @param {string} caption - Optional caption
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendImage(sock, jid, image, caption = '') {
    if (!image) {
        console.error('[JID-HELPER] Missing image data');
        return null;
    }
    
    const content = { 
        image: image,
        caption: caption || ''
    };
    
    return await safeSendMessage(sock, jid, content);
}

/**
 * Safely send a video message
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {Buffer|string} video - Video buffer or URL
 * @param {string} caption - Optional caption
 * @param {Object} options - Additional options
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendVideo(sock, jid, video, caption = '', options = {}) {
    if (!video) {
        console.error('[JID-HELPER] Missing video data');
        return null;
    }
    
    const content = { 
        video: video,
        caption: caption || '',
        gifPlayback: options.gifPlayback ?? false
    };
    
    return await safeSendMessage(sock, jid, content);
}

/**
 * Safely send an animated GIF message
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {Buffer|string} gif - GIF buffer or URL
 * @param {string} caption - Optional caption
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendAnimatedGif(sock, jid, gif, caption = '') {
    if (!gif) {
        console.error('[JID-HELPER] Missing GIF data');
        return null;
    }
    
    const content = { 
        video: gif,
        caption: caption || '',
        gifPlayback: true
    };
    
    return await safeSendMessage(sock, jid, content);
}

module.exports = {
    isJidGroup,
    isJidUser,
    normalizeJid,
    ensureJidString,
    extractUserIdFromJid,
    formatJidForLogging,
    validateJid,
    safeSendMessage,
    safeSendText,
    safeSendImage,
    safeSendVideo,
    safeSendAnimatedGif
};