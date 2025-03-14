/**
 * JID Helper Utility - Safe WhatsApp JID functions
 * Prevents "jid.endsWith is not a function" error
 */
const logger = require('./logger');

/**
 * Safely check if a JID is a group JID
 * @param {any} jid - JID to check
 * @returns {boolean} - Whether the JID is a group
 */
function isJidGroup(jid) {
    if (!jid) return false;
    
    try {
        const jidStr = String(jid || '');
        return jidStr.endsWith('@g.us');
    } catch (err) {
        logger.error('Error in isJidGroup:', err);
        return false;
    }
}

/**
 * Safely check if a JID is a user JID
 * @param {any} jid - JID to check
 * @returns {boolean} - Whether the JID is a user
 */
function isJidUser(jid) {
    if (!jid) return false;
    
    try {
        const jidStr = String(jid || '');
        return jidStr.endsWith('@s.whatsapp.net');
    } catch (err) {
        logger.error('Error in isJidUser:', err);
        return false;
    }
}

/**
 * Normalize a JID to ensure it's properly formatted
 * @param {any} jid - JID to normalize
 * @returns {string} - Normalized JID
 */
function normalizeJid(jid) {
    if (!jid) return '';
    
    try {
        let jidStr = String(jid || '');
        
        // Convert jid@c.us to jid@s.whatsapp.net
        if (jidStr.endsWith('@c.us')) {
            jidStr = jidStr.replace('@c.us', '@s.whatsapp.net');
        }
        
        return jidStr;
    } catch (err) {
        logger.error('Error in normalizeJid:', err);
        return '';
    }
}

/**
 * Ensure a JID is a string
 * @param {any} jid - The JID to stringify
 * @returns {string} - The JID as a string or empty string if invalid
 */
function ensureJidString(jid) {
    if (!jid) return '';
    
    try {
        return String(jid || '');
    } catch (err) {
        logger.error('Error in ensureJidString:', err);
        return '';
    }
}

/**
 * Extract user ID from JID
 * @param {any} jid - The JID to extract from
 * @returns {string} - User ID portion of the JID
 */
function extractUserIdFromJid(jid) {
    const jidStr = ensureJidString(jid);
    
    try {
        // Extract the part before @ symbol
        const match = jidStr.match(/([^@]+)@/);
        return match ? match[1] : '';
    } catch (err) {
        logger.error('Error in extractUserIdFromJid:', err);
        return '';
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
    try {
        const normalizedJid = normalizeJid(jid);
        
        if (!normalizedJid) {
            logger.error('Invalid JID provided for message sending:', jid);
            return null;
        }
        
        return await sock.sendMessage(normalizedJid, content);
    } catch (err) {
        logger.error('Error in safeSendMessage:', err);
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
 * @param {string|Buffer} image - Image URL or buffer
 * @param {string} caption - Optional caption
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendImage(sock, jid, image, caption = '') {
    const content = {
        image: typeof image === 'string' ? { url: image } : image,
        caption
    };
    
    return await safeSendMessage(sock, jid, content);
}

/**
 * Safe sticker message sending with JID validation
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {Buffer} sticker - Sticker buffer
 * @param {Object} options - Additional options (mimetype, etc.)
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendSticker(sock, jid, sticker, options = {}) {
    const content = {
        sticker,
        ...options
    };
    
    return await safeSendMessage(sock, jid, content);
}

module.exports = {
    isJidGroup,
    isJidUser,
    normalizeJid,
    ensureJidString,
    extractUserIdFromJid,
    safeSendMessage,
    safeSendText,
    safeSendImage,
    safeSendSticker
};