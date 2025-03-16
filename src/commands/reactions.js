/**
 * Enhanced Reaction Commands for WhatsApp Bot
 * Sends animated GIFs with proper mention formatting
 * Includes improved GIF loading and caching for better performance
 */

const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { safeSendMessage } = require('../utils/jidHelper');

// Paths to reaction GIFs directories
const REACTIONS_DIR = path.join(process.cwd(), 'data', 'reaction_gifs');
const ANIMATED_GIFS_DIR = path.join(process.cwd(), 'animated_gifs');
const ATTACHED_ASSETS_DIR = path.join(process.cwd(), 'attached_assets');

// GIF mapping to ensure correct GIFs for each reaction
const REACTION_GIF_MAPPING = {
    // Self-reactions
    'smile': 'heavenly-joy-jerkins-i-am-so-excited.gif', // Happy smiling animation
    'happy': 'heavenly-joy-jerkins-i-am-so-excited.gif', // Happy excitement
    'dance': 'B6ya.gif', // Dance animation
    'cry': 'long-tears.gif', // Crying animation
    'blush': '0fd379b81bc8023064986c9c45f22253_w200.gif', // Blushing animation
    'laugh': 'laugh.gif', // Updated laugh animation with person laughing
    
    // Target-reactions
    'hug': 'tumblr_cdeb20431732069e4456c4ab66b9534f_8178dd55_500.gif', // Hugging animation
    'pat': 'pat.gif', // Updated patting animation with Stitch
    'kiss': 'tumblr_435925615ecd34c607dd730ab836eacf_4e338a28_540.gif', // Kissing animation
    'cuddle': 'icegif-890.gif', // Cuddling animation
    'wave': 'wave.gif', // Updated waving animation with character waving
    'wink': 'wink.gif', // Updated winking animation with person winking
    'poke': 'poke.gif', // Updated poking animation with chickens
    'slap': 'slap.gif', // Slapping animation
    'bonk': 'icegif-255.gif', // Bonking animation
    'bite': '15d3d956bd674096c4e68f1d011e8023.gif', // Biting-like animation
    'punch': '2Lmc.gif', // Punching animation
    'highfive': 'BT_L5v.gif', // High fiving (waving) animation
    'yeet': '15d3d956bd674096c4e68f1d011e8023.gif', // Throwing (bite-like) animation
    'kill': 'giphy.gif' // Intense animation for "kill" command
};

// Create directories if they don't exist
function ensureDirectoriesExist() {
    const dirs = [REACTIONS_DIR, ANIMATED_GIFS_DIR];
    
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            logger.info(`Creating reaction GIFs directory: ${dir}`);
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

// Ensure reaction GIFs are correctly mapped
function ensureReactionGifs() {
    Object.entries(REACTION_GIF_MAPPING).forEach(([command, sourceFileName]) => {
        const sourcePath = path.join(ATTACHED_ASSETS_DIR, sourceFileName);
        const targetPath = path.join(REACTIONS_DIR, `${command}.gif`);
        
        // Check if source file exists
        if (fs.existsSync(sourcePath)) {
            // Check if target needs updating
            let needsUpdate = true;
            
            if (fs.existsSync(targetPath)) {
                try {
                    const sourceStats = fs.statSync(sourcePath);
                    const targetStats = fs.statSync(targetPath);
                    
                    // If the target file is newer than the source and not empty, we don't need to update
                    if (targetStats.size > 1024 && targetStats.mtimeMs >= sourceStats.mtimeMs) {
                        needsUpdate = false;
                    }
                } catch (err) {
                    logger.warn(`Error checking file stats for ${command}.gif: ${err.message}`);
                }
            }
            
            if (needsUpdate) {
                try {
                    // Copy the source file to the target
                    fs.copyFileSync(sourcePath, targetPath);
                    logger.info(`✅ Updated GIF for ${command} from ${sourceFileName}`);
                } catch (err) {
                    logger.error(`❌ Failed to update GIF for ${command}: ${err.message}`);
                }
            }
        } else {
            logger.warn(`⚠️ Source GIF not found: ${sourcePath}`);
        }
    });
}

// Ensure directories exist when module loads
ensureDirectoriesExist();
// Ensure reaction GIFs are correctly mapped
ensureReactionGifs();

// GIF buffer cache to improve performance
const gifCache = new Map();

// Helper function to get user name from message
async function getUserName(sock, jid) {
    try {
        if (!jid) return "Someone";
        if (jid.endsWith('@g.us')) return "Group Chat";
        
        const phoneNumber = jid.split('@')[0];
        
        let name = null;
        if (sock.store && sock.store.contacts) {
            const contact = sock.store.contacts[jid];
            if (contact) {
                name = contact.name || contact.pushName;
            }
        }
        
        return name || `+${phoneNumber}`;
    } catch (err) {
        return "User";
    }
}

// Simplified reaction command handler - with proper WhatsApp mentions
async function handleReaction(sock, message, type, args) {
    try {
        const jid = message.key.remoteJid;
        const senderJid = message.key.participant || message.key.remoteJid;
        const senderName = await getUserName(sock, senderJid);
        
        // Get mentioned user or args as target
        let targetName = "themselves";
        let targetJid = null;
        let mentionedJids = [];
        
        // Check if there's a mention
        const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (mentionedJid && mentionedJid.length > 0) {
            targetJid = mentionedJid[0];
            targetName = await getUserName(sock, targetJid);
            mentionedJids.push(targetJid);
        } else if (args.length > 0) {
            targetName = args.join(' ');
        }
        
        // Add sender to mentions list for proper highlighting
        mentionedJids.push(senderJid);
        
        // Define reaction message with proper mention formatting
        let reactionMessage;
        
        // Format the sender name for mention
        const formattedSender = `@${senderJid.split('@')[0]}`;
        
        // Format target for mention if we have their JID
        const formattedTarget = targetJid ? `@${targetJid.split('@')[0]}` : targetName;
        
        switch (type) {
            // Self-reactions (only mention the sender)
            case 'smile': reactionMessage = `${formattedSender} smiles 😊`; break;
            case 'happy': reactionMessage = `${formattedSender} is happy 😄`; break;
            case 'dance': reactionMessage = `${formattedSender} is dancing 💃`; break;
            case 'cry': reactionMessage = `${formattedSender} is crying 😢`; break;
            case 'blush': reactionMessage = `${formattedSender} is blushing 😳`; break;
            case 'laugh': reactionMessage = `${formattedSender} is laughing 😂`; break;
            
            // Target-reactions (mention both sender and target)
            case 'hug': reactionMessage = `${formattedSender} hugs ${formattedTarget} 🤗`; break;
            case 'pat': reactionMessage = `${formattedSender} pats ${formattedTarget} 👋`; break;
            case 'kiss': reactionMessage = `${formattedSender} kisses ${formattedTarget} 😘`; break;
            case 'cuddle': reactionMessage = `${formattedSender} cuddles with ${formattedTarget} 🥰`; break;
            case 'wave': reactionMessage = `${formattedSender} waves at ${formattedTarget} 👋`; break;
            case 'wink': reactionMessage = `${formattedSender} winks at ${formattedTarget} 😉`; break;
            case 'poke': reactionMessage = `${formattedSender} pokes ${formattedTarget} 👉`; break;
            case 'slap': reactionMessage = `${formattedSender} slaps ${formattedTarget} 👋`; break;
            case 'bonk': reactionMessage = `${formattedSender} bonks ${formattedTarget} 🔨`; break;
            case 'bite': reactionMessage = `${formattedSender} bites ${formattedTarget} 😬`; break;
            case 'punch': reactionMessage = `${formattedSender} punches ${formattedTarget} 👊`; break;
            case 'highfive': reactionMessage = `${formattedSender} high fives ${formattedTarget} ✋`; break;
            case 'yeet': reactionMessage = `${formattedSender} yeets ${formattedTarget} 🚀`; break;
            case 'kill': reactionMessage = `${formattedSender} kills ${formattedTarget} 💀`; break;
            
            default: reactionMessage = `${formattedSender} reacts with ${type}`; break;
        }
        
        // Send the text message with proper mentions
        await safeSendMessage(sock, jid, { 
            text: reactionMessage,
            mentions: mentionedJids
        });
        
        // First try to get the GIF directly from the attachedAssets folder (source of truth)
        // This ensures we always use the correct GIF for the command
        let gifBuffer = null;
        let gifFound = false;
        
        // Check if we have a mapping for this reaction type
        if (REACTION_GIF_MAPPING[type]) {
            // Get the source file path from the mapping
            const sourceFilePath = path.join(ATTACHED_ASSETS_DIR, REACTION_GIF_MAPPING[type]);
            
            if (fs.existsSync(sourceFilePath)) {
                try {
                    // Read directly from the source file
                    gifBuffer = fs.readFileSync(sourceFilePath);
                    gifFound = true;
                    logger.info(`Using direct source GIF for ${type} from ${REACTION_GIF_MAPPING[type]}`);
                } catch (err) {
                    logger.error(`Error reading source GIF for ${type}: ${err.message}`);
                }
            }
        }
        
        // Fallback to the reaction_gifs directory if direct method failed
        if (!gifFound) {
            const gifPath = path.join(REACTIONS_DIR, `${type}.gif`);
            
            if (fs.existsSync(gifPath)) {
                try {
                    gifBuffer = fs.readFileSync(gifPath);
                    gifFound = true;
                    logger.info(`Using fallback GIF path for ${type}: ${gifPath}`);
                } catch (err) {
                    logger.error(`Error reading fallback GIF for ${type}: ${err.message}`);
                }
            }
        }
        
        // Send the GIF if we found one
        if (gifFound && gifBuffer) {
            try {
                // Send as video with gifPlayback enabled (modern method)
                await sock.sendMessage(jid, {
                    video: gifBuffer,
                    gifPlayback: true,
                    caption: '',
                    ptt: false
                });
                
                logger.info(`Sent animated GIF for reaction: ${type}`);
            } catch (gifError) {
                logger.error(`Error sending GIF for ${type}: ${gifError.message}`);
                
                // Fallback - try as a standard image
                try {
                    await sock.sendMessage(jid, {
                        image: gifBuffer,
                        caption: `${type} reaction`
                    });
                    
                    logger.info(`Sent fallback image for reaction: ${type}`);
                } catch (imgError) {
                    logger.error(`Failed to send fallback image for ${type}: ${imgError.message}`);
                }
            }
        } else {
            logger.warn(`Missing GIF for reaction: ${type}`);
        }
    } catch (error) {
        logger.error(`Error in ${type} command: ${error.message}`);
        try {
            const jid = message.key.remoteJid;
            await safeSendMessage(sock, jid, { text: `❌ Could not send ${type} reaction` });
        } catch (err) {
            logger.error('Failed to send error message:', err);
        }
    }
}

// Command implementation with explicit commands
const commands = {
    hug: async (sock, message, args) => await handleReaction(sock, message, 'hug', args),
    pat: async (sock, message, args) => await handleReaction(sock, message, 'pat', args),
    kiss: async (sock, message, args) => await handleReaction(sock, message, 'kiss', args),
    cuddle: async (sock, message, args) => await handleReaction(sock, message, 'cuddle', args),
    smile: async (sock, message, args) => await handleReaction(sock, message, 'smile', args),
    happy: async (sock, message, args) => await handleReaction(sock, message, 'happy', args),
    wave: async (sock, message, args) => await handleReaction(sock, message, 'wave', args),
    dance: async (sock, message, args) => await handleReaction(sock, message, 'dance', args),
    cry: async (sock, message, args) => await handleReaction(sock, message, 'cry', args),
    blush: async (sock, message, args) => await handleReaction(sock, message, 'blush', args),
    laugh: async (sock, message, args) => await handleReaction(sock, message, 'laugh', args),
    wink: async (sock, message, args) => await handleReaction(sock, message, 'wink', args),
    poke: async (sock, message, args) => await handleReaction(sock, message, 'poke', args),
    slap: async (sock, message, args) => await handleReaction(sock, message, 'slap', args),
    bonk: async (sock, message, args) => await handleReaction(sock, message, 'bonk', args),
    bite: async (sock, message, args) => await handleReaction(sock, message, 'bite', args),
    punch: async (sock, message, args) => await handleReaction(sock, message, 'punch', args),
    highfive: async (sock, message, args) => await handleReaction(sock, message, 'highfive', args),
    yeet: async (sock, message, args) => await handleReaction(sock, message, 'yeet', args),
    kill: async (sock, message, args) => await handleReaction(sock, message, 'kill', args)
};

/**
 * Initialize the module - validate all reaction GIFs
 */
async function init() {
    logger.info('Initializing reactions module...');
    
    // Make sure directories exist
    ensureDirectoriesExist();
    
    // Validate all reaction GIFs
    const validGifs = [];
    const missingGifs = [];
    
    Object.keys(commands).forEach(cmdName => {
        if (cmdName === 'init') return;
        
        const gifPath = path.join(REACTIONS_DIR, `${cmdName}.gif`);
        
        if (fs.existsSync(gifPath)) {
            const stats = fs.statSync(gifPath);
            if (stats.size > 1024) {
                validGifs.push(cmdName);
                logger.info(`✅ Found valid GIF for ${cmdName}: ${gifPath}`);
            } else {
                missingGifs.push(cmdName);
                logger.warn(`⚠️ GIF file for ${cmdName} is too small: ${stats.size} bytes`);
            }
        } else {
            missingGifs.push(cmdName);
            logger.warn(`❌ Missing GIF for ${cmdName}`);
        }
    });
    
    logger.info(`Reaction GIFs validation complete. Valid: ${validGifs.length}, Missing: ${missingGifs.length}`);
    
    return true;
}

// Export module with appropriate properties
module.exports = {
    commands,
    category: 'reactions',
    init
};