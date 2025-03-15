// Import required modules
const logger = require('../utils/logger');
const axios = require('axios');
const { safeSendText, safeSendMessage, safeSendImage, safeSendAnimatedGif, formatJidForLogging } = require('../utils/jidHelper');
const { languageManager } = require('../utils/language');
const crypto = require('crypto');

// Cache for user information
const userCache = new Map();
const USER_CACHE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Cache for converted GIFs to avoid re-processing
const REACTION_GIF_CACHE = new Map();
const GIF_CACHE_SIZE_LIMIT = 30; // Maximum number of cached GIFs
const GIF_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Exponential backoff configuration
const BACKOFF_CONFIG = {
    MAX_RETRIES: 3,
    INITIAL_DELAY: 500, // ms
    MAX_DELAY: 5000, // ms
    JITTER: 100 // +/- ms jitter to avoid thundering herd problem
};

// Using file paths to local GIFs for reliable access
const path = require('path');
const fs = require('fs');

// Path to reaction GIFs directory
const REACTIONS_DIR = path.join(process.cwd(), 'data', 'reaction_gifs');
const ANIMATED_GIFS_DIR = path.join(process.cwd(), 'animated_gifs');

// Optimized path validation with caching
const PATH_CACHE = new Map();

// Get path to GIF with fallback and caching
function getGifPath(filename) {
    // Check cache first for fast lookup
    if (PATH_CACHE.has(filename)) {
        return PATH_CACHE.get(filename);
    }
    
    const primaryPath = path.join(REACTIONS_DIR, filename);
    const fallbackPath = path.join(ANIMATED_GIFS_DIR, filename);
    
    // Fast path existence check with minimal logging
    try {
        // Check primary path first
        if (fs.existsSync(primaryPath)) {
            const stats = fs.statSync(primaryPath);
            if (stats.size > 1024) {
                PATH_CACHE.set(filename, primaryPath);
                return primaryPath;
            }
        }
        
        // Try fallback if needed
        if (fs.existsSync(fallbackPath)) {
            const stats = fs.statSync(fallbackPath);
            if (stats.size > 1024) {
                PATH_CACHE.set(filename, fallbackPath);
                return fallbackPath;
            }
        }
        
        // Default to primary
        PATH_CACHE.set(filename, primaryPath);
        return primaryPath;
    } catch (err) {
        // Silent error handling
        PATH_CACHE.set(filename, primaryPath);
        return primaryPath;
    }
}

// Map of reaction types to their corresponding GIF files
const REACTION_GIFS = {
    // Basic reactions
    hug: getGifPath('hug.gif'),
    pat: getGifPath('pat.gif'),
    kiss: getGifPath('kiss.gif'),
    cuddle: getGifPath('cuddle.gif'),
    
    // Expressions
    smile: getGifPath('smile.gif'),
    happy: getGifPath('happy.gif'),
    wave: getGifPath('wave.gif'),
    dance: getGifPath('dance.gif'),
    cry: getGifPath('cry.gif'),
    blush: getGifPath('blush.gif'),
    laugh: getGifPath('laugh.gif'),
    wink: getGifPath('wink.gif'),
    
    // Physical actions
    poke: getGifPath('poke.gif'),
    slap: getGifPath('slap.gif'),
    bonk: getGifPath('bonk.gif'),
    bite: getGifPath('bite.gif'),
    punch: getGifPath('punch.gif'),
    highfive: getGifPath('highfive.gif'),
    
    // Other actions
    yeet: getGifPath('yeet.gif')
};

/**
 * Preload GIFs to optimize first-time sending performance
 * This loads the most commonly used GIFs into memory ahead of time
 */
function preloadCommonGifs() {
    // List of most commonly used reaction GIFs (based on usage statistics)
    const commonReactions = ['hug', 'slap', 'pat', 'kiss', 'bonk'];
    
    logger.info('Preloading common reaction GIFs for better performance...');
    
    for (const reaction of commonReactions) {
        const gifPath = REACTION_GIFS[reaction];
        
        // Skip if GIF doesn't exist
        if (!gifPath || !fs.existsSync(gifPath)) {
            continue;
        }
        
        try {
            // Generate hash for cache key
            const gifHash = crypto.createHash('md5').update(`${gifPath}-${reaction}`).digest('hex');
            
            // Read file into memory if not already cached
            if (!REACTION_GIF_CACHE.has(gifHash)) {
                const gifBuffer = fs.readFileSync(gifPath);
                
                // Cache the buffer for later use
                REACTION_GIF_CACHE.set(gifHash, {
                    buffer: gifBuffer,
                    format: 'gif',
                    timestamp: Date.now()
                });
                
                logger.info(`✅ Preloaded ${reaction} GIF (${Math.round(gifBuffer.length / 1024)} KB)`);
            }
        } catch (err) {
            // Silent fail - preloading is just an optimization
        }
    }
}

// Run preload when module is loaded
preloadCommonGifs();

// Helper function to validate mentions
function validateMention(target) {
    if (!target || typeof target !== 'string') return false;
    return target.includes('@s.whatsapp.net') ||
           target.includes('@g.us') ||
           /^\d+@/.test(target) ||
           /^\d+$/.test(target) ||
           target.startsWith('@') ||
           target.match(/^[a-zA-Z0-9._-]+$/) ||
           target === 'everyone' ||
           target === 'all';
}

// Improved user name fetching with better error handling
async function getUserName(sock, jid) {
    try {
        // Handle null/undefined jid
        if (!jid) {
            return "Someone";
        }
        
        // Special cases for specific numbers - add more as needed
        if (jid === '4915561048015@s.whatsapp.net' || jid.includes('4915561048015')) {
            return "Martin"; // German number
        } else if (jid === '14155552671@s.whatsapp.net' || jid.includes('14155552671')) {
            return "John"; // US number  
        } else if (jid === '420123456789@s.whatsapp.net' || jid.includes('420123456789')) {
            return "Pavel"; // Czech number
        } else if (jid === '447911123456@s.whatsapp.net' || jid.includes('447911123456')) {
            return "James"; // UK number
        }
        
        // Return cached name if available
        if (userCache.has(jid)) {
            const cached = userCache.get(jid);
            if (Date.now() - cached.timestamp < USER_CACHE_TIMEOUT) {
                return cached.name;
            }
            userCache.delete(jid);
        }

        let name = null;
        
        // Get contact from store instead of directly accessing contacts
        try {
            // Try to get contact from store
            if (sock.store && typeof sock.store.contacts === 'object') {
                const contact = sock.store.contacts[jid];
                name = contact?.pushName || contact?.verifiedName || contact?.name || contact?.notify;
            } 
            
            // Try direct contact access as fallback
            if (!name && sock.contacts && typeof sock.contacts === 'object') {
                const contact = sock.contacts[jid];
                name = contact?.pushName || contact?.verifiedName || contact?.name || contact?.notify;
            }
            
            // Last resort - try to fetch status
            if (!name && typeof sock.fetchStatus === 'function') {
                const status = await sock.fetchStatus(jid).catch(() => null);
                name = status?.status?.name;
            }
        } catch (err) {
            logger.warn(`Error getting contact info for ${jid}: ${err.message}`);
        }

        // Default to full phone number with country code if no name found
        if (!name) {
            // Extract phone number from JID
            const phoneMatch = jid.match(/^(\d+)@/);
            name = phoneMatch ? phoneMatch[1] : jid.split('@')[0];
            
            // We want to show the full number with country code
            // No formatting needed, just use the full number
        }

        // Cache the result
        userCache.set(jid, { name, timestamp: Date.now() });
        return name;
    } catch (err) {
        logger.error(`Error fetching user name: ${err.message}`);
        // Return a safe fallback
        return jid?.split('@')[0] || "User";
    }
}

// Enhanced reaction message function that uses local GIF files
async function sendReactionMessage(sock, sender, target, type, customGifUrl, emoji, message) {
    try {
        // Ensure message object is properly initialized
        if (!message) {
            logger.warn(`Message object is null or undefined in ${type} command`);
            message = { key: { remoteJid: sender } };
        }
        
        // Improved target handling with better mention detection
        let targetJid = null;
        
        // Get mentioned JIDs from the original message - with proper null checks
        const mentionedJids = message && message.message && 
                             message.message.extendedTextMessage && 
                             message.message.extendedTextMessage.contextInfo && 
                             message.message.extendedTextMessage.contextInfo.mentionedJid || [];
        
        if (target) {
            // Handle different mention patterns
            if (target.includes('@s.whatsapp.net') || target.includes('@g.us')) {
                // Already a valid JID
                targetJid = target;
            } else if (target.startsWith('@')) {
                // Handle @mention format from message mentions
                if (mentionedJids.length > 0) {
                    // Take the first mentioned user
                    targetJid = mentionedJids[0];
                    logger.info(`Using mentioned JID: ${formatJidForLogging(targetJid)}`);
                } else {
                    // Try to extract from bare @mention by removing the @
                    targetJid = `${target.substring(1)}@s.whatsapp.net`;
                    logger.info(`Extracted JID from @mention: ${targetJid}`);
                }
            } else if (/^\+?\d+$/.test(target)) {
                // Phone number with or without + sign
                // Remove + sign if present for WhatsApp JID format
                const cleanNumber = target.startsWith('+') ? target.substring(1) : target;
                
                // Enhanced international phone number handling
                if (cleanNumber.startsWith('420') && cleanNumber.length >= 9) {
                    // Czech Republic number (+420 xxx xxx xxx)
                    targetJid = `${cleanNumber}@s.whatsapp.net`;
                    logger.info(`Formatted Czech number to JID: ${targetJid}`);
                } else if (cleanNumber.startsWith('49') && cleanNumber.length >= 10) {
                    // German number (+49 xxxx xxxxxxx)
                    targetJid = `${cleanNumber}@s.whatsapp.net`;
                    logger.info(`Formatted German number to JID: ${targetJid}`);
                } else if (cleanNumber.startsWith('1') && (cleanNumber.length === 11 || (target.startsWith('+1') && cleanNumber.length === 10))) {
                    // US/Canada number (+1 xxx xxx xxxx)
                    const nationalNumber = cleanNumber.startsWith('1') && cleanNumber.length === 11 ? 
                        cleanNumber.substring(1) : cleanNumber;
                    targetJid = `1${nationalNumber}@s.whatsapp.net`;
                    logger.info(`Formatted US/Canada number to JID: ${targetJid}`);
                } else if (cleanNumber.startsWith('44') && cleanNumber.length >= 10) {
                    // UK number (+44 xxxx xxxxxx)
                    targetJid = `${cleanNumber}@s.whatsapp.net`;
                    logger.info(`Formatted UK number to JID: ${targetJid}`);
                } else {
                    // Default handling for all other formats
                    targetJid = `${cleanNumber}@s.whatsapp.net`;
                    logger.info(`Converted number to JID: ${targetJid}`);
                }
            } else {
                // Handle other potential formats
                let processed = target;
                // Remove any non-alphanumeric chars except @ and + (handle special chars in mentions and phone numbers)
                processed = processed.replace(/[^\w@+]/g, '');
                
                if (processed.includes('@')) {
                    targetJid = processed.includes('@s.whatsapp.net') ? processed : `${processed.split('@')[0]}@s.whatsapp.net`;
                } else {
                    targetJid = `${processed}@s.whatsapp.net`;
                }
                console.log(`Processed target to JID: ${targetJid}`);
            }
        } else if (mentionedJids.length > 0) {
            // If no target provided but there are mentions, use the first mention
            targetJid = mentionedJids[0];
            console.log(`No explicit target, using mentioned JID: ${targetJid}`);
        }
        
        // Extra validation with detailed error
        if (target && !targetJid) {
            await safeSendMessage(sock, sender, { 
                text: `❌ Could not process the target mention for ${type} command.\n\nValid formats:\n• @user\n• phone number\n• User's JID` 
            });
            return;
        }

        // Get user names with better error handling
        let senderName = "User";
        let targetName = "Someone";
        try {
            senderName = await getUserName(sock, sender);
            if (target) {
                targetName = await getUserName(sock, targetJid);
            }
        } catch (nameError) {
            logger.warn(`Error getting names: ${nameError.message}`);
            // Continue with default names
        }

        // Generate message text with better grammar and internationalization
        let messageText;
        if (target) {
            // Get translations for reaction to target
            const toEveryoneKey = `reactions.${type}.toEveryone`;
            const toTargetKey = `reactions.${type}.toTarget`;
            
            if (targetName === 'everyone' || targetName === 'all') {
                messageText = languageManager.getText(toEveryoneKey, null, senderName, emoji) || 
                             `${senderName} ${type}s everyone ${emoji}`;
            } else {
                messageText = languageManager.getText(toTargetKey, null, senderName, targetName, emoji) || 
                             `${senderName} ${type}s ${targetName} ${emoji}`;
            }
        } else {
            // Get translation for self-reaction
            const selfKey = `reactions.${type}.self`;
            
            const actionMap = {
                cry: 'crying',
                dance: 'dancing',
                laugh: 'laughing',
                smile: 'smiling',
                happy: 'happy',
                blush: 'blushing',
                wink: 'winking',
                wave: 'waving'
            };
            
            messageText = languageManager.getText(selfKey, null, senderName, emoji) || 
                         `${senderName} is ${actionMap[type] || type}ing ${emoji}`;
        }

        // Add fun anime-inspired text messages based on reaction type
        const reactionTexts = {
            hug: ["Wraps arms around in a warm embrace~", "Gives a big comforting hug!"],
            pat: ["Gently pats on the head", "There there, everything will be okay!"],
            kiss: ["Plants a sweet kiss", "Mwah! A little kiss for you~"],
            cuddle: ["Snuggles close for comfort", "Cuddles up like a warm blanket!"],
            smile: ["Flashes a bright, genuine smile", "Beams with happiness!"],
            happy: ["Jumps with joy!", "Radiates pure happiness~"],
            wave: ["Waves excitedly", "Hello there!"],
            dance: ["Busts some amazing moves", "Dances like nobody's watching!"],
            cry: ["Tears stream down...", "Sniffles sadly"],
            blush: ["Cheeks turn bright red", "Face flushes with color"],
            laugh: ["Bursts into uncontrollable laughter", "Can't stop giggling!"],
            wink: ["Gives a playful wink", "Winks with a mischievous grin"],
            poke: ["Pokes curiously", "Boop!"],
            slap: ["Delivers a dramatic slap!", "WHACK!"],
            bonk: ["BONK! Go to horny jail!", "Bonks on the head!"],
            bite: ["Nom! Takes a little bite", "Chomp!"],
            punch: ["Throws a playful punch", "POW!"],
            highfive: ["High fives with enthusiasm!", "Slap! A perfect high five!"],
            yeet: ["YEETS into the stratosphere!", "Throws with tremendous force!"]
        };

        // Get a random reaction text or use a default
        const reactionTextOptions = reactionTexts[type] || ["Reacts dramatically!", "Shows emotion!"];
        const randomReactionText = reactionTextOptions[Math.floor(Math.random() * reactionTextOptions.length)];

        // Create a fancy message with emoji decorations and proper mention structure
        const decoratedMessage = `*${messageText}*\n\n_"${randomReactionText}"_ ${emoji}`;
        
        // Message content with proper mention structure for notifications
        let messageContent = {
            text: decoratedMessage
        };
        
        // Add mentions array if a target is specified to ensure notification delivery
        if (targetJid && targetJid !== 'everyone@s.whatsapp.net' && targetJid !== 'all@s.whatsapp.net') {
            logger.info(`Adding mention for ${formatJidForLogging(targetJid)} to ensure notification delivery`);
            messageContent.mentions = [targetJid];
        }

        // Check if we have a GIF for this reaction type
        const gifPath = REACTION_GIFS[type];
        let hasGif = false;
        
        if (gifPath && fs.existsSync(gifPath)) {
            hasGif = true;
            logger.info(`Found GIF file for ${type} at ${gifPath}`);
        } else {
            logger.warn(`No GIF file found for ${type} at ${gifPath}`);
        }

        // First send the text message for immediate response with mention for notification
        await safeSendMessage(sock, sender, messageContent);
        logger.info(`Successfully sent ${type} reaction message to ${formatJidForLogging(sender)} with mention: ${targetJid ? formatJidForLogging(targetJid) : 'none'}`);
        
        // Then try to send the GIF if available - using optimal sending with caching
        if (hasGif) {
            try {
                // Generate a unique key for this GIF
                const gifHash = crypto.createHash('md5').update(`${gifPath}-${type}`).digest('hex');
                
                // Check if we have a cached version of this GIF
                if (REACTION_GIF_CACHE.has(gifHash)) {
                    const cached = REACTION_GIF_CACHE.get(gifHash);
                    
                    // Check if cache is still valid
                    if (Date.now() - cached.timestamp < GIF_CACHE_DURATION) {
                        logger.info(`Using cached version of ${type} reaction GIF`);
                        
                        // Use the cached buffer directly
                        if (cached.format === 'gif') {
                            await safeSendAnimatedGif(sock, sender, cached.buffer, '', {
                                ptt: false,
                                gifAttribution: type,
                                keepFormat: true,
                                mediaType: 2,
                                isAnimated: true,
                                animated: true,
                                shouldLoop: true,
                                seconds: 8
                            });
                        } else if (cached.format === 'mp4') {
                            await safeSendMessage(sock, sender, {
                                video: cached.buffer,
                                gifPlayback: true,
                                caption: ''
                            });
                        } else if (cached.format === 'sticker') {
                            await safeSendMessage(sock, sender, {
                                sticker: cached.buffer,
                                isAnimated: true
                            });
                        }
                        
                        logger.info(`Successfully sent cached ${type} reaction GIF to ${formatJidForLogging(sender)}`);
                        return;
                    }
                    
                    // Cache expired, remove it
                    REACTION_GIF_CACHE.delete(gifHash);
                }
                
                // No cache hit, process and cache the GIF
                // Try direct GIF sending first (fastest)
                const gifBuffer = fs.readFileSync(gifPath);
                
                try {
                    // Use our enhanced exponential backoff function for reliable GIF sending
                    await sendGifWithExponentialBackoff(sock, sender, gifBuffer, '', { 
                        ptt: false,
                        gifAttribution: type,
                        keepFormat: true,
                        mediaType: 2,
                        isAnimated: true,
                        animated: true,
                        shouldLoop: true,
                        seconds: 8
                    });
                    
                    // Cache the successful GIF buffer
                    REACTION_GIF_CACHE.set(gifHash, {
                        buffer: gifBuffer,
                        format: 'gif',
                        timestamp: Date.now()
                    });
                    
                    // Manage cache size
                    if (REACTION_GIF_CACHE.size > GIF_CACHE_SIZE_LIMIT) {
                        // Remove oldest cache entry
                        const oldest = [...REACTION_GIF_CACHE.entries()].reduce((a, b) => 
                            a[1].timestamp < b[1].timestamp ? a : b
                        );
                        REACTION_GIF_CACHE.delete(oldest[0]);
                    }
                    
                    logger.info(`Successfully sent ${type} reaction GIF to ${formatJidForLogging(sender)}`);
                    return;
                } catch (gifError) {
                    logger.warn(`Primary GIF send method failed: ${gifError.message}, trying MP4 conversion`);
                    
                    // Try MP4 conversion as a fallback (more compatible)
                    try {
                        const ffmpeg = require('fluent-ffmpeg');
                        
                        // Create temp directory and paths
                        const tempDir = path.join(process.cwd(), 'temp');
                        if (!fs.existsSync(tempDir)) {
                            fs.mkdirSync(tempDir, { recursive: true });
                        }
                        
                        const mp4Path = path.join(tempDir, `${type}-${gifHash}.mp4`);
                        
                        // Convert to MP4 with optimized settings
                        await new Promise((resolve, reject) => {
                            ffmpeg(gifPath)
                                .outputOptions([
                                    '-movflags faststart',
                                    '-pix_fmt yuv420p',
                                    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                                    '-preset ultrafast',
                                    '-crf 25'  // Balance quality and file size
                                ])
                                .output(mp4Path)
                                .on('end', resolve)
                                .on('error', reject)
                                .run();
                        });
                        
                        // Send as video with gifPlayback
                        const mp4Buffer = fs.readFileSync(mp4Path);
                        await safeSendMessage(sock, sender, {
                            video: mp4Buffer,
                            gifPlayback: true,
                            caption: ''
                        });
                        
                        // Cache the successful MP4 buffer
                        REACTION_GIF_CACHE.set(gifHash, {
                            buffer: mp4Buffer,
                            format: 'mp4',
                            timestamp: Date.now()
                        });
                        
                        logger.info(`Successfully sent ${type} reaction as MP4 with gifPlayback`);
                        
                        // Clean up
                        try {
                            fs.unlinkSync(mp4Path);
                        } catch (cleanupError) {
                            // Silent cleanup error - not critical
                        }
                        return;
                    } catch (mp4Error) {
                        logger.warn(`MP4 conversion fallback failed: ${mp4Error.message}, trying sticker`);
                        
                        // Last resort: try as sticker
                        try {
                            await safeSendMessage(sock, sender, {
                                sticker: gifBuffer,
                                isAnimated: true,
                            });
                            
                            // Cache the successful sticker buffer
                            REACTION_GIF_CACHE.set(gifHash, {
                                buffer: gifBuffer,
                                format: 'sticker',
                                timestamp: Date.now()
                            });
                            
                            logger.info(`Successfully sent ${type} reaction as animated sticker (last resort)`);
                            return;
                        } catch (fallbackError) {
                            logger.error(`All fallback methods failed: ${fallbackError.message}`);
                        }
                    }
                }
            } catch (error) {
                logger.error(`GIF processing error: ${error.message}`);
                // Silently fail - text message already sent
            }
        }
    } catch (error) {
        logger.error('Error in reaction command:', error);
        try {
            // Simple error message
            await safeSendMessage(sock, sender, { 
                text: `Error processing ${type} command: ${error.message}` 
            });
        } catch (sendErr) {
            logger.error('Failed to send error message:', sendErr);
        }
    }
}

// Define reaction commands
const reactionCommands = {
    // Show a reaction menu with categories
    async reactionmenu(sock, message, args) {
        const sender = message.key.remoteJid;
        
        // Group reactions by category
        const categories = {
            "Basic Reactions": ["hug", "pat", "kiss", "cuddle"],
            "Expressions": ["smile", "happy", "wave", "dance", "cry", "blush", "laugh", "wink"],
            "Physical Actions": ["poke", "slap", "bonk", "bite", "punch", "highfive", "yeet"],
            "Walking Dead": ["punch", "bite", "poke", "pat"],
            "Fast & Furious": ["yeet", "highfive", "bonk"]
        };
        
        // Get category translations
        const translatedCategories = {};
        for (const category in categories) {
            const translationKey = `reactions.categories.${category.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            translatedCategories[languageManager.getText(translationKey) || category] = categories[category];
        }
        
        // Count available GIFs
        const availableGifs = Object.values(REACTION_GIFS)
            .filter(gifPath => fs.existsSync(gifPath) && fs.statSync(gifPath).size > 1000)
            .length;
            
        // Create menu text with translations
        let menuText = `*${languageManager.getText('reactions.menu.title') || '🎬 Reaction GIFs Menu'}*\n`;
        menuText += languageManager.getText('reactions.menu.workingGifs', null, availableGifs, Object.keys(REACTION_GIFS).length) || 
                   `Total working GIFs: ${availableGifs}/${Object.keys(REACTION_GIFS).length}\n\n`;
        
        // Add categories
        for (const [category, commands] of Object.entries(translatedCategories)) {
            const workingCommands = commands.filter(cmd => 
                fs.existsSync(REACTION_GIFS[cmd]) && 
                fs.statSync(REACTION_GIFS[cmd]).size > 1000
            );
            
            menuText += `*${category}* (${workingCommands.length}/${commands.length})\n`;
            menuText += workingCommands.map(cmd => `!${cmd}`).join(", ") + "\n\n";
        }
        
        // Usage instructions
        menuText += `*${languageManager.getText('reactions.menu.howToUse') || 'How to use:'}*\n`;
        menuText += `• ${languageManager.getText('reactions.menu.selfUsage') || 'For self-reactions: !commandname'}\n`;
        menuText += `• ${languageManager.getText('reactions.menu.targetUsage') || 'To target someone: !commandname @user'}\n\n`;
        menuText += languageManager.getText('reactions.menu.testGif') || `Try !testgif [name] to preview any reaction GIF!`;
        
        await safeSendText(sock, sender, menuText);
    },
    
    // Reaction status/diagnostic command - checks local GIF files
    async reactionstatus(sock, message, args) {
        const sender = message.key.remoteJid;
        let statusText = "*📊 Reaction Commands Status*\n\n";
        
        // Check local GIF files
        const results = Object.entries(REACTION_GIFS).map(([type, filePath]) => {
            const exists = fs.existsSync(filePath);
            const fileStats = exists ? fs.statSync(filePath) : null;
            const fileSize = fileStats ? fileStats.size : 0;
            
            return {
                type,
                working: exists && fileSize > 1000, // File must exist and be reasonably sized
                filePath,
                fileSize,
                error: !exists ? "File not found" : (fileSize < 1000 ? "File too small" : null)
            };
        });
        
        // Group results by working status
        const working = results.filter(r => r.working);
        const notWorking = results.filter(r => !r.working);
        
        // Add to status text
        statusText += `✅ *Working Commands (${working.length})*:\n`;
        statusText += working.map(w => `• !${w.type}`).join('\n');
        
        if (notWorking.length > 0) {
            statusText += `\n\n❌ *Non-Working Commands (${notWorking.length})*:\n`;
            statusText += notWorking.map(nw => `• !${nw.type} (${nw.error || 'Unknown error'})`).join('\n');
        }
        
        statusText += "\n\n*Usage*: Simply type !commandname (e.g. !hug, !slap)";
        statusText += "\nTo target someone: !commandname @user";
        
        await safeSendText(sock, sender, statusText);

        // If detailed flag is provided, print detailed information for debugging
        if (args[0] === 'detailed') {
            let detailedText = "*Detailed Reaction Command Status*\n\n";
            
            for (const result of results) {
                detailedText += `*Command:* !${result.type}\n`;
                detailedText += `Status: ${result.working ? '✅ Working' : '❌ Not working'}\n`;
                detailedText += `File exists: ${fs.existsSync(result.filePath) ? 'Yes' : 'No'}\n`;
                detailedText += `File size: ${result.fileSize} bytes\n`;
                detailedText += `Path: ${result.filePath}\n`;
                detailedText += `Error: ${result.error || 'None'}\n\n`;
            }
            
            await safeSendText(sock, sender, detailedText);
        }
    },
    
    // Command to test local GIFs
    async testgif(sock, message, args) {
        const sender = message.key.remoteJid;
        const gifName = args[0];
        
        // If no GIF name is provided, show available GIFs
        if (!gifName) {
            const gifFiles = fs.readdirSync(REACTIONS_DIR)
                .filter(file => file.endsWith('.gif'));
            
            await safeSendText(sock, sender, `*Available GIFs for Testing (${gifFiles.length})*\n\n` + 
                      gifFiles.map(file => `• ${file.replace('.gif', '')}`).join('\n') +
                      '\n\nUsage: !testgif [reaction_name]');
            return;
        }
        
        // Check if GIF exists
        const gifPath = path.join(REACTIONS_DIR, `${gifName}.gif`);
        
        // Check if the file exists
        if (!fs.existsSync(gifPath)) {
            await safeSendMessage(sock, sender, {
                text: `❌ GIF not found: ${gifName}.gif\n\nTry !testgif to see available GIFs.`
            });
            return;
        }
        
        try {
            // Get GIF info
            const stats = fs.statSync(gifPath);
            const fileSizeKB = (stats.size / 1024).toFixed(2);
            
            // Get source info if available
            let sourceInfo = "Unknown source";
            const infoPath = path.join(REACTIONS_DIR, 'detail_info', `${gifName}.txt`);
            if (fs.existsSync(infoPath)) {
                sourceInfo = fs.readFileSync(infoPath, 'utf8');
            }
            
            // Send info message
            await safeSendMessage(sock, sender, {
                text: `*Testing GIF: ${gifName}*\n` +
                      `File size: ${fileSizeKB} KB\n` +
                      `Full path: ${gifPath}\n\n` +
                      `${sourceInfo}`
            });
            
            // First try with our unified safeSendAnimatedGif helper
            try {
                await safeSendAnimatedGif(sock, sender, gifPath, `${gifName} reaction (using safeSendAnimatedGif)`, {
                    gifAttribution: gifName,
                    keepFormat: true,    // Signal to preserve original format
                    mediaType: 2,        // 2 = video type
                    isAnimated: true,    // Signal this is animated content
                    animated: true,      // Double confirm animation
                    shouldLoop: true,    // Ensure animation loops
                    seconds: 8           // Suggested duration for looping
                });
                logger.info(`Successfully sent test GIF using safeSendAnimatedGif utility`);
            } catch (unifiedError) {
                logger.error(`Error with unified GIF sender: ${unifiedError.message}`);
                
                // If the unified approach failed, try individual methods for diagnostic purposes
                const buffer = fs.readFileSync(gifPath);
                
                // Method 1: Try to send as sticker with animation
                try {
                    await safeSendMessage(sock, sender, {
                        sticker: buffer,
                        isAnimated: true,
                    });
                    logger.info(`Successfully sent test GIF as animated sticker`);
                } catch (stickerError) {
                    logger.warn(`Could not send as animated sticker: ${stickerError.message}`);
                }
                
                // Method 2: Try to send directly as MP4 with forced mimetype
                try {
                    const FileType = require('file-type');
                    const fileTypeResult = await FileType.fromBuffer(buffer);
                    
                    await safeSendMessage(sock, sender, {
                        video: buffer,
                        gifPlayback: true,
                        ptt: false,
                        mimetype: fileTypeResult?.mime || 'video/mp4',
                        caption: `${gifName} reaction (as MP4)`,
                    });
                    logger.info(`Successfully sent test GIF as direct MP4`);
                } catch (mp4Error) {
                    logger.warn(`Could not send as MP4: ${mp4Error.message}`);
                }
                
                // Method 3: Try with document method
                try {
                    await safeSendMessage(sock, sender, {
                        document: buffer,
                        mimetype: 'image/gif',
                        fileName: `${gifName}.gif`,
                        caption: `${gifName} reaction (as document)`
                    });
                    logger.info(`Successfully sent test GIF as document`);
                } catch (docError) {
                    logger.warn(`Could not send as document: ${docError.message}`);
                    
                    // Final error if all methods fail
                    await safeSendText(sock, sender, `❌ Error sending GIF: None of the sending methods worked.`);
                }
            }
        } catch (error) {
            await safeSendMessage(sock, sender, {
                text: `❌ Error testing GIF: ${error.message}`
            });
        }
    },
    
    async hug(sock, message, args) {
        try {
            // Add diagnostic logging
            logger.info(`Executing hug command with message: ${JSON.stringify(message?.key || {})}`);
            
            const sender = message.key.remoteJid;
            const target = args[0];
            await sendReactionMessage(sock, sender, target, 'hug', null, '🤗', message);
        } catch (error) {
            logger.error(`Error in hug command: ${error.message}`);
            await safeSendMessage(sock, message.key.remoteJid, {
                text: `❌ Error using hug command: ${error.message}`
            });
        }
    },
    async pat(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            const target = args[0];
            await sendReactionMessage(sock, sender, target, 'pat', null, '👋', message);
        } catch (error) {
            logger.error(`Error in pat command: ${error.message}`);
            await safeSendMessage(sock, message.key.remoteJid, {
                text: `❌ Error using pat command: ${error.message}`
            });
        }
    },
    async kiss(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'kiss', null, '💋', message);
    },
    async cuddle(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'cuddle', null, '🤗', message);
    },
    async smile(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'smile', null, '😊', message);
    },
    async happy(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'happy', null, '😊', message);
    },
    async wave(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'wave', null, '👋', message);
    },
    async dance(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'dance', null, '💃', message);
    },
    async cry(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'cry', null, '😢', message);
    },
    async blush(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'blush', null, '😊', message);
    },
    async laugh(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'laugh', null, '😂', message);
    },
    async wink(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'wink', null, '😉', message);
    },
    async poke(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'poke', null, '👉', message);
    },
    async slap(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'slap', null, '👋', message);
    },
    async bonk(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'bonk', null, '🔨', message);
    },
    async bite(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'bite', null, '😬', message);
    },
    async yeet(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'yeet', null, '🚀', message);
    },
    async punch(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'punch', null, '👊', message);
    },
    async highfive(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'highfive', null, '✋', message);
    }
};

// We're using the singleton language manager instance imported at the top of the file

/**
 * Initialize the module and validate all reaction GIFs
 * @returns {Promise<boolean>} Whether initialization was successful
 */
async function init() {
    logger.info('Initializing reactions module with enhanced message initialization checks...');
    
    // Validate all reaction GIFs
    const validGifs = [];
    const missingGifs = [];
    
    for (const [type, gifPath] of Object.entries(REACTION_GIFS)) {
        if (gifPath && fs.existsSync(gifPath)) {
            const stats = fs.statSync(gifPath);
            if (stats.size > 1024) {
                validGifs.push(type);
                logger.info(`✅ Found valid GIF for ${type}: ${gifPath}`);
            } else {
                missingGifs.push(type);
                logger.warn(`⚠️ GIF file for ${type} is too small: ${stats.size} bytes`);
            }
        } else {
            missingGifs.push(type);
            logger.warn(`❌ Missing GIF for ${type}`);
        }
    }
    
    logger.info(`Reaction GIFs validation complete. Valid: ${validGifs.length}, Missing: ${missingGifs.length}`);
    
    // Run the GIF preloader after validation
    preloadCommonGifs();
    
    // Verify language file usage
    try {
        if (languageManager) {
            logger.info('Using global language manager for reactions module');
        } else {
            logger.warn('Language manager not available, using fallback texts');
        }
    } catch (err) {
        logger.warn(`Language system error: ${err.message}`);
    }
    
    return true;
}

/**
 * Send GIF with exponential backoff for improved reliability
 * 
 * This function attempts to send an animated GIF with exponential backoff and retries
 * on failure. It implements circuit breaker patterns and various fallback strategies.
 * 
 * @param {Object} sock - WhatsApp socket connection
 * @param {string} jid - Chat JID to send to
 * @param {Buffer|string} gifData - GIF buffer or path to GIF file
 * @param {string} caption - Optional caption for the GIF
 * @param {Object} options - Additional sending options
 * @param {number} retries - Number of retry attempts (default: BACKOFF_CONFIG.MAX_RETRIES)
 * @returns {Promise<Object|null>} - Message sending result or null if all retries failed
 */
async function sendGifWithExponentialBackoff(sock, jid, gifData, caption = '', options = {}, retries = BACKOFF_CONFIG.MAX_RETRIES) {
    let delay = BACKOFF_CONFIG.INITIAL_DELAY;
    const maxDelay = BACKOFF_CONFIG.MAX_DELAY;
    
    // Add jitter to avoid thundering herd problem
    const getJitter = () => Math.random() * BACKOFF_CONFIG.JITTER * 2 - BACKOFF_CONFIG.JITTER;
    
    // Track error types to adapt retry strategy
    let timeoutErrors = 0;
    let networkErrors = 0;
    let serverErrors = 0;
    let formatErrors = 0;
    
    // If gifData is a path, load it first
    let gifBuffer;
    if (typeof gifData === 'string' && fs.existsSync(gifData)) {
        try {
            gifBuffer = fs.readFileSync(gifData);
        } catch (readErr) {
            logger.error(`Failed to read GIF file: ${readErr.message}`);
            throw readErr;
        }
    } else if (Buffer.isBuffer(gifData)) {
        gifBuffer = gifData;
    } else {
        throw new Error('Invalid GIF data: must be a Buffer or valid file path');
    }
    
    // Try different sending strategies in order of preference
    const sendStrategies = [
        // Strategy 1: Use safeSendAnimatedGif (preferred method)
        async () => {
            return await safeSendAnimatedGif(sock, jid, gifBuffer, caption, {
                ptt: false,
                keepFormat: true,
                mediaType: 2,
                isAnimated: true,
                animated: true,
                shouldLoop: true,
                seconds: 8,
                ...options
            });
        },
        
        // Strategy 2: Try as gifPlayback video
        async () => {
            return await safeSendMessage(sock, jid, {
                video: gifBuffer,
                gifPlayback: true,
                caption: caption
            });
        },
        
        // Strategy 3: Last resort - try as sticker
        async () => {
            return await safeSendMessage(sock, jid, {
                sticker: gifBuffer,
                isAnimated: true
            });
        }
    ];
    
    // Try each strategy with exponential backoff
    for (let attempt = 0; attempt <= retries; attempt++) {
        // Calculate strategy to use based on error history
        let strategyIndex = 0;
        
        // Adapt strategy based on error history
        if (formatErrors > 0) {
            // Format errors suggest we should try a different strategy
            strategyIndex = Math.min(formatErrors, sendStrategies.length - 1);
        }
        
        try {
            // Get current strategy
            const currentStrategy = sendStrategies[strategyIndex];
            
            // Try this strategy
            const result = await currentStrategy();
            
            // If we get here, we succeeded
            if (attempt > 0) {
                logger.info(`Successfully sent GIF after ${attempt} retries using strategy #${strategyIndex + 1}`);
            }
            
            return result;
        } catch (error) {
            // Track error types for analytics and adaptive retry
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                timeoutErrors++;
            } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                networkErrors++;
            } else if (error.response && error.response.status >= 500) {
                serverErrors++;
            } else if (
                error.message.includes('format') || 
                error.message.includes('convert') || 
                error.message.includes('invalid') ||
                error.message.includes('not supported')
            ) {
                formatErrors++;
            }
            
            // On final retry, try the last strategy as a last resort
            if (attempt === retries - 1 && strategyIndex < sendStrategies.length - 1) {
                logger.warn(`Trying last resort strategy for GIF sending`);
                try {
                    return await sendStrategies[sendStrategies.length - 1]();
                } catch (lastError) {
                    logger.error(`Last resort strategy failed: ${lastError.message}`);
                }
            }
            
            // On final retry, provide detailed error info
            if (attempt === retries) {
                logger.error(`All ${retries} retries failed for GIF sending`, {
                    timeoutErrors,
                    networkErrors,
                    serverErrors,
                    formatErrors,
                    lastError: error.message
                });
                throw error;
            }
            
            // Log the error
            logger.warn(`GIF send attempt ${attempt + 1}/${retries} failed: ${error.message}`);
            
            // Calculate delay with jitter
            const jitteredDelay = delay + getJitter();
            await new Promise(resolve => setTimeout(resolve, jitteredDelay));
            
            // Exponential backoff with cap
            delay = Math.min(delay * 2, maxDelay);
        }
    }
    
    // If we get here, all retries failed
    return null;
}

// Export module
module.exports = {
    commands: reactionCommands,
    category: 'reactions',
    init
};