/**
 * JID Helper Utility - Safe WhatsApp JID functions
 * Prevents "jid.endsWith is not a function" error
 */
const logger = require('./logger');
const mediaEffects = require('./mediaEffects');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

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
        let originalSize = 0;
        const fs = require('fs');
        
        if (typeof gif === 'string') {
            try {
                // Log the file size before reading
                if (fs.existsSync(gif)) {
                    const stats = fs.statSync(gif);
                    originalSize = stats.size;
                    logger.info(`GIF file size: ${(originalSize / 1024).toFixed(2)} KB at ${gif}`);
                    
                    // Check if file is too large (>2MB) for reliable sending
                    if (originalSize > 2 * 1024 * 1024) {
                        logger.warn(`GIF file is large (${(originalSize / 1024 / 1024).toFixed(2)}MB), may have compatibility issues`);
                    }
                }
                
                buffer = fs.readFileSync(gif);
            } catch (err) {
                logger.error(`Failed to read GIF file: ${err.message}`);
                return null;
            }
        } else if (Buffer.isBuffer(buffer)) {
            originalSize = buffer.length;
            logger.info(`GIF buffer size: ${(originalSize / 1024).toFixed(2)} KB`);
        }

        // Detect file type from buffer if possible
        let mimeType = 'image/gif';
        try {
            // file-type is an ESM module
            const fileTypeModule = await import('file-type');
            const fileTypeResult = await fileTypeModule.fileTypeFromBuffer(buffer);
            if (fileTypeResult) {
                mimeType = fileTypeResult.mime;
                logger.info(`Detected MIME type: ${mimeType} for GIF`);
            }
        } catch (typeError) {
            logger.warn(`Could not detect file type: ${typeError.message}`);
            // Continue with default mime type
        }
        
        // Get the keepFormat option from the passed options
        const keepFormat = options.keepFormat === true;
        
        // Try to optimize the GIF if it's too large (>1MB)
        if (originalSize > 1024 * 1024) {
            try {
                logger.info(`GIF is large (${(originalSize/1024/1024).toFixed(2)}MB), attempting optimization${keepFormat ? ' while preserving GIF format' : ''}...`);
                
                // Optimize the GIF using our utility
                const optimizeResult = await mediaEffects.optimizeGif(buffer, {
                    maxSize: 1.5 * 1024 * 1024,  // 1.5MB target
                    maxWidth: 512,
                    maxHeight: 512,
                    quality: 85,
                    keepAsGif: keepFormat  // Use the option from the function call
                });
                
                if (optimizeResult.wasOptimized) {
                    const reduction = Math.round((optimizeResult.sizeReduction / originalSize) * 100);
                    logger.info(`GIF optimization successful (format: ${optimizeResult.format}): ${(optimizeResult.optimizedSize/1024).toFixed(2)}KB (${reduction}% smaller)`);
                    
                    // Use the optimized buffer for sending
                    buffer = optimizeResult.buffer;
                    
                    // Update MIME type if format changed
                    if (optimizeResult.format === 'webp') {
                        mimeType = 'image/webp';
                    }
                } else {
                    logger.info(`GIF optimization skipped: ${optimizeResult.error || 'already optimal'}`);
                }
            } catch (optimizeError) {
                logger.warn(`GIF optimization failed: ${optimizeError.message}, proceeding with original`);
                // Continue with the original buffer
            }
        }

        // Method 1: Convert to MP4 first, then send (most reliable for animations)
        try {
            logger.info(`Converting GIF to MP4 for animation compatibility`);
            // Create a temporary directory
            const tempDir = await mediaEffects.ensureTempDir();
            const tempGifPath = path.join(tempDir, `temp-${Date.now()}.gif`);
            const mp4Path = path.join(tempDir, `temp-${Date.now()}.mp4`);
            
            // Write buffer to file
            fs.writeFileSync(tempGifPath, buffer);
            
            // Convert GIF to MP4 using ffmpeg with high quality settings
            await new Promise((resolve, reject) => {
                ffmpeg(tempGifPath)
                    .outputOptions([
                        '-movflags faststart',
                        '-pix_fmt yuv420p',
                        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                        '-b:v', '1M',  // Higher bitrate for better quality
                        '-r', '24'     // Force 24fps for smoother animation
                    ])
                    .output(mp4Path)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
            
            // Send as video with gifPlayback enabled
            const mp4Buffer = fs.readFileSync(mp4Path);
            logger.info(`MP4 conversion successful, size: ${(mp4Buffer.length/1024).toFixed(2)} KB`);
            
            const result = await sock.sendMessage(normalizedJid, {
                video: mp4Buffer,
                caption,
                gifPlayback: true,
                ptt: false,
                mimetype: 'video/mp4',
                ...options
            });
            logger.info(`Successfully sent as MP4 video with animation!`);
            
            // Clean up temp files
            try {
                fs.unlinkSync(tempGifPath);
                fs.unlinkSync(mp4Path);
            } catch (cleanupError) {
                logger.warn(`Failed to clean up temp files: ${cleanupError.message}`);
            }
            
            return result;
        } catch (mp4Error) {
            logger.warn(`MP4 conversion failed: ${mp4Error.message}`);
            
            // Fallback: try direct video with gifPlayback
            try {
                logger.info(`Attempting direct gifPlayback as fallback (size: ${(buffer.length/1024).toFixed(2)} KB)`);
                const result = await sock.sendMessage(normalizedJid, {
                    video: buffer,
                    caption,
                    gifPlayback: true,
                    mimetype: 'video/mp4',
                    ...options
                });
                logger.info(`Successfully sent as direct video with GIF playback!`);
                return result;
            } catch (gifError) {
                logger.warn(`Could not send as GIF playback video: ${gifError.message}`);
            }
        }

        // Method 2: Try to send as document with GIF MIME type
        try {
            logger.info(`Attempting to send GIF as document`);
            const result = await sock.sendMessage(normalizedJid, {
                document: buffer,
                mimetype: 'image/gif',
                fileName: `animation-${Date.now()}.gif`,
                caption,
                ...options
            });
            logger.info(`Successfully sent as document!`);
            return result;
        } catch (docError) {
            logger.warn(`Could not send as document: ${docError.message}`);
        }

        // Method 3: Try to send as animated sticker (This often shows as grey box)
        try {
            logger.info(`Attempting to send as animated sticker (${(buffer.length/1024).toFixed(2)} KB)`);
            const result = await sock.sendMessage(normalizedJid, {
                sticker: buffer,
                isAnimated: true,
                ...options
            });
            logger.info(`Successfully sent as animated sticker!`);
            return result;
        } catch (stickerError) {
            logger.warn(`Could not send as animated sticker: ${stickerError.message}`);
        }
        
        // Method 4: Try alternate approach for animated content
        try {
            logger.info(`Attempting to send as animated image`);
            // Create special options for animated content
            const animatedOptions = {
                ...options,
                viewOnce: false,        // Ensure it's not a view-once message
                isAnimated: true,       // Signal that this is animated content
                seconds: 8,             // Duration hint (may help with some clients)
                mediaType: 2,           // 2 = video type  
                animated: true          // Explicitly mark as animated
            };
            
            // Try sending as a specially crafted video message
            const result = await sock.sendMessage(normalizedJid, {
                video: buffer,
                jpegThumbnail: null,    // Let WhatsApp generate a thumbnail
                caption,
                gifPlayback: true,      // Crucial for GIF behavior
                shouldLoop: true,       // Loop the animation
                ...animatedOptions
            });
            logger.info(`Successfully sent as animated image!`);
            return result;
        } catch (mp4Error) {
            logger.warn(`Animated image method failed: ${mp4Error.message}`);
        }
        
        // Method 5: Try as regular image (static fallback - last resort)
        try {
            logger.info(`Attempting to send as static image (last resort)`);
            const result = await sock.sendMessage(normalizedJid, {
                image: buffer,
                caption: `${caption} (static fallback)`,
                ...options
            });
            logger.info(`Successfully sent as static image!`);
            return result;
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