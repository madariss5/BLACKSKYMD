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

/**
 * Safe animated GIF sending with multiple fallback methods
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {Buffer|string} gif - GIF buffer or path to GIF file
 * @param {string} caption - Caption text for the GIF
 * @param {Object} options - Additional options
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendAnimatedGif(sock, jid, gif, caption = '', options = {}) {
    try {
        const normalizedJid = normalizeJid(jid);
        
        if (!normalizedJid) {
            logger.error('Invalid JID provided for GIF sending:', jid);
            return null;
        }

        // Convert path to buffer if needed
        let buffer = gif;
        if (typeof gif === 'string') {
            try {
                const fs = require('fs');
                buffer = fs.readFileSync(gif);
            } catch (err) {
                logger.error(`Failed to read GIF file: ${err.message}`);
                return null;
            }
        }

        // Detect file type from buffer if possible
        let mimeType = 'image/gif';
        try {
            const FileType = require('file-type');
            const fileTypeResult = await FileType.fromBuffer(buffer);
            if (fileTypeResult) {
                mimeType = fileTypeResult.mime;
                logger.info(`Detected MIME type: ${mimeType} for GIF`);
            }
        } catch (typeError) {
            logger.warn(`Could not detect file type: ${typeError.message}`);
            // Continue with default mime type
        }

        // Method 1: Try to send as animated sticker (good compatibility)
        try {
            return await sock.sendMessage(normalizedJid, {
                sticker: buffer,
                isAnimated: true,
                ...options
            });
        } catch (stickerError) {
            logger.warn(`Could not send as animated sticker: ${stickerError.message}`);
        }

        // Method 2: Try to send as video with GIF playback (most compatible)
        try {
            return await sock.sendMessage(normalizedJid, {
                video: buffer,
                caption,
                gifPlayback: true,
                mimetype: 'video/mp4',
                ...options
            });
        } catch (gifError) {
            logger.warn(`Could not send as GIF playback video: ${gifError.message}`);
        }
        
        // Method 3: Try with document method (preserves animation)
        try {
            return await sock.sendMessage(normalizedJid, {
                document: buffer,
                mimetype: 'image/gif',
                fileName: `animation-${Date.now()}.gif`,
                caption,
                ...options
            });
        } catch (docError) {
            logger.warn(`Could not send as document: ${docError.message}`);
        }
        
        // Method 4: Try as video with direct detected MIME type
        try {
            return await sock.sendMessage(normalizedJid, {
                video: buffer,
                caption,
                gifPlayback: true,
                mimetype: mimeType,
                ...options
            });
        } catch (directError) {
            logger.warn(`Could not send with direct MIME type: ${directError.message}`);
        }
        
        // Method 5: Last resort - try as regular image (won't be animated)
        try {
            return await sock.sendMessage(normalizedJid, {
                image: buffer,
                caption: `${caption} (static fallback)`,
                ...options
            });
        } catch (imageError) {
            logger.error(`All GIF sending methods failed: ${imageError.message}`);
            return null;
        }
    } catch (error) {
        logger.error(`Error in safeSendAnimatedGif: ${error.message}`);
        return null;
    }
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
    safeSendSticker,
    safeSendAnimatedGif
};