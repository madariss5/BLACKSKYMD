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
            // If this is a group message, check for participant
            if (jid.key.remoteJid.endsWith('@g.us') && jid.key.participant) {
                console.log(`[JID-HELPER] Converting group message to participant JID: ${jid.key.participant}`);
                jid = jid.key.participant;
            } else {
                console.log(`[JID-HELPER] Converting message object to JID: ${jid.key.remoteJid}`);
                jid = jid.key.remoteJid;
            }
        } 
        // Check for participant property in group message
        else if (jid.key && jid.key.participant) {
            console.log(`[JID-HELPER] Using participant JID from message: ${jid.key.participant}`);
            jid = jid.key.participant;
        }
        // If it has remoteJid property directly
        else if (jid.remoteJid) {
            console.log(`[JID-HELPER] Converting object with remoteJid to JID: ${jid.remoteJid}`);
            jid = jid.remoteJid;
        }
        // If it has participant property directly (group context)
        else if (jid.participant) {
            console.log(`[JID-HELPER] Converting object with participant to JID: ${jid.participant}`);
            jid = jid.participant;
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

// Message cache for optimized performance
const messageCache = new Map();
const MESSAGE_CACHE_LIFETIME = 60000; // 1 minute cache lifetime

/**
 * Cache manager for safe message sending optimization
 * Used for tracking successful messages and improving deliver rates
 */
const messageCacheManager = {
    /**
     * Get cached message by key 
     * @param {string} key - Cache key
     * @returns {Object|null} - Cached data or null
     */
    get(key) {
        if (!messageCache.has(key)) return null;
        const cached = messageCache.get(key);
        
        // Check if cache is still valid
        if (Date.now() - cached.timestamp > MESSAGE_CACHE_LIFETIME) {
            messageCache.delete(key);
            return null;
        }
        
        return cached.data;
    },
    
    /**
     * Set message in cache
     * @param {string} key - Cache key
     * @param {Object} data - Data to cache
     */
    set(key, data) {
        messageCache.set(key, {
            data,
            timestamp: Date.now()
        });
    },
    
    /**
     * Get success record for a JID
     * @param {string} jid - JID to check
     * @returns {Object|null} - Success record or null
     */
    getSuccessRecord(jid) {
        return this.get(`success_${jid}`);
    },
    
    /**
     * Record successful message to JID
     * @param {string} jid - JID that received message
     * @param {Object} result - Message result
     */
    recordSuccess(jid, result) {
        this.set(`success_${jid}`, {
            lastSuccess: Date.now(),
            successCount: (this.getSuccessRecord(jid)?.successCount || 0) + 1,
            lastResult: result
        });
    },
    
    /**
     * Record error with a specific JID
     * @param {string} jid - JID that generated error
     * @param {Error} error - Error object
     */
    recordError(jid, error) {
        this.set(`error_${jid}`, {
            lastError: Date.now(),
            errorCount: (this.get(`error_${jid}`)?.errorCount || 0) + 1,
            error: error.message
        });
    },
    
    /**
     * Check if JID has excessive errors
     * @param {string} jid - JID to check
     * @returns {boolean} - Whether JID has excessive errors
     */
    hasExcessiveErrors(jid) {
        const record = this.get(`error_${jid}`);
        if (!record) return false;
        
        // If there are 5+ errors in the past minute, consider excessive
        return record.errorCount >= 5 && (Date.now() - record.lastError < MESSAGE_CACHE_LIFETIME);
    },
    
    /**
     * Get message sending stats
     * @returns {Object} - Stats about message sending
     */
    getStats() {
        const stats = {
            cacheSize: messageCache.size,
            successJids: 0,
            errorJids: 0,
            totalSuccess: 0,
            totalErrors: 0
        };
        
        for (const [key, value] of messageCache.entries()) {
            if (key.startsWith('success_')) {
                stats.successJids++;
                stats.totalSuccess += value.data.successCount || 0;
            } else if (key.startsWith('error_')) {
                stats.errorJids++;
                stats.totalErrors += value.data.errorCount || 0;
            }
        }
        
        return stats;
    }
};

/**
 * Safe message sending with enhanced JID validation and error handling
 * Fixed to address "Cannot destructure property 'user'" error
 * Optimized with caching and smart retries for better delivery rates
 * 
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {Object} content - Message content
 * @param {Object} options - Additional options
 * @param {boolean} options.retry - Whether to retry on failure
 * @param {number} options.timeout - Timeout in milliseconds
 * @param {boolean} options.ignoreCache - Whether to ignore message cache
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendMessage(sock, jid, content, options = {}) {
    // Default options
    const opts = {
        retry: true,
        timeout: 15000, // 15 seconds default timeout
        ignoreCache: false,
        ...options
    };
    
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
    
    // Check if JID has had excessive errors
    if (!opts.ignoreCache && messageCacheManager.hasExcessiveErrors(validJid)) {
        console.warn(`[JID-HELPER] Skipping message to ${formatJidForLogging(validJid)} due to excessive recent errors`);
        return null;
    }
    
    try {
        // Use a timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Message sending timed out')), opts.timeout)
        );
        
        // Prepare enhanced content with proper viewOnce wrapping if needed
        const enhancedContent = prepareMessageContent(content);
        
        // Race between message sending and timeout
        const result = await Promise.race([
            sock.sendMessage(validJid, enhancedContent),
            timeoutPromise
        ]);
        
        // Record success to improve future delivery
        if (result) {
            messageCacheManager.recordSuccess(validJid, result);
        }
        
        return result;
    } catch (err) {
        console.error(`[JID-HELPER] Error sending message to ${formatJidForLogging(jid)}: ${err.message}`);
        
        // Record error for future reference
        messageCacheManager.recordError(validJid, err);
        
        // If the error is related to jidDecode, log additional information
        if (err.message.includes('jidDecode') || err.message.includes('Cannot destructure property')) {
            console.error(`[JID-HELPER] JID decode error with ${formatJidForLogging(jid)}, this may indicate an issue with the format of the JID.`);
            console.error(`[JID-HELPER] Attempted to use JID: ${validJid} (${typeof validJid})`);
        }
        
        // Retry once with backoff if retry is enabled
        if (opts.retry) {
            try {
                console.log(`[JID-HELPER] Retrying message to ${formatJidForLogging(jid)} after error`);
                
                // Wait a moment before retrying
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                // Retry with retry disabled to prevent infinite loops
                return await safeSendMessage(sock, validJid, content, { 
                    ...opts, 
                    retry: false,
                    timeout: opts.timeout * 1.5 // Extend timeout for retry
                });
            } catch (retryErr) {
                console.error(`[JID-HELPER] Retry also failed: ${retryErr.message}`);
                return null;
            }
        }
        
        return null;
    }
}

/**
 * Prepare message content with proper WhatsApp formatting
 * @param {Object} content - Message content object
 * @returns {Object} - Enhanced message content
 */
function prepareMessageContent(content) {
    if (!content) return content;
    
    // Make a copy to avoid modifying the original
    const enhancedContent = { ...content };
    
    // Handle viewOnce for images
    if (enhancedContent.image && enhancedContent.viewOnce === true) {
        return {
            viewOnceMessage: {
                message: {
                    imageMessage: enhancedContent.image,
                    caption: enhancedContent.caption || ''
                }
            }
        };
    }
    
    // Handle viewOnce for videos
    if (enhancedContent.video && enhancedContent.viewOnce === true) {
        return {
            viewOnceMessage: {
                message: {
                    videoMessage: enhancedContent.video,
                    caption: enhancedContent.caption || ''
                }
            }
        };
    }
    
    // Ensure button IDs are strings
    if (enhancedContent.buttons) {
        enhancedContent.buttons = enhancedContent.buttons.map(btn => ({
            ...btn,
            buttonId: btn.buttonId ? String(btn.buttonId) : btn.buttonId
        }));
    }
    
    return enhancedContent;
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

/**
 * Get message sending statistics
 * @returns {Object} - Message statistics
 */
function getMessageStats() {
    return messageCacheManager.getStats();
}

/**
 * Reset message statistics
 */
function resetMessageStats() {
    messageCache.clear();
}

/**
 * Perform optimized JID lookup
 * Useful for bulk operations where performance is critical
 * @param {string} jid - JID to optimize
 * @returns {string} - Optimized JID
 */
function optimizeJid(jid) {
    if (!jid) return '';
    return normalizeJid(ensureJidString(jid));
}

/**
 * Safely send a message in group context with proper participant handling
 * This function handles the complexities of determining whether to reply to the 
 * group or directly to the participant based on context
 * 
 * @param {Object} sock - WhatsApp socket connection
 * @param {Object} message - Original message object (with key.remoteJid and key.participant)
 * @param {Object} content - Message content to send
 * @param {Object} options - Additional options
 * @param {boolean} options.replyPrivately - Whether to reply directly to participant instead of in group
 * @param {boolean} options.mentionSender - Whether to mention the original sender in group reply
 * @returns {Promise<Object|null>} - Message sending result or null if failed
 */
async function safeSendGroupMessage(sock, message, content, options = {}) {
    if (!message || !message.key) {
        console.error('[JID-HELPER] Invalid message object for group message');
        return null;
    }
    
    // Default options
    const opts = {
        replyPrivately: false,
        mentionSender: false,
        ...options
    };
    
    try {
        // Extract group JID and participant JID
        const groupJid = message.key.remoteJid;
        const participantJid = message.key.participant;
        
        // Validate we're actually in a group context
        if (!isJidGroup(groupJid)) {
            console.error('[JID-HELPER] Not a group JID, using standard message sending');
            return await safeSendMessage(sock, groupJid, content);
        }
        
        // Determine target JID based on options
        const targetJid = opts.replyPrivately && participantJid ? 
            participantJid : groupJid;
        
        // Clone content to avoid modifying the original
        let enhancedContent = { ...content };
        
        // Add mention if needed for group replies
        if (!opts.replyPrivately && opts.mentionSender && participantJid) {
            if (enhancedContent.text) {
                // If content is text, add @mention
                const userNumber = participantJid.split('@')[0];
                
                // Only add mention if not already present
                if (!enhancedContent.text.includes(`@${userNumber}`)) {
                    enhancedContent.text = `@${userNumber} ${enhancedContent.text}`;
                }
                
                // Add mentions array if not present
                if (!enhancedContent.mentions) {
                    enhancedContent.mentions = [participantJid];
                } else if (!enhancedContent.mentions.includes(participantJid)) {
                    enhancedContent.mentions.push(participantJid);
                }
            } else if (enhancedContent.image || enhancedContent.video) {
                // For media messages, add mention in caption
                const userNumber = participantJid.split('@')[0];
                const caption = enhancedContent.caption || '';
                
                // Only add mention if not already present
                if (!caption.includes(`@${userNumber}`)) {
                    enhancedContent.caption = `@${userNumber} ${caption}`;
                }
                
                // Add mentions array if not present
                if (!enhancedContent.mentions) {
                    enhancedContent.mentions = [participantJid];
                } else if (!enhancedContent.mentions.includes(participantJid)) {
                    enhancedContent.mentions.push(participantJid);
                }
            }
        }
        
        // Special reply handling for quoted messages
        if (message.key.id && !opts.replyPrivately) {
            enhancedContent.quoted = message;
        }
        
        // Send message
        return await safeSendMessage(sock, targetJid, enhancedContent);
    } catch (err) {
        console.error('[JID-HELPER] Error sending group message:', err);
        return null;
    }
}

module.exports = {
    // Base JID utilities
    isJidGroup,
    isJidUser,
    normalizeJid,
    ensureJidString,
    extractUserIdFromJid,
    formatJidForLogging,
    validateJid,
    optimizeJid,
    
    // Message sending utilities
    safeSendMessage,
    safeSendText,
    safeSendImage,
    safeSendVideo,
    safeSendAnimatedGif,
    safeSendGroupMessage,
    
    // Statistics and monitoring
    getMessageStats,
    resetMessageStats,
    
    // Message cache manager for advanced usage
    messageCacheManager
};