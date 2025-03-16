/**
 * Reaction Commands for WhatsApp Bot
 * Sends animated GIFs with proper mention formatting
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { safeSendMessage, isJidGroup } = require('../utils/jidHelper');

// Paths to reaction GIFs directories
const REACTIONS_DIR = path.join(process.cwd(), 'data', 'reaction_gifs');
const ANIMATED_GIFS_DIR = path.join(process.cwd(), 'animated_gifs');

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

// Ensure directories exist when module loads
ensureDirectoriesExist();

// Get path to GIF with fallback
function getGifPath(filename) {
    // Try primary path first
    const primaryPath = path.join(REACTIONS_DIR, filename);
    if (fs.existsSync(primaryPath) && fs.statSync(primaryPath).size > 1024) {
        return primaryPath;
    }
    
    // Try fallback path
    const fallbackPath = path.join(ANIMATED_GIFS_DIR, filename);
    if (fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).size > 1024) {
        return fallbackPath;
    }
    
    // Return primary path even if it doesn't exist
    return primaryPath;
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

// Cache for GIF buffers
const GIF_CACHE = new Map();

// Helper function to get user name from message
async function getUserName(sock, jid) {
    try {
        // Handle null JID
        if (!jid) return "Someone";
        
        // Handle group JID
        if (jid.endsWith('@g.us')) return "Group Chat";
        
        // Extract phone number from JID
        const phoneNumber = jid.split('@')[0];
        
        // Try to get contact info
        let name = null;
        if (sock.store && sock.store.contacts) {
            const contact = sock.store.contacts[jid];
            if (contact) {
                name = contact.name || contact.pushName;
            }
        }
        
        return name || `+${phoneNumber}`;
    } catch (err) {
        logger.error(`Error getting user name: ${err.message}`);
        return "User";
    }
}

// Reaction message templates
const REACTION_MESSAGES = {
    hug: (sender, target) => `${sender} hugs ${target} 🤗`,
    pat: (sender, target) => `${sender} pats ${target} 👋`,
    kiss: (sender, target) => `${sender} kisses ${target} 😘`,
    cuddle: (sender, target) => `${sender} cuddles with ${target} 🥰`,
    smile: (sender) => `${sender} smiles 😊`,
    happy: (sender) => `${sender} is happy 😄`,
    wave: (sender, target) => `${sender} waves at ${target} 👋`,
    dance: (sender) => `${sender} is dancing 💃`,
    cry: (sender) => `${sender} is crying 😢`,
    blush: (sender) => `${sender} is blushing 😳`,
    laugh: (sender) => `${sender} is laughing 😂`,
    wink: (sender, target) => `${sender} winks at ${target} 😉`,
    poke: (sender, target) => `${sender} pokes ${target} 👉`,
    slap: (sender, target) => `${sender} slaps ${target} 👋`,
    bonk: (sender, target) => `${sender} bonks ${target} 🔨`,
    bite: (sender, target) => `${sender} bites ${target} 😬`,
    punch: (sender, target) => `${sender} punches ${target} 👊`,
    highfive: (sender, target) => `${sender} high fives ${target} ✋`,
    yeet: (sender, target) => `${sender} yeets ${target} 🚀`
};

// Common reaction command handler
async function handleReactionCommand(sock, message, type, args) {
    try {
        // Get sender JID
        const jid = message.key.remoteJid;
        
        // Get sender name
        const senderJid = message.key.participant || message.key.remoteJid;
        const senderName = await getUserName(sock, senderJid);
        
        // Check if GIF exists
        const gifPath = REACTION_GIFS[type];
        if (!gifPath || !fs.existsSync(gifPath)) {
            await safeSendMessage(sock, jid, { text: `❌ Sorry, the ${type} GIF is not available.` });
            return;
        }
        
        // Get mentioned user or args as target
        let targetJid = null;
        let targetName = "themselves";
        
        // Check if there's a mention
        const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (mentionedJid && mentionedJid.length > 0) {
            targetJid = mentionedJid[0];
            targetName = await getUserName(sock, targetJid);
        } else if (args.length > 0) {
            // Use args as name
            targetName = args.join(' ');
        }
        
        // Get reaction message
        let reactionMessage;
        if (['smile', 'happy', 'dance', 'cry', 'blush', 'laugh'].includes(type)) {
            // Self-reactions don't need a target
            reactionMessage = REACTION_MESSAGES[type](senderName);
        } else {
            // Regular reactions need a target
            reactionMessage = REACTION_MESSAGES[type](senderName, targetName);
        }
        
        // Send the text message first
        await safeSendMessage(sock, jid, { text: reactionMessage });
        
        // Load the GIF
        let gifBuffer;
        const gifHash = crypto.createHash('md5').update(gifPath).digest('hex');
        
        // Check cache first
        if (GIF_CACHE.has(gifHash)) {
            gifBuffer = GIF_CACHE.get(gifHash);
        } else {
            // Load and cache the GIF
            gifBuffer = fs.readFileSync(gifPath);
            GIF_CACHE.set(gifHash, gifBuffer);
        }
        
        // Send the GIF
        await safeSendMessage(sock, jid, {
            video: gifBuffer,
            gifPlayback: true,
            caption: ''
        });
    } catch (error) {
        logger.error(`Error in ${type} command: ${error.message}`);
        const jid = message.key.remoteJid;
        await safeSendMessage(sock, jid, { text: `❌ Error sending ${type} reaction: ${error.message}` });
    }
}

// Command implementation
const reactionCommands = {
    hug: async (sock, message, args) => await handleReactionCommand(sock, message, 'hug', args),
    pat: async (sock, message, args) => await handleReactionCommand(sock, message, 'pat', args),
    kiss: async (sock, message, args) => await handleReactionCommand(sock, message, 'kiss', args),
    cuddle: async (sock, message, args) => await handleReactionCommand(sock, message, 'cuddle', args),
    smile: async (sock, message, args) => await handleReactionCommand(sock, message, 'smile', args),
    happy: async (sock, message, args) => await handleReactionCommand(sock, message, 'happy', args),
    wave: async (sock, message, args) => await handleReactionCommand(sock, message, 'wave', args),
    dance: async (sock, message, args) => await handleReactionCommand(sock, message, 'dance', args),
    cry: async (sock, message, args) => await handleReactionCommand(sock, message, 'cry', args),
    blush: async (sock, message, args) => await handleReactionCommand(sock, message, 'blush', args),
    laugh: async (sock, message, args) => await handleReactionCommand(sock, message, 'laugh', args),
    wink: async (sock, message, args) => await handleReactionCommand(sock, message, 'wink', args),
    poke: async (sock, message, args) => await handleReactionCommand(sock, message, 'poke', args),
    slap: async (sock, message, args) => await handleReactionCommand(sock, message, 'slap', args),
    bonk: async (sock, message, args) => await handleReactionCommand(sock, message, 'bonk', args),
    bite: async (sock, message, args) => await handleReactionCommand(sock, message, 'bite', args),
    punch: async (sock, message, args) => await handleReactionCommand(sock, message, 'punch', args),
    highfive: async (sock, message, args) => await handleReactionCommand(sock, message, 'highfive', args),
    yeet: async (sock, message, args) => await handleReactionCommand(sock, message, 'yeet', args)
};

/**
 * Initialize the module and validate all reaction GIFs
 */
async function init() {
    logger.info('Initializing reactions module...');
    
    // Make sure directories exist
    ensureDirectoriesExist();
    
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
    
    return true;
}

// Export module
module.exports = {
    commands: reactionCommands,
    category: 'reactions',
    init
};