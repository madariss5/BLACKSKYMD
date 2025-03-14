// Import required modules
const logger = require('../utils/logger');
const axios = require('axios');
const { safeSendText, safeSendMessage, safeSendImage, safeSendAnimatedGif } = require('../utils/jidHelper');
const { languageManager } = require('../utils/language');

// Cache for user information
const userCache = new Map();
const USER_CACHE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Using file paths to local GIFs for reliable access
const path = require('path');
const fs = require('fs');

// Path to reaction GIFs directory
const REACTIONS_DIR = path.join(process.cwd(), 'data', 'reaction_gifs');

// Map of reaction types to their corresponding GIF files
const REACTION_GIFS = {
    // Basic reactions
    hug: path.join(REACTIONS_DIR, 'hug.gif'),
    pat: path.join(REACTIONS_DIR, 'pat.gif'), // Not provided yet
    kiss: path.join(REACTIONS_DIR, 'kiss.gif'),
    cuddle: path.join(REACTIONS_DIR, 'cuddle.gif'),
    
    // Expressions
    smile: path.join(REACTIONS_DIR, 'smile.gif'),
    happy: path.join(REACTIONS_DIR, 'happy.gif'),
    wave: path.join(REACTIONS_DIR, 'wave.gif'),
    dance: path.join(REACTIONS_DIR, 'dance.gif'),
    cry: path.join(REACTIONS_DIR, 'cry.gif'),
    blush: path.join(REACTIONS_DIR, 'blush.gif'),
    laugh: path.join(REACTIONS_DIR, 'laugh.gif'),
    wink: path.join(REACTIONS_DIR, 'wink.gif'),
    
    // Physical actions
    poke: path.join(REACTIONS_DIR, 'poke.gif'), // Not provided yet
    slap: path.join(REACTIONS_DIR, 'slap.gif'),
    bonk: path.join(REACTIONS_DIR, 'bonk.gif'), // Not provided yet
    bite: path.join(REACTIONS_DIR, 'bite.gif'), // Not provided yet
    punch: path.join(REACTIONS_DIR, 'punch.gif'), // Not provided yet
    highfive: path.join(REACTIONS_DIR, 'highfive.gif'), // Not provided yet
    
    // Other actions
    yeet: path.join(REACTIONS_DIR, 'yeet.gif') // Not provided yet
};

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

        // Default to phone number if no name found
        if (!name) {
            // Extract phone number from JID
            const phoneMatch = jid.match(/^(\d+)@/);
            name = phoneMatch ? phoneMatch[1] : jid.split('@')[0];
            
            // Format phone numbers nicely if they match expected pattern
            if (name.match(/^\d{10,}$/)) {
                // Try to format as (XXX) XXX-XXXX
                try {
                    name = name.replace(/(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
                } catch (e) {
                    // If formatting fails, keep original
                }
            }
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
async function sendReactionMessage(sock, sender, target, type, customGifUrl, emoji) {
    try {
        // Skip confirmation message to avoid spam - go straight to the result
        const targetJid = target ? (target.includes('@') ? target : `${target.replace('@', '')}@s.whatsapp.net`) : null;

        // Validate target if provided
        if (target && !validateMention(target)) {
            await safeSendMessage(sock, sender, { text: `❌ Invalid target mention for ${type} command` });
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
        let message;
        if (target) {
            // Get translations for reaction to target
            const toEveryoneKey = `reactions.${type}.toEveryone`;
            const toTargetKey = `reactions.${type}.toTarget`;
            
            if (targetName === 'everyone' || targetName === 'all') {
                message = languageManager.getText(toEveryoneKey, null, senderName, emoji) || 
                          `${senderName} ${type}s everyone ${emoji}`;
            } else {
                message = languageManager.getText(toTargetKey, null, senderName, targetName, emoji) || 
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
            
            message = languageManager.getText(selfKey, null, senderName, emoji) || 
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

        // Create a fancy message with emoji decorations
        const decoratedMessage = `*${message}*\n\n_"${randomReactionText}"_ ${emoji}`;

        // Check if we have a GIF for this reaction type
        const gifPath = REACTION_GIFS[type];
        let hasGif = false;
        
        if (gifPath && fs.existsSync(gifPath)) {
            hasGif = true;
            logger.info(`Found GIF file for ${type} at ${gifPath}`);
        } else {
            logger.warn(`No GIF file found for ${type} at ${gifPath}`);
        }

        // First send the text message for immediate response
        await safeSendText(sock, sender, decoratedMessage);
        logger.info(`Successfully sent ${type} reaction text to ${sender}`);
        
        // Then try to send the GIF if available - using centralized safeSendAnimatedGif utility
        if (hasGif) {
            try {
                // Log GIF information
                const stats = fs.statSync(gifPath);
                const fileSize = stats.size / 1024; // KB
                logger.info(`Preparing to send ${type} reaction GIF (${fileSize.toFixed(2)} KB) from ${gifPath}`);
                
                // Use our specialized GIF sending utility with improved animation options
                await safeSendAnimatedGif(sock, sender, gifPath, '', { 
                    ptt: false,
                    gifAttribution: type,
                    keepFormat: true,    // Signal to preserve original format
                    mediaType: 2,        // 2 = video type
                    isAnimated: true,    // Signal this is animated content
                    animated: true,      // Double confirm animation
                    shouldLoop: true,    // Ensure animation loops
                    seconds: 8           // Suggested duration for looping
                });
                logger.info(`Successfully sent ${type} reaction GIF to ${sender} using safeSendAnimatedGif`);
            } catch (gifError) {
                logger.error(`Error sending animated GIF: ${gifError.message}`);
                
                // Try MP4 conversion as a fallback approach (most compatible)
                try {
                    logger.info(`Attempting direct MP4 conversion for ${type} reaction GIF`);
                    const fs = require('fs');
                    const path = require('path');
                    const ffmpeg = require('fluent-ffmpeg');
                    
                    // Create temp directory and paths
                    const tempDir = path.join(process.cwd(), 'temp');
                    if (!fs.existsSync(tempDir)) {
                        fs.mkdirSync(tempDir, { recursive: true });
                    }
                    
                    const mp4Path = path.join(tempDir, `${type}-${Date.now()}.mp4`);
                    
                    // Convert to MP4
                    await new Promise((resolve, reject) => {
                        ffmpeg(gifPath)
                            .outputOptions([
                                '-movflags faststart',
                                '-pix_fmt yuv420p',
                                '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2'
                            ])
                            .output(mp4Path)
                            .on('end', resolve)
                            .on('error', reject)
                            .run();
                    });
                    
                    // Send as video with gifPlayback
                    const mp4Buffer = fs.readFileSync(mp4Path);
                    await sock.sendMessage(sender, {
                        video: mp4Buffer,
                        gifPlayback: true,
                        caption: ''
                    });
                    
                    logger.info(`Successfully sent ${type} reaction as MP4 with gifPlayback to ${sender}`);
                    
                    // Clean up
                    try {
                        fs.unlinkSync(mp4Path);
                    } catch (cleanupError) {
                        logger.warn(`Failed to clean up temp MP4: ${cleanupError.message}`);
                    }
                } catch (mp4Error) {
                    logger.error(`MP4 conversion fallback failed: ${mp4Error.message}`);
                    
                    // Last resort: try as regular sticker
                    try {
                        const buffer = fs.readFileSync(gifPath);
                        await safeSendMessage(sock, sender, {
                            sticker: buffer,
                            isAnimated: true,
                        });
                        logger.info(`Successfully sent ${type} reaction as animated sticker to ${sender} (last resort)`);
                    } catch (fallbackError) {
                        logger.error(`All fallback methods failed: ${fallbackError.message}`);
                    }
                }
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
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'hug', null, '🤗');
    },
    async pat(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'pat', null, '👋');
    },
    async kiss(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'kiss', null, '💋');
    },
    async cuddle(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'cuddle', null, '🤗');
    },
    async smile(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'smile', null, '😊');
    },
    async happy(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'happy', null, '😊');
    },
    async wave(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'wave', null, '👋');
    },
    async dance(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'dance', null, '💃');
    },
    async cry(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'cry', null, '😢');
    },
    async blush(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'blush', null, '😊');
    },
    async laugh(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'laugh', null, '😂');
    },
    async wink(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'wink', null, '😉');
    },
    async poke(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'poke', null, '👉');
    },
    async slap(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'slap', null, '👋');
    },
    async bonk(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'bonk', null, '🔨');
    },
    async bite(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'bite', null, '😬');
    },
    async yeet(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'yeet', null, '🚀');
    },
    async punch(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'punch', null, '👊');
    },
    async highfive(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'highfive', null, '✋');
    }
};

// We're using the singleton language manager instance imported at the top of the file

// Initialize function
async function init() {
    try {
        logger.info('Initializing reactions module...');
        
        // Ensure reaction GIFs directory exists
        if (!fs.existsSync(REACTIONS_DIR)) {
            logger.warn(`Reaction GIFs directory not found at ${REACTIONS_DIR}. Creating directory...`);
            try {
                fs.mkdirSync(REACTIONS_DIR, { recursive: true });
                logger.info(`Created reaction GIFs directory at ${REACTIONS_DIR}`);
            } catch (dirError) {
                logger.error(`Failed to create reaction GIFs directory: ${dirError.message}`);
            }
        }
        
        // Validate GIF files
        const missingGifs = [];
        const validGifs = [];
        
        for (const [type, gifPath] of Object.entries(REACTION_GIFS)) {
            if (fs.existsSync(gifPath) && fs.statSync(gifPath).size > 1000) {
                validGifs.push(type);
                logger.info(`✅ Found valid GIF for ${type}: ${gifPath}`);
            } else {
                missingGifs.push(type);
                logger.warn(`❌ Missing or invalid GIF for ${type}: ${gifPath}`);
            }
        }
        
        logger.info(`Reaction GIFs validation complete. Valid: ${validGifs.length}, Missing: ${missingGifs.length}`);
        
        // Language manager is already initialized by the singleton
        logger.info('Using global language manager for reactions module');
        
        return true;
    } catch (error) {
        logger.error('Failed to initialize reactions module:', error);
        return false;
    }
}

// Export module
module.exports = {
    commands: reactionCommands,
    category: 'reactions',
    init
};