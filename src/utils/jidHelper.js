/**
 * JID Helper Utility - Safe WhatsApp JID functions
 * Prevents "jid.endsWith is not a function" error
 */
const logger = require('./logger');
const mediaEffects = require('./mediaEffects');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

// JID string type cache to avoid repeated checks
const jidTypeCache = new Map();

/**
 * Safely check if a JID is a group JID - High-performance optimized
 * @param {any} jid - JID to check
 * @returns {boolean} - Whether the JID is a group
 */
function isJidGroup(jid) {
    if (!jid) return false;
    
    // Fast path for string JIDs
    if (typeof jid === 'string') {
        // Fast check using endsWith only
        return jid.endsWith('@g.us');
    }
    
    // Handle non-string JIDs
    try {
        const jidStr = String(jid || '');
        return jidStr.endsWith('@g.us');
    } catch {
        return false;
    }
}

/**
 * Safely check if a JID is a user JID - High-performance optimized
 * @param {any} jid - JID to check
 * @returns {boolean} - Whether the JID is a user
 */
function isJidUser(jid) {
    if (!jid) return false;
    
    // Fast path for string JIDs
    if (typeof jid === 'string') {
        // Fast check using endsWith only
        return jid.endsWith('@s.whatsapp.net');
    }
    
    // Handle non-string JIDs
    try {
        const jidStr = String(jid || '');
        return jidStr.endsWith('@s.whatsapp.net');
    } catch {
        return false;
    }
}

/**
 * Normalize a JID to ensure it's properly formatted - High-performance optimized
 * @param {any} jid - JID to normalize
 * @returns {string} - Normalized JID
 */
function normalizeJid(jid) {
    if (!jid) return '';
    
    // Fast path for cached and string values
    const cacheKey = typeof jid === 'object' ? JSON.stringify(jid) : jid;
    if (jidTypeCache.has(cacheKey)) {
        return jidTypeCache.get(cacheKey);
    }
    
    try {
        let jidStr = typeof jid === 'string' ? jid : String(jid || '');
        
        // Fast check for @c.us suffix
        if (jidStr.endsWith('@c.us')) {
            jidStr = jidStr.slice(0, -5) + '@s.whatsapp.net';
        }
        
        // Cache result for future lookups
        jidTypeCache.set(cacheKey, jidStr);
        
        return jidStr;
    } catch {
        return '';
    }
}

/**
 * Ensure a JID is a string - High-performance optimized
 * @param {any} jid - The JID to stringify
 * @returns {string} - The JID as a string or empty string if invalid
 */
function ensureJidString(jid) {
    // Fast path for string JIDs
    if (typeof jid === 'string') return jid;
    if (!jid) return '';
    
    try {
        return String(jid || '');
    } catch {
        return '';
    }
}

/**
 * Extract user ID from JID - High-performance optimized
 * @param {any} jid - The JID to extract from
 * @returns {string} - User ID portion of the JID
 */
function extractUserIdFromJid(jid) {
    if (!jid) return '';
    
    const jidStr = typeof jid === 'string' ? jid : String(jid || '');
    
    // Fast path using indexOf/substring instead of regex
    const atIndex = jidStr.indexOf('@');
    if (atIndex > 0) {
        return jidStr.substring(0, atIndex);
    }
    
    return '';
}

/**
 * Format a JID for logging to prevent [object Object] - High-performance optimized
 * @param {any} jid - JID to format for log messages
 * @returns {string} - Formatted JID safe for logging
 */
function formatJidForLogging(jid) {
    if (!jid) return 'unknown';
    
    // Fast path for strings
    if (typeof jid === 'string') return jid;
    
    // Object handling optimized
    if (typeof jid === 'object') {
        // Direct property access without try/catch for speed
        if (jid.key && jid.key.remoteJid) {
            return typeof jid.key.remoteJid === 'string' ? 
                jid.key.remoteJid : String(jid.key.remoteJid || '');
        } 
        if (jid.remoteJid) {
            return typeof jid.remoteJid === 'string' ? 
                jid.remoteJid : String(jid.remoteJid || '');
        }
        return 'object_jid';
    }
    
    // Fallback - direct conversion
    return String(jid || '');
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
        // First check if sock is valid
        if (!sock || typeof sock.sendMessage !== 'function') {
            logger.error('Invalid socket object provided to safeSendMessage');
            return null;
        }
        
        // Handle case where jid comes from message.key.remoteJid
        let targetJid = jid;
        if (typeof jid === 'object' && jid !== null) {
            if (jid.remoteJid) {
                targetJid = jid.remoteJid;
            } else if (jid.key && jid.key.remoteJid) {
                targetJid = jid.key.remoteJid;
            }
        }
        
        const normalizedJid = normalizeJid(targetJid);
        
        if (!normalizedJid) {
            logger.error('Invalid JID provided for message sending:', targetJid);
            return null;
        }
        
        // Content validation
        if (!content || typeof content !== 'object') {
            logger.error('Invalid content provided to safeSendMessage');
            return null;
        }
        
        return await sock.sendMessage(normalizedJid, content);
    } catch (err) {
        logger.error('Error in safeSendMessage:', err);
        // Log more details to help with debugging
        logger.error('JID type:', typeof jid);
        if (jid && typeof jid === 'object') {
            logger.error('JID is object with keys:', Object.keys(jid));
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
// Cache for GIF conversion to avoid repeating expensive operations
const GIF_CACHE = new Map();
const GIF_CACHE_SIZE_LIMIT = 50;  // Maximum number of cached GIFs
const GIF_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const crypto = require('crypto');

/**
 * Safe animated GIF sending with caching for performance
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {Buffer|string} gif - GIF buffer or path to GIF file
 * @param {string} caption - Caption text for the GIF
 * @param {Object} options - Additional options
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendAnimatedGif(sock, jid, gif, caption = '', options = {}) {
    try {
        // Fast validation of socket
        if (!sock?.sendMessage) return null;
        
        // Fast JID normalization
        const normalizedJid = normalizeJid(typeof jid === 'object' ? (jid.remoteJid || (jid.key?.remoteJid)) : jid);
        if (!normalizedJid) return null;

        // Get file path or create hash for buffer
        const fs = require('fs');
        let gifPath = typeof gif === 'string' ? gif : null;
        let buffer = typeof gif === 'string' ? null : gif;
        let cacheKey = gifPath;
        
        // If it's a buffer, create a hash for cache key
        if (!gifPath && Buffer.isBuffer(buffer)) {
            // Simple hash function for buffer
            const hash = crypto.createHash('md5').update(buffer).digest('hex');
            cacheKey = `buffer:${hash}:${buffer.length}`;
        }
        
        // Check cache for pre-converted MP4
        if (cacheKey) {
            const cachedItem = GIF_CACHE.get(cacheKey);
            if (cachedItem && (Date.now() - cachedItem.timestamp < GIF_CACHE_DURATION)) {
                // Use cached MP4 buffer
                return await sock.sendMessage(normalizedJid, {
                    video: cachedItem.buffer,
                    caption,
                    gifPlayback: true,
                    mimetype: 'video/mp4',
                    ...options
                });
            }
        }

        // Load buffer from file if needed (only once)
        if (gifPath && !buffer) {
            try {
                if (!fs.existsSync(gifPath)) return null;
                buffer = fs.readFileSync(gifPath);
            } catch (err) {
                return null;
            }
        }

        // Convert GIF to MP4 efficiently
        try {
            const tempDir = await mediaEffects.ensureTempDir();
            const tempGifPath = path.join(tempDir, `temp-${Date.now()}.gif`);
            const mp4Path = path.join(tempDir, `temp-${Date.now()}.mp4`);
            
            // Write buffer to file for processing (minimal logging)
            fs.writeFileSync(tempGifPath, buffer);
            
            // Convert GIF to MP4 with optimized settings
            await new Promise((resolve, reject) => {
                ffmpeg(tempGifPath)
                    .outputOptions([
                        '-movflags faststart',
                        '-pix_fmt yuv420p',
                        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                        '-b:v', '1M',     // Reduced bitrate for faster processing
                        '-r', '24',        // Slightly lower framerate
                        '-shortest',
                        '-an',
                        '-f', 'mp4'
                    ])
                    .output(mp4Path)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
            
            // Read the MP4 file
            const mp4Buffer = fs.readFileSync(mp4Path);
            
            // Cache the converted MP4 for future use
            if (cacheKey) {
                // Clean up cache if it gets too large
                if (GIF_CACHE.size >= GIF_CACHE_SIZE_LIMIT) {
                    // Remove oldest entry
                    const oldestKey = [...GIF_CACHE.entries()]
                        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
                    GIF_CACHE.delete(oldestKey);
                }
                
                GIF_CACHE.set(cacheKey, {
                    buffer: mp4Buffer,
                    timestamp: Date.now()
                });
            }
            
            // Send the message
            const result = await sock.sendMessage(normalizedJid, {
                video: mp4Buffer,
                caption,
                gifPlayback: true,
                mimetype: 'video/mp4',
                ...options
            });
            
            // Clean up temp files in the background (non-blocking)
            setImmediate(() => {
                try {
                    fs.unlinkSync(tempGifPath);
                    fs.unlinkSync(mp4Path);
                } catch (e) {
                    // Ignore cleanup errors
                }
            });
            
            return result;
        } catch (convErr) {
            // Simplified fallback with less logging
            try {
                return await sock.sendMessage(normalizedJid, {
                    video: buffer,
                    gifPlayback: true,
                    caption
                });
            } catch (fallbackErr) {
                try {
                    return await sock.sendMessage(normalizedJid, {
                        image: buffer,
                        caption
                    });
                } catch (finalErr) {
                    return null;
                }
            }
        }
    } catch (outerErr) {
        return null;
    }
}

/**
 * Safe audio message sending with JID validation
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {string|Buffer} audio - Audio URL or buffer
 * @param {Object} options - Additional options like ptt (push to talk)
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendAudio(sock, jid, audio, options = {}) {
    const content = {
        audio: typeof audio === 'string' ? { url: audio } : audio,
        mimetype: 'audio/mp4',
        ...options
    };
    
    return await safeSendMessage(sock, jid, content);
}

/**
 * Safe video message sending with JID validation
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {string|Buffer} video - Video URL or buffer
 * @param {string} caption - Optional caption
 * @param {Object} options - Additional options
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendVideo(sock, jid, video, caption = '', options = {}) {
    const content = {
        video: typeof video === 'string' ? { url: video } : video,
        caption,
        ...options
    };
    
    return await safeSendMessage(sock, jid, content);
}

/**
 * Safe document message sending with JID validation
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {string|Buffer} document - Document URL or buffer
 * @param {string} fileName - Name of the file
 * @param {string} mimetype - MIME type of the document
 * @param {string} caption - Optional caption
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendDocument(sock, jid, document, fileName, mimetype, caption = '') {
    const content = {
        document: typeof document === 'string' ? { url: document } : document,
        fileName,
        mimetype,
        caption
    };
    
    return await safeSendMessage(sock, jid, content);
}

/**
 * Safe button message sending with JID validation
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {string} text - Message text
 * @param {string} footer - Footer text
 * @param {Array} buttons - Button array
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendButtons(sock, jid, text, footer, buttons) {
    // Validate buttons format
    if (!Array.isArray(buttons) || buttons.length === 0) {
        logger.error('Invalid buttons array provided to safeSendButtons');
        return null;
    }
    
    const content = {
        text,
        footer,
        buttons,
        headerType: 1
    };
    
    return await safeSendMessage(sock, jid, content);
}

/**
 * Safe location message sending with JID validation
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @param {string} name - Optional location name
 * @param {string} address - Optional location address
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendLocation(sock, jid, latitude, longitude, name = '', address = '') {
    const content = {
        location: {
            degreesLatitude: latitude,
            degreesLongitude: longitude,
            name,
            address
        }
    };
    
    return await safeSendMessage(sock, jid, content);
}

/**
 * Safe contact card message sending with JID validation
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {string} displayName - Display name for the contact
 * @param {string} vcard - vCard data for the contact
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendContact(sock, jid, displayName, vcard) {
    const content = {
        contacts: {
            displayName,
            contacts: [{ vcard }]
        }
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
    safeSendImage,
    safeSendSticker,
    safeSendAnimatedGif,
    safeSendAudio,
    safeSendVideo,
    safeSendDocument,
    safeSendButtons,
    safeSendLocation,
    safeSendContact
};