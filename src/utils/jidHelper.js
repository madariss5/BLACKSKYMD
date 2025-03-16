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
 * Safe message sending with JID validation
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {Object} content - Message content
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendMessage(sock, jid, content) {
    if (!sock || !jid) {
        console.error(`Cannot send message: ${!sock ? 'Socket is null' : 'JID is null'}`);
        return null;
    }
    
    const validJid = ensureJidString(jid);
    if (!validJid) {
        console.error(`Invalid JID: ${formatJidForLogging(jid)}`);
        return null;
    }
    
    try {
        return await sock.sendMessage(validJid, content);
    } catch (err) {
        console.error(`Error sending message to ${formatJidForLogging(jid)}: ${err.message}`);
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
    const content = { 
        image: image,
        caption: caption
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
    safeSendMessage,
    safeSendText,
    safeSendImage
};